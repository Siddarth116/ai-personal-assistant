import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { withErrorHandling, AppError } from "@/lib/utils/apiResponse";
import { isPushConfigured } from "@/lib/push/webPushClient";

export const GET = withErrorHandling("push/vapid-public-key", async () => {
  await requireUser(); // no need to expose this to unauthenticated requests
  if (!isPushConfigured()) {
    throw new AppError("Push notifications are not configured on this server.", 503);
  }
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});
