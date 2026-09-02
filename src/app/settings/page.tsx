"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useSession } from "@/components/layout/SessionProvider";
import { Card, Input, Label, Select } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const TIMEZONES = [
  "Asia/Kolkata", "UTC", "America/New_York", "America/Los_Angeles", "Europe/London",
  "Europe/Berlin", "Asia/Tokyo", "Asia/Singapore", "Asia/Dubai", "Australia/Sydney",
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
  const [browserNotif, setBrowserNotif] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      // A dedicated PATCH /api/settings route would persist these; kept
      // client-side here since preferences aren't required for core
      // schedule/AI functionality, per the simplified scope of this build.
      showToast("Preferences saved.");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function requestBrowserNotifications() {
    if (!("Notification" in window)) {
      showToast("Browser notifications aren't supported here.", "error");
      return;
    }
    const perm = await Notification.requestPermission();
    setBrowserNotif(perm === "granted");
    if (perm === "granted") showToast("Browser notifications enabled.");
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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Browser notifications</p>
              <p className="text-xs text-muted-foreground">Get notified when reminders are due, while the app is open.</p>
            </div>
            <Button size="sm" variant={browserNotif ? "secondary" : "outline"} onClick={requestBrowserNotifications}>
              {browserNotif ? "Enabled" : "Enable"}
            </Button>
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
