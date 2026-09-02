"use client";

import { useCallback, useEffect, useState } from "react";
import { ListTodo, Check, Trash2, Circle, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { QuickAdd } from "@/components/layout/QuickAdd";
import { useSession } from "@/components/layout/SessionProvider";
import { Card, Badge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState, Skeleton } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";
import { fmtDay } from "@/lib/utils/clientDate";
import type { Task } from "@/lib/db/schema";

export default function TasksPage() {
  const { user } = useSession();
  const { showToast } = useToast();
  const timezone = user?.timezone ?? "Asia/Kolkata";
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setTasks(data.tasks);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleComplete(task: Task) {
    const nextStatus: Task["status"] = task.status === "COMPLETED" ? "PENDING" : "COMPLETED";
    setTasks((prev) => prev?.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)) ?? prev);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error();
    } catch {
      showToast("Unable to update task.", "error");
      load();
    }
  }

  async function remove(task: Task) {
    setTasks((prev) => prev?.filter((t) => t.id !== task.id) ?? prev);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast("Task deleted.");
    } catch {
      showToast("Unable to delete task.", "error");
      load();
    }
  }

  if (error) {
    return (
      <AppShell title="Tasks">
        <ErrorState onRetry={load} />
      </AppShell>
    );
  }

  if (tasks === null) {
    return (
      <AppShell title="Tasks">
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </AppShell>
    );
  }

  const now = new Date();
  const isOverdue = (t: Task) => t.dueAt && t.status !== "COMPLETED" && t.status !== "CANCELLED" && new Date(t.dueAt) < now;
  const isToday = (t: Task) => t.dueAt && new Date(t.dueAt).toDateString() === now.toDateString();

  const overdue = tasks.filter((t) => isOverdue(t) && !isToday(t));
  const today = tasks.filter((t) => isToday(t) && t.status !== "COMPLETED");
  const upcoming = tasks.filter((t) => !isOverdue(t) && !isToday(t) && t.status !== "COMPLETED");
  const completed = tasks.filter((t) => t.status === "COMPLETED");

  return (
    <AppShell title="Tasks">
      {tasks.length === 0 ? (
        <EmptyState icon={ListTodo} title="No tasks yet" description="Create your first task to get started." actionLabel="New Task" onAction={() => setQuickOpen(true)} />
      ) : (
        <div className="space-y-8">
          <TaskSection title="Overdue" tasks={overdue} timezone={timezone} onToggle={toggleComplete} onDelete={remove} accent="text-destructive" />
          <TaskSection title="Today" tasks={today} timezone={timezone} onToggle={toggleComplete} onDelete={remove} />
          <TaskSection title="Upcoming" tasks={upcoming} timezone={timezone} onToggle={toggleComplete} onDelete={remove} />
          <TaskSection title="Completed" tasks={completed} timezone={timezone} onToggle={toggleComplete} onDelete={remove} />
        </div>
      )}
      <QuickAdd onCreated={load} />
    </AppShell>
  );
}

function TaskSection({
  title,
  tasks,
  timezone,
  onToggle,
  onDelete,
  accent,
}: {
  title: string;
  tasks: Task[];
  timezone: string;
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
  accent?: string;
}) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <h2 className={`text-sm font-semibold uppercase tracking-wide mb-3 ${accent ?? "text-muted-foreground"}`}>
        {title} <span className="text-muted-foreground normal-case font-normal">({tasks.length})</span>
      </h2>
      <div className="space-y-2">
        {tasks.map((task) => (
          <Card key={task.id} className="p-4 flex items-start gap-3">
            <button onClick={() => onToggle(task)} className="mt-0.5 text-primary shrink-0">
              {task.status === "COMPLETED" ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`font-medium ${task.status === "COMPLETED" ? "line-through text-muted-foreground" : ""}`}>
                {task.title}
              </p>
              {task.description && <p className="text-sm text-muted-foreground mt-0.5">{task.description}</p>}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge tone={task.priority}>{task.priority}</Badge>
                {task.dueAt && <span className="text-xs text-muted-foreground">Due {fmtDay(task.dueAt, timezone)}</span>}
              </div>
            </div>
            <button onClick={() => onDelete(task)} className="text-muted-foreground hover:text-destructive shrink-0">
              <Trash2 className="h-4 w-4" />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
