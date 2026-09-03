"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Trash2, Check, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { QuickAdd } from "@/components/layout/QuickAdd";
import { useSession } from "@/components/layout/SessionProvider";
import { Card, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, Skeleton } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";
import { fmt } from "@/lib/utils/clientDate";
import type { Reminder } from "@/lib/db/schema";

export default function RemindersPage() {
  const { user } = useSession();
  const { showToast } = useToast();
  const timezone = user?.timezone ?? "Asia/Kolkata";
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [error, setError] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/reminders");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setReminders(data.reminders);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(reminder: Reminder, status: Reminder["status"]) {
    setReminders((prev) => prev?.map((r) => (r.id === reminder.id ? { ...r, status } : r)) ?? prev);
    try {
      const res = await fetch(`/api/reminders/${reminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      showToast("Unable to update reminder.", "error");
      load();
    }
  }

  async function remove(reminder: Reminder) {
    setReminders((prev) => prev?.filter((r) => r.id !== reminder.id) ?? prev);
    try {
      const res = await fetch(`/api/reminders/${reminder.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast("Reminder deleted.");
    } catch {
      showToast("Unable to delete reminder.", "error");
      load();
    }
  }

  if (error) {
    return (
      <AppShell title="Reminders">
        <ErrorState onRetry={load} />
      </AppShell>
    );
  }

  if (reminders === null) {
    return (
      <AppShell title="Reminders">
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </AppShell>
    );
  }

  const now = new Date();
  const upcoming = reminders.filter((r) => r.status === "PENDING" && new Date(r.remindAt) >= now);
  const today = upcoming.filter((r) => new Date(r.remindAt).toDateString() === now.toDateString());
  const later = upcoming.filter((r) => new Date(r.remindAt).toDateString() !== now.toDateString());
  const completed = reminders.filter((r) => r.status === "COMPLETED");
  const dismissed = reminders.filter((r) => r.status === "DISMISSED");

  return (
    <AppShell title="Reminders">
      {reminders.length === 0 ? (
        <EmptyState icon={Bell} title="No reminders scheduled" description="Create a reminder so nothing slips through the cracks." actionLabel="New Reminder" onAction={() => setQuickOpen(true)} />
      ) : (
        <div className="space-y-8">
          <ReminderSection title="Today" reminders={today} timezone={timezone} onComplete={(r) => updateStatus(r, "COMPLETED")} onDismiss={(r) => updateStatus(r, "DISMISSED")} onDelete={remove} />
          <ReminderSection title="Upcoming" reminders={later} timezone={timezone} onComplete={(r) => updateStatus(r, "COMPLETED")} onDismiss={(r) => updateStatus(r, "DISMISSED")} onDelete={remove} />
          <ReminderSection title="Completed" reminders={completed} timezone={timezone} onDelete={remove} />
          <ReminderSection title="Dismissed" reminders={dismissed} timezone={timezone} onDelete={remove} />
        </div>
      )}
      <QuickAdd onCreated={load} />
    </AppShell>
  );
}

function ReminderSection({
  title,
  reminders,
  timezone,
  onComplete,
  onDismiss,
  onDelete,
}: {
  title: string;
  reminders: Reminder[];
  timezone: string;
  onComplete?: (r: Reminder) => void;
  onDismiss?: (r: Reminder) => void;
  onDelete: (r: Reminder) => void;
}) {
  if (reminders.length === 0) return null;
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide mb-3 text-muted-foreground">
        {title} <span className="normal-case font-normal">({reminders.length})</span>
      </h2>
      <div className="space-y-2">
        {reminders.map((reminder) => (
          <Card key={reminder.id} className="p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
              <Bell className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{reminder.title}</p>
              {reminder.description && <p className="text-sm text-muted-foreground mt-0.5">{reminder.description}</p>}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge tone={reminder.status}>{reminder.status}</Badge>
                <Badge tone={reminder.priority}>{reminder.priority}</Badge>
                <span className="text-xs text-muted-foreground">{fmt(reminder.remindAt, timezone, "ccc, d LLL, h:mm a")}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onComplete && (
                <Button size="icon" variant="ghost" onClick={() => onComplete(reminder)} title="Complete">
                  <Check className="h-4 w-4" />
                </Button>
              )}
              {onDismiss && (
                <Button size="icon" variant="ghost" onClick={() => onDismiss(reminder)} title="Dismiss">
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => onDelete(reminder)} title="Delete">
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
