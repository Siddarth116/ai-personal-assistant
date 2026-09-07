import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 15000,
    pool: "forks",
    env: {
      // A true in-memory database, private to each forked test process.
      // Previously this was a per-run file path computed once in this
      // config (evaluated in the main process), so every forked test file
      // ended up sharing the exact same physical file and hit SQLITE_BUSY
      // lock contention when run in parallel - especially reliably visible
      // on some filesystems (e.g. WSL paths under /mnt/c). :memory: has no
      // shared file at all, so there's nothing to contend over.
      DATABASE_URL: ":memory:",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
