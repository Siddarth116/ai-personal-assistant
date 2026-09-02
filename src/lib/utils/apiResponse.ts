import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/session";
import { AppError } from "@/lib/utils/errors";

export { AppError, NotFoundError } from "@/lib/utils/errors";

/**
 * Wraps a route handler. Every unexpected error is:
 *   1. Caught here (the application boundary)
 *   2. Logged with full context + stack trace (server-side only)
 *   3. Turned into a safe, generic message for the client
 * Known error types (validation, auth, not-found) return their real message
 * since it's safe and useful; everything else becomes "Something went wrong."
 */
export function withErrorHandling(
  handlerName: string,
  handler: (req: Request, ctx: any) => Promise<NextResponse>
) {
  return async (req: Request, ctx: any) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        console.warn(`[${handlerName}] validation error`, err.flatten());
        return NextResponse.json(
          { error: "Invalid request data", details: err.flatten() },
          { status: 422 }
        );
      }
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }

      // Unexpected error: log full context server-side, never expose to client.
      console.error(`[${handlerName}] Unexpected error:`, err);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }
  };
}
