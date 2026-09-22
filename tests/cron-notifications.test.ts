import { describe, it, expect, vi, beforeEach } from "vitest";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { users, pushSubscriptions, sentPushNotifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createReminder } from "@/lib/services/reminderService";

process.env.CRON_SECRET = "test-cron-secret";

// Mock the actual network-calling push client entirely - these tests verify
// the endpoint's own logic (auth, dedup, pruning), not real push delivery.
vi.mock("@/lib/push/webPushClient", () => ({
  isPushConfigured: () => true,
  sendPush: vi.fn(),
}));

import { GET as cronHandler } from "@/app/api/cron/check-notifications/route";
import { sendPush } from "@/lib/push/webPushClient";

function makeRequest(secret?: string): Request {
  const headers = new Headers();
  if (secret) headers.set("authorization", `Bearer ${secret}`);
  return new Request("http://localhost/api/cron/check-notifications", { headers });
}

async function createUserWithSubscription(overrides: { notificationLeadMinutes?: number } = {}) {
  const userId = nanoid();
  await db
    .insert(users)
    .values({
      id: userId,
      name: "Cron Test User",
      email: `${userId}@test.local`,
      passwordHash: "x",
      timezone: "Asia/Kolkata",
      notificationsEnabled: true,
      notificationLeadMinutes: overrides.notificationLeadMinutes ?? 15,
    })
    .run();

  await db
    .insert(pushSubscriptions)
    .values({
      id: nanoid(),
      userId,
      endpoint: `https://push.example.com/${nanoid()}`,
      p256dh: "fake-p256dh",
      authKey: "fake-auth",
    })
    .run();

  return userId;
}

beforeEach(() => {
  vi.mocked(sendPush).mockReset();
  vi.mocked(sendPush).mockResolvedValue("sent");
});

describe("GET /api/cron/check-notifications - auth", () => {
  it("rejects requests with no secret", async () => {
    const res = await cronHandler(makeRequest());
    expect(res.status).toBe(401);
  });

  it("rejects requests with the wrong secret", async () => {
    const res = await cronHandler(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("accepts requests with the correct secret", async () => {
    const res = await cronHandler(makeRequest("test-cron-secret"));
    expect(res.status).toBe(200);
  });
});

describe("GET /api/cron/check-notifications - sending and dedup", () => {
  it("sends a push for a reminder that is due right now", async () => {
    const userId = await createUserWithSubscription();
    await createReminder(userId, {
      title: "Due right now",
      remindAt: new Date().toISOString(),
      timezone: "Asia/Kolkata",
    });

    const res = await cronHandler(makeRequest("test-cron-secret"));
    const body = await res.json();

    expect(body.notificationsSent).toBeGreaterThanOrEqual(1);
    expect(sendPush).toHaveBeenCalled();
  });

  it("does not send the same notification twice across two consecutive runs", async () => {
    const userId = await createUserWithSubscription();
    await createReminder(userId, {
      title: "Only once please",
      remindAt: new Date().toISOString(),
      timezone: "Asia/Kolkata",
    });

    const first = await cronHandler(makeRequest("test-cron-secret"));
    const firstBody = await first.json();
    expect(firstBody.notificationsSent).toBeGreaterThanOrEqual(1);

    vi.mocked(sendPush).mockClear();

    const second = await cronHandler(makeRequest("test-cron-secret"));
    const secondBody = await second.json();

    // The exact-time notification for this same reminder must not fire again.
    expect(secondBody.notificationsSent).toBe(0);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("prunes a subscription when the push service reports it as gone", async () => {
    const userId = await createUserWithSubscription();
    await createReminder(userId, {
      title: "Triggers a dead subscription",
      remindAt: new Date().toISOString(),
      timezone: "Asia/Kolkata",
    });

    vi.mocked(sendPush).mockResolvedValueOnce("gone");

    await cronHandler(makeRequest("test-cron-secret"));

    const remaining = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).all();
    expect(remaining).toHaveLength(0);
  });

  it("skips users with no push subscriptions entirely", async () => {
    const baseline = await cronHandler(makeRequest("test-cron-secret"));
    const baselineBody = await baseline.json();

    const userId = nanoid();
    await db
      .insert(users)
      .values({
        id: userId,
        name: "No Subscription User",
        email: `${userId}@test.local`,
        passwordHash: "x",
        notificationsEnabled: true,
      })
      .run();
    await createReminder(userId, {
      title: "Nobody to notify",
      remindAt: new Date().toISOString(),
      timezone: "Asia/Kolkata",
    });

    vi.mocked(sendPush).mockClear();
    const res = await cronHandler(makeRequest("test-cron-secret"));
    const body = await res.json();

    // A user with no subscription must never be counted as "checked" or sent to.
    expect(body.usersChecked).toBe(baselineBody.usersChecked);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("records a row in sent_push_notifications after a successful send", async () => {
    const userId = await createUserWithSubscription();
    await createReminder(userId, {
      title: "Should be recorded",
      remindAt: new Date().toISOString(),
      timezone: "Asia/Kolkata",
    });

    await cronHandler(makeRequest("test-cron-secret"));

    const records = await db.select().from(sentPushNotifications).where(eq(sentPushNotifications.userId, userId)).all();
    expect(records.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT record a notification as sent when every delivery attempt fails transiently - so it can retry next run", async () => {
    const userId = await createUserWithSubscription();
    await createReminder(userId, {
      title: "Transient failure should retry",
      remindAt: new Date().toISOString(),
      timezone: "Asia/Kolkata",
    });

    vi.mocked(sendPush).mockResolvedValueOnce("error"); // simulates a network blip, NOT a dead subscription

    const res = await cronHandler(makeRequest("test-cron-secret"));
    const body = await res.json();

    expect(body.notificationsSent).toBe(0);
    expect(body.subscriptionsPruned).toBe(0); // a transient error must never prune a valid subscription

    const records = await db.select().from(sentPushNotifications).where(eq(sentPushNotifications.userId, userId)).all();
    expect(records).toHaveLength(0);

    // And on the very next run (subscription still valid, item still due), it should actually retry and succeed.
    vi.mocked(sendPush).mockResolvedValueOnce("sent");
    const retryRes = await cronHandler(makeRequest("test-cron-secret"));
    const retryBody = await retryRes.json();
    expect(retryBody.notificationsSent).toBeGreaterThanOrEqual(1);
  });
});
