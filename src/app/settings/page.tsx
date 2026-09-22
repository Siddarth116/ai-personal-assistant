"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useSession } from "@/components/layout/SessionProvider";
import { Card, Input, Label, Select } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  isPushSupported,
  enablePushNotifications,
  disablePushNotifications,
  getCurrentPushSubscriptionEndpoint,
} from "@/lib/push/clientPush";

const TIMEZONES = [
  "Asia/Kolkata", "UTC", "America/New_York", "America/Los_Angeles", "Europe/London",
  "Europe/Berlin", "Asia/Tokyo", "Asia/Singapore", "Asia/Dubai", "Australia/Sydney",
];

const LEAD_TIME_OPTIONS = [
  { value: 0, label: "At the time only (no advance notice)" },
  { value: 5, label: "5 minutes before" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 180, label: "3 hours before" },
  { value: 1440, label: "1 day before" },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, refresh } = useSession();
  const { showToast } = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [timezone, setTimezone] = useState(user?.timezone ?? "Asia/Kolkata");
  const [hourFormat, setHourFormat] = useState(user?.hourFormat ?? 24);
  const [weekStartsOn, setWeekStartsOn] = useState(user?.weekStartsOn ?? "MONDAY");
  const [theme, setTheme] = useState(user?.theme ?? "system");
  const [notificationsEnabled, setNotificationsEnabled] = useState(user?.notificationsEnabled ?? true);
  const [notificationLeadMinutes, setNotificationLeadMinutes] = useState(user?.notificationLeadMinutes ?? 15);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  // Keep local form state in sync once the session actually loads (it's null on first render).
  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setTimezone(user.timezone);
    setHourFormat(user.hourFormat);
    setWeekStartsOn(user.weekStartsOn);
    setTheme(user.theme);
    setNotificationsEnabled(user.notificationsEnabled);
    setNotificationLeadMinutes(user.notificationLeadMinutes);
  }, [user]);

  // Reflect whether THIS device/browser already has an active push subscription.
  useEffect(() => {
    getCurrentPushSubscriptionEndpoint().then((endpoint) => setPushSubscribed(!!endpoint));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          timezone,
          hourFormat,
          weekStartsOn,
          theme,
          notificationsEnabled,
          notificationLeadMinutes,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Unable to save preferences.", "error");
        return;
      }
      showToast("Preferences saved.");
      await refresh();
    } catch {
      showToast("Unable to save preferences.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function requestBrowserNotifications() {
    setPushBusy(true);
    try {
      await enablePushNotifications();
      setPushSubscribed(true);
      showToast("Push notifications enabled on this device.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Unable to enable push notifications.", "error");
    } finally {
      setPushBusy(false);
    }
  }

  async function handleDisablePush() {
    setPushBusy(true);
    try {
      await disablePushNotifications();
      setPushSubscribed(false);
      showToast("Push notifications disabled on this device.");
    } catch {
      showToast("Unable to disable push notifications.", "error");
    } finally {
      setPushBusy(false);
    }
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (!user) {
    return (
      <AppShell title="Settings">
        <p className="text-muted-foreground">Loading...</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Settings">
      <div className="max-w-2xl space-y-6">
        <Card className="p-5">
          <h2 className="font-semibold mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={user.email} disabled />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-4">Preferences</h2>
          <div className="space-y-4">
            <div>
              <Label>Timezone</Label>
              <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Clock format</Label>
              <Select value={hourFormat} onChange={(e) => setHourFormat(Number(e.target.value))}>
                <option value={24}>24-hour</option>
                <option value={12}>12-hour</option>
              </Select>
            </div>
            <div>
              <Label>Week starts on</Label>
              <Select value={weekStartsOn} onChange={(e) => setWeekStartsOn(e.target.value)}>
                <option value="MONDAY">Monday</option>
                <option value="SUNDAY">Sunday</option>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-4">Notifications</h2>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable notifications</p>
                <p className="text-xs text-muted-foreground">Master switch for reminders about upcoming events, tasks, and reminders.</p>
              </div>
              <button
                role="switch"
                aria-checked={notificationsEnabled}
                onClick={() => setNotificationsEnabled((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${notificationsEnabled ? "bg-primary" : "bg-muted"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${notificationsEnabled ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </button>
            </div>

            <div>
              <Label>Notify me before it's due</Label>
              <Select
                value={notificationLeadMinutes}
                onChange={(e) => setNotificationLeadMinutes(Number(e.target.value))}
                disabled={!notificationsEnabled}
              >
                {LEAD_TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground mt-1.5">
                You'll always also get a notification right at the exact time, in addition to this advance notice.
              </p>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border">
              <div>
                <p className="text-sm font-medium">Push notifications on this device</p>
                <p className="text-xs text-muted-foreground">
                  {!isPushSupported()
                    ? "Not supported in this browser."
                    : pushSubscribed
                    ? "Enabled - this device will receive notifications even when no tab is open."
                    : "Grant permission to receive real notifications on this device, including when the app isn't open."}
                </p>
              </div>
              {isPushSupported() && (
                <Button
                  size="sm"
                  variant={pushSubscribed ? "secondary" : "outline"}
                  onClick={pushSubscribed ? handleDisablePush : requestBrowserNotifications}
                  disabled={pushBusy}
                >
                  {pushSubscribed ? "Disable" : "Enable"}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              This has to be enabled separately on each device you want notifications on (your phone, your laptop, etc.) - it's tied to the browser you enable it in, not your account as a whole.
            </p>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-4">Appearance</h2>
          <div className="flex gap-2">
            {["light", "dark", "system"].map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                  theme === t ? "border-primary bg-accent text-primary" : "border-border hover:bg-muted"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-4">Account</h2>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleSignOut}>Sign out</Button>
            <Button variant="destructive" onClick={() => showToast("Account deletion isn't enabled in this demo.", "error")}>
              Delete account
            </Button>
          </div>
        </Card>

        <Button onClick={handleSave} disabled={saving}>Save changes</Button>
      </div>
    </AppShell>
  );
}
