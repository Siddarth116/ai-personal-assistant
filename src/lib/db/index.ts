import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import fs from "fs";
import path from "path";

const DATABASE_URL = process.env.DATABASE_URL || "file:./data/app.db";
const AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN; // only needed for a remote Turso database

// If we're pointed at a local file, make sure its directory exists.
if (DATABASE_URL.startsWith("file:")) {
  const filePath = DATABASE_URL.replace(/^file:/, "");
  const dir = path.dirname(filePath);
  if (dir && dir !== "." && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Reuse a single connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { __libsql?: ReturnType<typeof createClient> };

const client =
  globalForDb.__libsql ??
  createClient({
    url: DATABASE_URL,
    authToken: AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__libsql = client;
}

export const db = drizzle(client, { schema });
export { client };
