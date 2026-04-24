import { defineConfig } from "@playwright/test";
import * as dotenv from "dotenv";
import path from "path"; // <-- import dotenv

// Load .env reliably
dotenv.config({ path: path.resolve(__dirname, ".env") });
const depEnv = process.env.DEP_ENV || "dev"; // fallback to dev if undefined

function getExpectedURL(depEnv?: string): string {
  // PR environments (numeric)
  if (/^\d+$/.test(process.env.DEP_ENV || "")) {
    return `https://soba-pr-${depEnv}.apps.silver.devops.gov.bc.ca`;
  }

  switch (depEnv) {
    case "dev":
      return "https://soba-dev.apps.silver.devops.gov.bc.ca";
    case "test":
      return "https://soba-test.apps.silver.devops.gov.bc.ca";
    default:
      throw new Error(`Invalid DEP_ENV: ${depEnv}`);
  }
}

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,

  use: {
    baseURL: getExpectedURL(depEnv),
    headless: true,
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    ignoreHTTPSErrors: true,
  },

  reporter: [["html", { open: "never" }]],
  outputDir: "test-results",

  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
