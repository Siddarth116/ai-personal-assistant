"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { MonthGrid } from "@/components/schedule/MonthGrid";
import { groupByDay } from "@/lib/utils/clientDate";
import type { ScheduleItem } from "@/lib/services/scheduleService";

type ViewMode = "day" | "week" | "month";

// Status options are type-aware: never let the UI request an invalid
// status/type combination (e.g. TASK + CONFIRMED).
const STATUS_OPTIONS: Record<string, string[]> = {
  ALL: [],
  EVENT: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"],
  TASK: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
  REMINDER: ["PENDING", "COMPLETED", "DISMISSED", "CANCELLED"],
};

function monthGridRange(anchor: Date): { start: Date; end: Date } {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lastOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);

  const startDow = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
  const start = new Date(firstOfMonth);
  start.setDate(start.getDate() - startDow);
  start.setHours(0, 0, 0, 0);

  const endDow = (lastOfMonth.getDay() + 6) % 7;
  const end = new Date(lastOfMonth);
  end.setDate(end.getDate() + (6 - endDow));
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

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

  // Guards against out-of-order responses: e.g. Month view's heavier
  // full-grid query can still be in flight when the user clicks a single
  // day (a much smaller, faster query). Without this, the slow month query
  // can resolve AFTER the fast day query and overwrite the correct result
  // with stale, wider-range data. Only the response matching the most
  // recently issued request is ever applied to state.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setError(false);
    setItems(null);
    try {
      let start: Date, end: Date;
      if (view === "day") {
        start = new Date(anchor); start.setHours(0, 0, 0, 0);
        end = new Date(anchor); end.setHours(23, 59, 59, 999);
      } else if (view === "week") {
        start = new Date(anchor);
        const diffToMonday = (start.getDay() + 6) % 7;
        start.setDate(start.getDate() - diffToMonday);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      } else {
        ({ start, end } = monthGridRange(anchor));
      }

      const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
      if (type !== "ALL") params.set("types", type);
      if (status) params.set("status", status);
      if (priority) params.set("priority", priority);
      if (search) params.set("search", search);

      const res = await fetch(`/api/schedule?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load schedule");
      const data = await res.json();
      if (requestId !== requestIdRef.current) return; // a newer request has since been issued - discard this stale result
      setItems(data.items);
    } catch {
      if (requestId === requestIdRef.current) setError(true);
    }
  }, [anchor, view, type, status, priority, search]);

  useEffect(() => {
    load();
  }, [load]);

  function shift(dir: 1 | -1) {
    const next = new Date(anchor);
    if (view === "day") next.setDate(next.getDate() + dir);
    else if (view === "week") next.setDate(next.getDate() + dir * 7);
    else next.setMonth(next.getMonth() + dir);
    setItems(null); // clear synchronously so a stale, differently-shaped dataset never briefly renders under the new anchor
    setAnchor(next);
  }

  function selectDayFromGrid(date: Date) {
    setItems(null); // clear synchronously - otherwise the whole month's items would flash under the "day" view for one frame
    setAnchor(date);
    setView("day");
  }

  function goToToday() {
    setItems(null);
    setAnchor(new Date());
  }

  function changeView(v: ViewMode) {
    setItems(null);
    setView(v);
  }

  const rangeLabel =
    view === "day"
      ? (() => {
          const startOfDay = new Date(anchor); startOfDay.setHours(0, 0, 0, 0);
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const diffDays = Math.round((startOfDay.getTime() - today.getTime()) / 86400000);
          const relative = diffDays === 0 ? "Today" : diffDays === 1 ? "Tomorrow" : diffDays === -1 ? "Yesterday" : null;
          const formatted = anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
          return relative ? `${relative} · ${formatted}` : formatted;
        })()
      : view === "week"
      ? (() => {
          const start = new Date(anchor);
          const day = start.getDay();
          start.setDate(start.getDate() - ((day + 6) % 7));
          const end = new Date(start);
          end.setDate(end.getDate() + 6);
          return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
        })()
      : anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <AppShell title="Schedule">
      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" onClick={() => shift(-1)} aria-label="Previous">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="secondary" onClick={goToToday}>Today</Button>
              <Button size="icon" variant="outline" onClick={() => shift(1)} aria-label="Next">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="font-medium ml-2">{rangeLabel}</span>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {(["day", "week", "month"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => changeView(v)}
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
            <Select className="w-36" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">Any priority</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </div>
        </Card>

        <Card className={view === "month" ? "p-4" : "p-5"}>
          {error ? (
            <ErrorState onRetry={load} />
          ) : items === null ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : view === "month" ? (
            <MonthGrid anchor={anchor} items={items} timezone={timezone} onSelectDay={selectDayFromGrid} />
          ) : items.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No items in this range" description="Try a different date range or clear your filters." />
          ) : view === "week" ? (
            <div>
              {groupByDay(items, timezone).map((group) => (
                <div key={group.key}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-4 pb-1 first:pt-0">
                    {group.label}
                  </p>
                  <div className="divide-y divide-border">
                    {group.items.map((item) => (
                      <TimelineItem key={`${item.type}-${item.id}`} item={item} timezone={timezone} hour24={hour24} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
