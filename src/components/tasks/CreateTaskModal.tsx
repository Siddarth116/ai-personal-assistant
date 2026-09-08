"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { localInputToIso, isoToLocalInput } from "@/lib/utils/clientDate";
import { useSession } from "@/components/layout/SessionProvider";
import type { Task } from "@/lib/db/schema";

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** When provided, the modal edits this task instead of creating a new one. */
  task?: Task;
}

export function CreateTaskModal({ open, onClose, onSaved, task }: TaskModalProps) {
  const { user } = useSession();
  const { showToast } = useToast();
  const timezone = user?.timezone ?? "Asia/Kolkata";
  const isEditing = !!task;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [loading, setLoading] = useState(false);

  // Populate fields whenever the modal is opened - either blank for a new
  // task, or pre-filled from the task being edited.
  useEffect(() => {
    if (!open) return;
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      if (task.dueAt) {
        const local = isoToLocalInput(task.dueAt, timezone);
        const [d, t] = local.split("T");
        setDueDate(d);
        setDueTime(t);
      } else {
        setDueDate("");
        setDueTime("");
      }
      setPriority(task.priority);
    } else {
      setTitle("");
      setDescription("");
      setDueDate("");
      setDueTime("");
      setPriority("MEDIUM");
    }
  }, [open, task, timezone]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const dueAt = dueDate ? localInputToIso(`${dueDate}T${dueTime || "23:59"}`, timezone) : undefined;
      const body = { title, description: description || undefined, dueAt, priority, timezone };

      const res = await fetch(isEditing ? `/api/tasks/${task!.id}` : "/api/tasks", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || `Unable to ${isEditing ? "save" : "create"} task.`, "error");
        return;
      }
      showToast(isEditing ? "Task updated." : "Task created successfully.");
      onSaved();
      onClose();
    } catch {
      showToast(`Unable to ${isEditing ? "save" : "create"} task.`, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Edit Task" : "New Task"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Finish assignment" />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <Label>Due time</Label>
            <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} disabled={!dueDate} />
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
          <Button type="submit" disabled={loading}>{isEditing ? "Save Changes" : "Create Task"}</Button>
        </div>
      </form>
    </Modal>
  );
}
