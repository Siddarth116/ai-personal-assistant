import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/utils/apiResponse";
import * as reminderService from "@/lib/services/reminderService";

export const GET = withErrorHandling("reminders/get", async (_req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const reminder = await reminderService.getReminder(user.id, params.id);
  return NextResponse.json({ reminder });
});

export const PATCH = withErrorHandling("reminders/update", async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await req.json();
  const reminder = await reminderService.updateReminder(user.id, params.id, body);
  return NextResponse.json({ reminder });
});

export const DELETE = withErrorHandling("reminders/delete", async (_req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  await reminderService.deleteReminder(user.id, params.id);
  return NextResponse.json({ success: true });
});
