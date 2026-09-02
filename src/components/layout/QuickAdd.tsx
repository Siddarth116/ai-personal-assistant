"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, CalendarClock, ListTodo, Bell, Bot } from "lucide-react";
import { CreateEventModal } from "@/components/events/CreateEventModal";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { CreateReminderModal } from "@/components/reminders/CreateReminderModal";

export function QuickAdd({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<"event" | "task" | "reminder" | null>(null);

  function handleCreated() {
    onCreated?.();
    router.refresh();
  }

  return (
    <>
      <div className="fixed bottom-20 md:bottom-6 right-6 z-40">
        <div className="relative">
          {menuOpen && (
            <div className="absolute bottom-14 right-0 w-48 rounded-xl border border-border bg-card shadow-lg py-1.5 mb-1">
              <MenuItem icon={CalendarClock} label="New Event" onClick={() => { setModal("event"); setMenuOpen(false); }} />
              <MenuItem icon={ListTodo} label="New Task" onClick={() => { setModal("task"); setMenuOpen(false); }} />
              <MenuItem icon={Bell} label="New Reminder" onClick={() => { setModal("reminder"); setMenuOpen(false); }} />
              <MenuItem icon={Bot} label="Ask AI" onClick={() => { setMenuOpen(false); router.push("/assistant"); }} />
            </div>
          )}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-transform"
            style={{ transform: menuOpen ? "rotate(45deg)" : "none" }}
            aria-label="Quick add"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </div>

      <CreateEventModal open={modal === "event"} onClose={() => setModal(null)} onCreated={handleCreated} />
      <CreateTaskModal open={modal === "task"} onClose={() => setModal(null)} onCreated={handleCreated} />
      <CreateReminderModal open={modal === "reminder"} onClose={() => setModal(null)} onCreated={handleCreated} />
    </>
  );
}

function MenuItem({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-4 py-2 text-sm hover:bg-muted transition-colors"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </button>
  );
}
