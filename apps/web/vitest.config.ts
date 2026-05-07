import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    dir: "../..",
    environment: "jsdom",
    include: ["apps/web/src/test/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
  },
});
