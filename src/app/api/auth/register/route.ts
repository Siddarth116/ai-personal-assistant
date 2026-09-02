import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { registerSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { withErrorHandling, AppError } from "@/lib/utils/apiResponse";
import { nowIso } from "@/lib/utils/date";

export const POST = withErrorHandling("auth/register", async (req: Request) => {
  const body = await req.json();
  const data = registerSchema.parse(body);

  const existing = await db.select().from(users).where(eq(users.email, data.email)).get();
  if (existing) {
    throw new AppError("An account with this email already exists", 409);
  }

  const passwordHash = await hashPassword(data.password);
  const id = nanoid();

  await db.insert(users)
    .values({
      id,
      name: data.name,
      email: data.email,
      passwordHash,
      timezone: "Asia/Kolkata",
      createdAt: nowIso(),
    })
    .run();

  await createSession(id);

  return NextResponse.json({
    user: { id, name: data.name, email: data.email, timezone: "Asia/Kolkata" },
  });
});
