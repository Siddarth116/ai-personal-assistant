import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { loginSchema } from "@/lib/validations";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { withErrorHandling, AppError } from "@/lib/utils/apiResponse";

export const POST = withErrorHandling("auth/login", async (req: Request) => {
  const body = await req.json();
  const data = loginSchema.parse(body);

  const user = await db.select().from(users).where(eq(users.email, data.email)).get();
  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const valid = await verifyPassword(data.password, user.passwordHash);
  if (!valid) {
    throw new AppError("Invalid email or password", 401);
  }

  await createSession(user.id);

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, timezone: user.timezone },
  });
});
