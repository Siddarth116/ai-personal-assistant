import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { withErrorHandling } from "@/lib/utils/apiResponse";
import { getSchedule } from "@/lib/services/scheduleService";
import { scheduleQuerySchema } from "@/lib/validations";
import { toUtcIso } from "@/lib/utils/date";

export const GET = withErrorHandling("schedule/get", async (req: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);

  const typesParam = searchParams.get("types");
  const parsed = scheduleQuerySchema.parse({
    start: searchParams.get("start"),
    end: searchParams.get("end"),
    types: typesParam ? typesParam.split(",") : undefined,
    status: searchParams.get("status") ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
    search: searchParams.get("search") ?? undefined,
  });

  const items = await getSchedule(user.id, {
    ...parsed,
    start: toUtcIso(parsed.start),
    end: toUtcIso(parsed.end),
  });

  return NextResponse.json({ items });
});
