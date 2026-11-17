import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Node 22 ships Temporal behind this V8 flag. Node 26 enables it by default.
    execArgv: ["--harmony-temporal"],
  },
});
