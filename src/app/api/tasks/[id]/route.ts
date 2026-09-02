import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/utils/apiResponse";
import * as taskService from "@/lib/services/taskService";

export const GET = withErrorHandling("tasks/get", async (_req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const task = await taskService.getTask(user.id, params.id);
  return NextResponse.json({ task });
});

export const PATCH = withErrorHandling("tasks/update", async (req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await req.json();
  const task = await taskService.updateTask(user.id, params.id, body);
  return NextResponse.json({ task });
});

export const DELETE = withErrorHandling("tasks/delete", async (_req: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  await taskService.deleteTask(user.id, params.id);
  return NextResponse.json({ success: true });
});
