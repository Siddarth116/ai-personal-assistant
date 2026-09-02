import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/utils/apiResponse";
import { isAiConfigured } from "@/lib/ai/client";

export const GET = withErrorHandling("auth/me", async () => {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null, aiConfigured: isAiConfigured() });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      timezone: user.timezone,
      hourFormat: user.hourFormat,
      weekStartsOn: user.weekStartsOn,
      theme: user.theme,
    },
    aiConfigured: isAiConfigured(),
  });
});
