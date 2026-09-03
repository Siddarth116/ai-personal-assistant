import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/utils/apiResponse";
import * as reminderService from "@/lib/services/reminderService";

export const GET = withErrorHandling("reminders/list", async (req: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const priority = searchParams.get("priority") ?? undefined;
  const reminders = await reminderService.listReminders(user.id, { status, priority });
  return NextResponse.json({ reminders });
});

export const POST = withErrorHandling("reminders/create", async (req: Request) => {
  const user = await requireUser();
  const body = await req.json();
  const reminder = await reminderService.createReminder(user.id, {
    ...body,
    timezone: body.timezone ?? user.timezone,
  });
  return NextResponse.json({ reminder }, { status: 201 });
});
