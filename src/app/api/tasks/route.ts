import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/utils/apiResponse";
import * as taskService from "@/lib/services/taskService";

export const GET = withErrorHandling("tasks/list", async (req: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const priority = searchParams.get("priority") ?? undefined;
  const tasks = await taskService.listTasks(user.id, { status, priority });
  return NextResponse.json({ tasks });
});

export const POST = withErrorHandling("tasks/create", async (req: Request) => {
  const user = await requireUser();
  const body = await req.json();
  const task = await taskService.createTask(user.id, { ...body, timezone: body.timezone ?? user.timezone });
  return NextResponse.json({ task }, { status: 201 });
});
