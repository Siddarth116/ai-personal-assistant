import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/utils/apiResponse";
import { nowIso } from "@/lib/utils/date";

export const GET = withErrorHandling("conversations/list", async () => {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, user.id))
    .orderBy(desc(conversations.updatedAt))
    .all();
  return NextResponse.json({ conversations: rows });
});

export const POST = withErrorHandling("conversations/create", async (req: Request) => {
  const user = await requireUser();
  const body = await req.json().catch(() => ({}));
  const id = nanoid();
  const now = nowIso();
  await db.insert(conversations)
    .values({ id, userId: user.id, title: body.title || "New conversation", createdAt: now, updatedAt: now })
    .run();
  const row = await db.select().from(conversations).where(eq(conversations.id, id)).get();
  return NextResponse.json({ conversation: row }, { status: 201 });
});
