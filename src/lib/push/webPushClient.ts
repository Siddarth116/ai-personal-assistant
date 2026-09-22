import webpush from "web-push";

let configured = false;

export function isPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

function ensureConfigured() {
  if (configured) return;
  if (!isPushConfigured()) {
    throw new Error("Push notifications are not configured (missing VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT)");
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string,
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  );
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  tag: string;
  url?: string;
}

export interface RawSubscription {
  endpoint: string;
  p256dh: string;
  authKey: string;
}

/**
 * Sends a single push notification. Returns "sent", or "gone" if the
 * subscription is no longer valid (the caller should delete it), or "error"
 * for anything else (transient failure - the caller should NOT delete the
 * subscription or mark the notification as sent, so it can be retried on the
 * next cron run).
 */
export async function sendPush(sub: RawSubscription, payload: PushPayload): Promise<"sent" | "gone" | "error"> {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.authKey },
      },
      JSON.stringify(payload)
    );
    return "sent";
  } catch (err: any) {
    // 404/410 mean the browser has permanently unsubscribed this endpoint (e.g. user cleared site data, uninstalled, or the OS revoked it).
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      return "gone";
    }
    console.error("[push] sendNotification failed:", err?.statusCode, err?.body || err?.message || err);
    return "error";
  }
}
