"use client";

import { CalendarClock, ListTodo, Bell, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { fmtTime } from "@/lib/utils/clientDate";
import type { ScheduleItem } from "@/lib/services/scheduleService";

const TYPE_META: Record<string, { icon: any; label: string; color: string }> = {
  EVENT: { icon: CalendarClock, label: "Event", color: "text-primary" },
  TASK: { icon: ListTodo, label: "Task", color: "text-amber-500" },
  REMINDER: { icon: Bell, label: "Reminder", color: "text-rose-500" },
};

export function TimelineItem({ item, timezone, hour24 }: { item: ScheduleItem; timezone: string; hour24?: boolean }) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;

  return (
    <div className="flex gap-4 py-3">
      <div className="w-16 shrink-0 text-right pt-0.5">
        <span className="text-sm font-medium text-muted-foreground">{fmtTime(item.time, timezone, hour24)}</span>
      </div>
      <div className="flex flex-col items-center">
        <div className={`h-8 w-8 rounded-full bg-muted flex items-center justify-center ${meta.color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="w-px flex-1 bg-border mt-1" />
      </div>
      <div className="flex-1 pb-2 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={item.type === "EVENT" ? undefined : undefined} className="bg-muted text-muted-foreground">
            {meta.label}
          </Badge>
          <Badge tone={item.status}>{item.status.replace("_", " ")}</Badge>
          {item.priority && <Badge tone={item.priority}>{item.priority}</Badge>}
        </div>
        <p className="font-medium mt-1 truncate">{item.title}</p>
        {item.description && <p className="text-sm text-muted-foreground truncate">{item.description}</p>}
        {item.location && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3" /> {item.location}
          </p>
        )}
        {item.endTime && (
          <p className="text-xs text-muted-foreground mt-0.5">
            until {fmtTime(item.endTime, timezone, hour24)}
          </p>
        )}
      </div>
    </div>
  );
}
