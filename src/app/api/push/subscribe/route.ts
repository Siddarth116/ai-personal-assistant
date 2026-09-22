import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { withErrorHandling, AppError } from "@/lib/utils/apiResponse";
import { z } from "zod";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  label: z.string().max(200).optional(),
});

export const POST = withErrorHandling("push/subscribe", async (req: Request) => {
  const user = await requireUser();
  const body = await req.json();
  const data = subscribeSchema.parse(body);

  // Re-subscribing with the same endpoint (e.g. the browser rotated keys)
  // should replace the old row rather than error on the unique constraint.
  const existing = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, data.endpoint)).get();

  if (existing) {
    if (existing.userId !== user.id) {
      // The endpoint moved to a different account (e.g. someone signed out
      // and a different user signed in on the same device/browser profile).
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, data.endpoint)).run();
    } else {
      await db
        .update(pushSubscriptions)
        .set({ p256dh: data.keys.p256dh, authKey: data.keys.auth, label: data.label ?? existing.label })
        .where(eq(pushSubscriptions.id, existing.id))
        .run();
      return NextResponse.json({ success: true });
    }
  }

  await db
    .insert(pushSubscriptions)
    .values({
      id: nanoid(),
      userId: user.id,
      endpoint: data.endpoint,
      p256dh: data.keys.p256dh,
      authKey: data.keys.auth,
      label: data.label ?? null,
    })
    .run();

  return NextResponse.json({ success: true }, { status: 201 });
});

export const DELETE = withErrorHandling("push/unsubscribe", async (req: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get("endpoint");
  if (!endpoint) {
    throw new AppError("endpoint query parameter is required", 422);
  }

  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, user.id)))
    .run();

  return NextResponse.json({ success: true });
});
