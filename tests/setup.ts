import { beforeAll } from "vitest";
import path from "path";
import { db } from "@/lib/db";
import { migrate } from "drizzle-orm/libsql/migrator";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../drizzle") });
});
