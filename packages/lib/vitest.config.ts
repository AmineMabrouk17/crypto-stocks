import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Server-side logic moved to Rust; its tests live in rust/app/tests.
    passWithNoTests: true,
  },
});
