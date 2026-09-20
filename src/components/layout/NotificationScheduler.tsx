"use client";

import { useEffect, useRef } from "react";
import { useSession } from "./SessionProvider";
import { useToast } from "@/components/ui/Toast";
import { computeNotificationsToFire, type NotifiableItem, type PendingNotification } from "@/lib/notifications/scheduler";

const POLL_INTERVAL_MS = 30_000;
const DETECTION_WINDOW_MS = POLL_INTERVAL_MS * 2; // wider than the poll interval so a trigger can never fall in the gap between two polls
const STORAGE_KEY = "notified-items-v1";
const MAX_STORED_KEYS = 500;
const PRUNE_AFTER_MS = 2 * 24 * 60 * 60 * 1000; // don't let localStorage grow forever

function loadNotifiedKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { key: string; at: number }[];
    const cutoff = Date.now() - PRUNE_AFTER_MS;
    return new Set(parsed.filter((p) => p.at > cutoff).map((p) => p.key));
  } catch {
    return new Set();
  }
}

function persistNotifiedKey(key: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: { key: string; at: number }[] = raw ? JSON.parse(raw) : [];
    parsed.push({ key, at: Date.now() });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.slice(-MAX_STORED_KEYS)));
  } catch {
    // localStorage can be unavailable (private browsing, quota exceeded) -
    // worst case is an occasional duplicate notification, not worth surfacing an error for.
  }
}

const TYPE_LABEL: Record<NotifiableItem["type"], string> = {
  EVENT: "Event",
  TASK: "Task",
  REMINDER: "Reminder",
};

/**
 * Mounted once near the app root. While any tab is open and the user is
 * logged in, this polls the unified schedule every 30 seconds and fires:
 *   - an in-app toast (always, if notifications are enabled)
 *   - a browser Notification (only if the user has granted permission)
 * for two triggers per item: `notificationLeadMinutes` before its time, and
 * at its exact time.
 *
 * Known limitation, by design: this only works while a browser tab with the
 * app open is running. It does not deliver notifications to closed browsers
 * or to devices where the app isn't currently open - that would require a
 * real push infrastructure (service worker + Web Push + server-side
 * scheduling), which is a substantially larger feature.
 */
export function NotificationScheduler() {
  const { user } = useSession();
  const { showToast } = useToast();
  const notifiedKeysRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      notifiedKeysRef.current = loadNotifiedKeys();
      initializedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!user || !user.notificationsEnabled) return;

    const leadMinutes = user.notificationLeadMinutes;
    const hour24 = user.hourFormat === 24;

    async function poll() {
      try {
        const lookaheadMinutes = Math.max(leadMinutes, 0) + 5;
        const start = new Date();
        start.setMinutes(start.getMinutes() - 5); // small backward buffer so we don't miss something that just became due
        const end = new Date();
        end.setMinutes(end.getMinutes() + lookaheadMinutes);

        const res = await fetch(`/api/schedule?start=${start.toISOString()}&end=${end.toISOString()}`);
        if (!res.ok) return;
        const data = await res.json();

        const items: NotifiableItem[] = (data.items ?? [])
          .filter((i: any) => !["CANCELLED", "COMPLETED", "DISMISSED"].includes(i.status))
          .map((i: any) => ({ id: i.id, type: i.type, title: i.title, time: i.time }));

        const toFire = computeNotificationsToFire(
          items,
          new Date(),
          leadMinutes,
          notifiedKeysRef.current,
          DETECTION_WINDOW_MS
        );

        for (const notification of toFire) {
          notifiedKeysRef.current.add(notification.key);
          persistNotifiedKey(notification.key);
          fire(notification, leadMinutes, hour24, showToast);
        }
      } catch {
        // Notifications are a best-effort background feature - a failed poll
        // should never surface an error to the user or break anything else.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user?.id, user?.notificationsEnabled, user?.notificationLeadMinutes, user?.hourFormat, showToast]);

  return null;
}

function fire(
  notification: PendingNotification,
  leadMinutes: number,
  hour24: boolean,
  showToast: (message: string, variant?: "success" | "error") => void
) {
  const label = TYPE_LABEL[notification.item.type];
  const message =
    notification.kind === "lead"
      ? `${label} "${notification.item.title}" starts in ${leadMinutes} minute${leadMinutes === 1 ? "" : "s"}`
      : `${label} "${notification.item.title}" is happening now`;

  showToast(message);

  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(`${label}: ${notification.item.title}`, {
        body: notification.kind === "lead" ? `Starting in ${leadMinutes} minutes` : "Starting now",
        tag: notification.key, // lets the OS/browser de-duplicate if this somehow fires twice
      });
    } catch {
      // The Notification constructor can throw in some contexts (e.g. certain
      // mobile browsers require a service worker) - the toast above already covers it.
    }
  }
}
