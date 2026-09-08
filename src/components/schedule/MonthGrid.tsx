"use client";

import { DateTime } from "luxon";
import { cn } from "@/lib/utils/cn";
import { dayKey } from "@/lib/utils/clientDate";
import type { ScheduleItem } from "@/lib/services/scheduleService";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TYPE_DOT: Record<string, string> = {
  EVENT: "bg-primary",
  TASK: "bg-amber-500",
  REMINDER: "bg-rose-500",
};

interface MonthGridProps {
  anchor: Date;
  items: ScheduleItem[];
  timezone: string;
  onSelectDay: (date: Date) => void;
}

export function MonthGrid({ anchor, items, timezone, onSelectDay }: MonthGridProps) {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lastOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);

  const startDow = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - startDow);

  const endDow = (lastOfMonth.getDay() + 6) % 7;
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + (6 - endDow));

  const days: Date[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  // Bucket items by day key (in the user's timezone) for quick lookup per cell.
  const itemsByDay = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const key = dayKey(item.time, timezone);
    if (!itemsByDay.has(key)) itemsByDay.set(key, []);
    itemsByDay.get(key)!.push(item);
  }

  const todayKey = DateTime.now().setZone(timezone).toFormat("yyyy-LL-dd");

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = DateTime.fromJSDate(day).toFormat("yyyy-LL-dd");
          const dayItems = itemsByDay.get(key) ?? [];
          const isCurrentMonth = day.getMonth() === anchor.getMonth();
          const isToday = key === todayKey;
          const typesPresent = Array.from(new Set(dayItems.map((i) => i.type))).slice(0, 3);

          return (
            <button
              key={key}
              onClick={() => onSelectDay(day)}
              className={cn(
                "aspect-square rounded-lg border p-1.5 flex flex-col items-start gap-1 text-left transition-colors hover:bg-muted",
                isCurrentMonth ? "border-border" : "border-transparent",
                !isCurrentMonth && "opacity-40"
              )}
            >
              <span
                className={cn(
                  "text-xs h-5 w-5 flex items-center justify-center rounded-full",
                  isToday ? "bg-primary text-primary-foreground font-semibold" : "text-foreground"
                )}
              >
                {day.getDate()}
              </span>
              {dayItems.length > 0 && (
                <div className="flex items-center gap-0.5 flex-wrap">
                  {typesPresent.map((t) => (
                    <span key={t} className={cn("h-1.5 w-1.5 rounded-full", TYPE_DOT[t])} />
                  ))}
                  {dayItems.length > 3 && (
                    <span className="text-[10px] text-muted-foreground leading-none">+{dayItems.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
