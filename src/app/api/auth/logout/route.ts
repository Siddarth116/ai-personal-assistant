import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/utils/apiResponse";

export const POST = withErrorHandling("auth/logout", async () => {
  await destroySession();
  return NextResponse.json({ success: true });
});
