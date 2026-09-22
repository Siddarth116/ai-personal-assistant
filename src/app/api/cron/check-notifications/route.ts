import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq, and, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, pushSubscriptions, sentPushNotifications } from "@/lib/db/schema";
import { getSchedule } from "@/lib/services/scheduleService";
import { computeNotificationsToFire, type NotifiableItem } from "@/lib/notifications/scheduler";
import { sendPush, isPushConfigured } from "@/lib/push/webPushClient";
import { nowIso } from "@/lib/utils/date";

// How far back we bother looking at sentPushNotifications history for dedup
// purposes - anything older than this can't possibly collide with a current
// check window, so there's no need to load it.
const DEDUP_LOOKBACK_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Expected to be called every 1-5 minutes by an EXTERNAL scheduler (e.g.
 * cron-job.org) - see README for setup. Vercel's own Hobby-plan cron only
 * runs once a day with imprecise timing, which is useless for this.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>` (or a `?secret=`
 * query param, since some free schedulers can't set custom headers) matching
 * the CRON_SECRET env var, so this can't be triggered by anyone who finds the URL.
 */
async function handler(req: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on the server." }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");
  const providedSecret = authHeader?.replace(/^Bearer\s+/i, "") ?? querySecret;

  if (providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Push notifications are not configured (missing VAPID env vars)." }, { status: 503 });
  }

  const eligibleUsers = await db
    .select()
    .from(users)
    .where(eq(users.notificationsEnabled, true))
    .all();

  let usersChecked = 0;
  let notificationsSent = 0;
  let subscriptionsPruned = 0;

  for (const user of eligibleUsers) {
    const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id)).all();
    if (subs.length === 0) continue; // nothing to send to
    usersChecked++;

    const lookaheadMinutes = Math.max(user.notificationLeadMinutes, 0) + 5;
    const now = new Date();
    const start = new Date(now.getTime() - 5 * 60_000);
    const end = new Date(now.getTime() + lookaheadMinutes * 60_000);

    const scheduleItems = await getSchedule(user.id, {
      start: start.toISOString(),
      end: end.toISOString(),
    });

    const notifiableItems: NotifiableItem[] = scheduleItems
      .filter((i) => !["CANCELLED", "COMPLETED", "DISMISSED"].includes(i.status))
      .map((i) => ({ id: i.id, type: i.type, title: i.title, time: i.time }));

    if (notifiableItems.length === 0) continue;

    const dedupCutoff = new Date(now.getTime() - DEDUP_LOOKBACK_MS).toISOString();
    const alreadySent = await db
      .select()
      .from(sentPushNotifications)
      .where(and(eq(sentPushNotifications.userId, user.id), gte(sentPushNotifications.sentAt, dedupCutoff)))
      .all();
    const alreadyNotifiedKeys = new Set(
      alreadySent.map((s) => `${s.itemType}:${s.itemId}:${s.itemTime}:${s.kind}`)
    );

    // Window matches how far apart consecutive cron invocations are expected
    // to be (a few minutes) - wide enough that a run every 2-5 min can't miss
    // a trigger that fell between two checks.
    const toFire = computeNotificationsToFire(notifiableItems, now, user.notificationLeadMinutes, alreadyNotifiedKeys, 6 * 60_000);

    for (const notification of toFire) {
      const label = notification.item.type === "EVENT" ? "Event" : notification.item.type === "TASK" ? "Task" : "Reminder";
      const body =
        notification.kind === "lead"
          ? `Starting in ${user.notificationLeadMinutes} minute${user.notificationLeadMinutes === 1 ? "" : "s"}`
          : "Starting now";

      let anySucceeded = false;
      let goneCount = 0;
      for (const sub of subs) {
        const result = await sendPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, authKey: sub.authKey },
          { title: `${label}: ${notification.item.title}`, body, tag: notification.key }
        );
        if (result === "sent") anySucceeded = true;
        if (result === "gone") {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id)).run();
          subscriptionsPruned++;
          goneCount++;
        }
      }

      // Only mark this as permanently sent if either (a) it actually reached
      // at least one device, or (b) every subscription turned out to be dead
      // (nothing left to retry against, so there's no point trying again).
      // If every attempt failed with a genuinely transient error, we deliberately
      // do NOT record it here - leaving it unrecorded means the next cron run
      // (a few minutes later, still within the detection window) will retry it,
      // rather than a temporary network blip silently swallowing a real notification forever.
      const nothingLeftToRetry = goneCount === subs.length;
      if (anySucceeded || nothingLeftToRetry) {
        try {
          await db
            .insert(sentPushNotifications)
            .values({
              id: nanoid(),
              userId: user.id,
              itemType: notification.item.type,
              itemId: notification.item.id,
              itemTime: notification.item.time,
              kind: notification.kind,
              sentAt: nowIso(),
            })
            .run();
          notificationsSent++;
        } catch (err) {
          // Unique constraint race (two overlapping cron runs) - harmless, just means it's already recorded.
          console.warn("[cron/check-notifications] dedup insert conflict, skipping:", err);
        }
      }
    }
  }

  return NextResponse.json({ usersChecked, notificationsSent, subscriptionsPruned });
}

export const GET = handler;
export const POST = handler;
