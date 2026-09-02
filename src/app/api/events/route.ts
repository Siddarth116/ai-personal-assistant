import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/utils/apiResponse";
import * as eventService from "@/lib/services/eventService";

export const GET = withErrorHandling("events/list", async (req: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const priority = searchParams.get("priority") ?? undefined;
  const events = await eventService.listEvents(user.id, { status, priority });
  return NextResponse.json({ events });
});

export const POST = withErrorHandling("events/create", async (req: Request) => {
  const user = await requireUser();
  const body = await req.json();
  const event = await eventService.createEvent(user.id, { ...body, timezone: body.timezone ?? user.timezone });
  return NextResponse.json({ event }, { status: 201 });
});
