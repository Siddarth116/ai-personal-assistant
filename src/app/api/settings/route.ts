import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/utils/apiResponse";
import { updateSettingsSchema } from "@/lib/validations";

export const PATCH = withErrorHandling("settings/update", async (req: Request) => {
  const user = await requireUser();
  const body = await req.json();
  const data = updateSettingsSchema.parse(body);

  await db.update(users).set(data).where(eq(users.id, user.id)).run();

  const updated = await db.select().from(users).where(eq(users.id, user.id)).get();

  return NextResponse.json({
    user: {
      id: updated!.id,
      name: updated!.name,
      email: updated!.email,
      timezone: updated!.timezone,
      hourFormat: updated!.hourFormat,
      weekStartsOn: updated!.weekStartsOn,
      theme: updated!.theme,
      notificationsEnabled: updated!.notificationsEnabled,
      notificationLeadMinutes: updated!.notificationLeadMinutes,
    },
  });
});
