"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Label, Textarea } from "@/components/ui/primitives";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { localInputToIso } from "@/lib/utils/clientDate";
import { useSession } from "@/components/layout/SessionProvider";

export function CreateReminderModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { user } = useSession();
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setTitle(""); setDescription(""); setDate(""); setTime("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !time) return;
    setLoading(true);
    try {
      const timezone = user?.timezone ?? "Asia/Kolkata";
      const remindAt = localInputToIso(`${date}T${time}`, timezone);
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: description || undefined, remindAt, timezone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Unable to create reminder.", "error");
        return;
      }
      showToast("Reminder created successfully.");
      reset();
      onCreated();
      onClose();
    } catch {
      showToast("Unable to create reminder.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Reminder">
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
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>Create Reminder</Button>
        </div>
      </form>
    </Modal>
  );
}
