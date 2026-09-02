"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CalendarClock, ListTodo, Bell, CheckCircle2, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useSession } from "@/components/layout/SessionProvider";
import { Card } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, Skeleton } from "@/components/ui/ErrorState";
import { TimelineItem } from "@/components/schedule/TimelineItem";
import type { ScheduleItem } from "@/lib/services/scheduleService";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user } = useSession();
  const [today, setToday] = useState<ScheduleItem[] | null>(null);
  const [upcoming, setUpcoming] = useState<ScheduleItem[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setToday(null);
    setUpcoming(null);
    try {
      const now = new Date();
      const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
      const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7); weekEnd.setHours(23, 59, 59, 999);

      const [todayRes, upcomingRes] = await Promise.all([
        fetch(`/api/schedule?start=${startOfDay.toISOString()}&end=${endOfDay.toISOString()}`),
        fetch(`/api/schedule?start=${startOfDay.toISOString()}&end=${weekEnd.toISOString()}`),
      ]);
      if (!todayRes.ok || !upcomingRes.ok) throw new Error("Failed to load");
      const todayData = await todayRes.json();
      const upcomingData = await upcomingRes.json();
      setToday(todayData.items);
      setUpcoming(upcomingData.items);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const completedToday = today?.filter((i) => i.status === "COMPLETED").length ?? 0;
  const pendingTasks = upcoming?.filter((i) => i.type === "TASK" && i.status === "PENDING").length ?? 0;
  const upcomingReminders = upcoming?.filter((i) => i.type === "REMINDER" && i.status === "PENDING").length ?? 0;

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">
          {greeting()}, {user?.name?.split(" ")[0] ?? ""}
        </h1>
        <p className="text-muted-foreground mt-1">Here&apos;s what&apos;s on your plate.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard icon={CalendarClock} label="Today's items" value={today?.length} />
        <SummaryCard icon={ListTodo} label="Pending tasks" value={pendingTasks} />
        <SummaryCard icon={Bell} label="Upcoming reminders" value={upcomingReminders} />
        <SummaryCard icon={CheckCircle2} label="Completed today" value={completedToday} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Today</h2>
            <Link href="/schedule" className="text-sm text-primary flex items-center gap-1">
              View schedule <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {error ? (
            <ErrorState onRetry={load} />
          ) : today === null ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : today.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No events today" description="Enjoy the free time, or ask the assistant to schedule something." />
          ) : (
            <div className="divide-y divide-border">
              {today.map((item) => (
                <TimelineItem key={`${item.type}-${item.id}`} item={item} timezone={user?.timezone ?? "Asia/Kolkata"} hour24={user?.hourFormat === 24} />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Upcoming (next 7 days)</h2>
          </div>
          {error ? (
            <ErrorState onRetry={load} />
          ) : upcoming === null ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : upcoming.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nothing coming up" description="Your week is wide open." />
          ) : (
            <div className="divide-y divide-border">
              {upcoming.slice(0, 8).map((item) => (
                <TimelineItem key={`${item.type}-${item.id}`} item={item} timezone={user?.timezone ?? "Asia/Kolkata"} hour24={user?.hourFormat === 24} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: any; label: string; value?: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-accent text-primary flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xl font-semibold leading-none">{value ?? "–"}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </div>
    </Card>
  );
}
