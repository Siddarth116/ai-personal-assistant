import { NextResponse } from "next/server";
import { and, eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { withErrorHandling, NotFoundError } from "@/lib/utils/apiResponse";
import { nowIso } from "@/lib/utils/date";

async function ownedConversation(userId: string, id: string) {
  const row = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .get();
  if (!row) throw new NotFoundError("Conversation not found");
  return row;
}

export const GET = withErrorHandling(
  "conversations/get",
  async (_req: Request, { params }: { params: { id: string } }) => {
    const user = await requireUser();
    const conversation = await ownedConversation(user.id, params.id);
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(asc(messages.createdAt))
      .all();
    return NextResponse.json({ conversation, messages: msgs });
  }
);

export const PATCH = withErrorHandling(
  "conversations/update",
  async (req: Request, { params }: { params: { id: string } }) => {
    const user = await requireUser();
    await ownedConversation(user.id, params.id);
    const body = await req.json();
    await db.update(conversations)
      .set({ title: body.title, updatedAt: nowIso() })
      .where(and(eq(conversations.id, params.id), eq(conversations.userId, user.id)))
      .run();
    const row = await db.select().from(conversations).where(eq(conversations.id, params.id)).get();
    return NextResponse.json({ conversation: row });
  }
);

export const DELETE = withErrorHandling(
  "conversations/delete",
  async (_req: Request, { params }: { params: { id: string } }) => {
    const user = await requireUser();
    await ownedConversation(user.id, params.id);
    await db.delete(conversations).where(and(eq(conversations.id, params.id), eq(conversations.userId, user.id))).run();
    return NextResponse.json({ success: true });
  }
);
