"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { localInputToIso, isoToLocalInput } from "@/lib/utils/clientDate";
import { useSession } from "@/components/layout/SessionProvider";
import type { Reminder } from "@/lib/db/schema";

interface ReminderModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** When provided, the modal edits this reminder instead of creating a new one. */
  reminder?: Reminder;
}

export function CreateReminderModal({ open, onClose, onSaved, reminder }: ReminderModalProps) {
  const { user } = useSession();
  const { showToast } = useToast();
  const timezone = user?.timezone ?? "Asia/Kolkata";
  const isEditing = !!reminder;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (reminder) {
      setTitle(reminder.title);
      setDescription(reminder.description ?? "");
      const local = isoToLocalInput(reminder.remindAt, timezone);
      const [d, t] = local.split("T");
      setDate(d);
      setTime(t);
      setPriority(reminder.priority);
    } else {
      setTitle("");
      setDescription("");
      setDate("");
      setTime("");
      setPriority("MEDIUM");
    }
  }, [open, reminder, timezone]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !time) return;
    setLoading(true);
    try {
      const remindAt = localInputToIso(`${date}T${time}`, timezone);
      const body = { title, description: description || undefined, remindAt, priority, timezone };

      const res = await fetch(isEditing ? `/api/reminders/${reminder!.id}` : "/api/reminders", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || `Unable to ${isEditing ? "save" : "create"} reminder.`, "error");
        return;
      }
      showToast(isEditing ? "Reminder updated." : "Reminder created successfully.");
      onSaved();
      onClose();
    } catch {
      showToast(`Unable to ${isEditing ? "save" : "create"} reminder.`, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit Reminder" : "New Reminder"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call Mom" />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Date</Label>
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Time</Label>
            <Input type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Priority</Label>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </Select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>{isEditing ? "Save Changes" : "Create Reminder"}</Button>
        </div>
      </form>
    </Modal>
  );
}
