import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/utils/apiResponse";
import * as eventService from "@/lib/services/eventService";

export const GET = withErrorHandling("events/get", async (_req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const event = await eventService.getEvent(user.id, params.id);
  return NextResponse.json({ event });
});

export const PATCH = withErrorHandling("events/update", async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await req.json();
  const event = await eventService.updateEvent(user.id, params.id, body);
  return NextResponse.json({ event });
});

export const DELETE = withErrorHandling("events/delete", async (_req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  await eventService.deleteEvent(user.id, params.id);
  return NextResponse.json({ success: true });
});
