"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarClock, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { QuickAdd } from "@/components/layout/QuickAdd";
import { useSession } from "@/components/layout/SessionProvider";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, Skeleton } from "@/components/ui/ErrorState";
import { TimelineItem } from "@/components/schedule/TimelineItem";
import type { ScheduleItem } from "@/lib/services/scheduleService";

type ViewMode = "day" | "week";

// Status options are type-aware: never let the UI request an invalid
// status/type combination (e.g. TASK + CONFIRMED).
const STATUS_OPTIONS: Record<string, string[]> = {
  ALL: [],
  EVENT: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"],
  TASK: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
  REMINDER: ["PENDING", "COMPLETED", "DISMISSED", "CANCELLED"],
};

export default function SchedulePage() {
  const { user } = useSession();
  const timezone = user?.timezone ?? "Asia/Kolkata";
  const hour24 = user?.hourFormat === 24;

  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState<ViewMode>("day");
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");

  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setItems(null);
    try {
      const start = new Date(anchor);
      const end = new Date(anchor);
      if (view === "day") {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      } else {
        const day = start.getDay();
        const diffToMonday = (day + 6) % 7;
        start.setDate(start.getDate() - diffToMonday);
        start.setHours(0, 0, 0, 0);
        end.setTime(start.getTime());
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      }

      const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
      if (type !== "ALL") params.set("types", type);
      if (status) params.set("status", status);
      if (priority) params.set("priority", priority);
      if (search) params.set("search", search);

      const res = await fetch(`/api/schedule?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load schedule");
      const data = await res.json();
      setItems(data.items);
    } catch {
      setError(true);
    }
  }, [anchor, view, type, status, priority, search]);

  useEffect(() => {
    load();
  }, [load]);

  function shift(dir: 1 | -1) {
    const next = new Date(anchor);
    next.setDate(next.getDate() + dir * (view === "day" ? 1 : 7));
    setAnchor(next);
  }

  const rangeLabel =
    view === "day"
      ? anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
      : (() => {
          const start = new Date(anchor);
          const day = start.getDay();
          start.setDate(start.getDate() - ((day + 6) % 7));
          const end = new Date(start);
          end.setDate(end.getDate() + 6);
          return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
        })();

  return (
    <AppShell title="Schedule">
      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" onClick={() => shift(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setAnchor(new Date())}>Today</Button>
              <Button size="icon" variant="outline" onClick={() => shift(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="font-medium ml-2">{rangeLabel}</span>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {(["day", "week"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 rounded-md text-sm font-medium capitalize transition-colors ${view === v ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search schedule..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              className="w-36"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setStatus("");
              }}
            >
              <option value="ALL">All types</option>
              <option value="EVENT">Events</option>
              <option value="TASK">Tasks</option>
              <option value="REMINDER">Reminders</option>
            </Select>
            <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} disabled={type === "ALL"}>
              <option value="">Any status</option>
              {STATUS_OPTIONS[type].map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </Select>
            <Select className="w-36" value={priority} onChange={(e) => setPriority(e.target.value)} disabled={type === "REMINDER"}>
              <option value="">Any priority</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </Select>
          </div>
        </Card>

        <Card className="p-5">
          {error ? (
            <ErrorState onRetry={load} />
          ) : items === null ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No items in this range" description="Try a different date range or clear your filters." />
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <TimelineItem key={`${item.type}-${item.id}`} item={item} timezone={timezone} hour24={hour24} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <QuickAdd onCreated={load} />
    </AppShell>
  );
}
