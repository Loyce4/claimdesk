import { defineConfig } from "vitest/config";
import "dotenv/config";
export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 15000,
    globalSetup: ["./tests/globalSetup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
    },
  },
});