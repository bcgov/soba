import { defineConfig } from "@playwright/test";
import * as dotenv from "dotenv";
import path from "path";

// Load .env
dotenv.config({ path: path.resolve(__dirname, ".env") });

const depEnv = process.env.DEP_ENV || "dev";

function getExpectedURL(depEnv: string): string {
  // PR environments: DEP_ENV is a PR number
  if (/^\d+$/.test(depEnv)) {
    const prNumber = Number(depEnv);
    const slot = prNumber % 20;

    return `https://soba-${slot}-designer.apps.silver.devops.gov.bc.ca`;
  }

  switch (depEnv.toLowerCase()) {
    case "dev":
      return "https://soba-dev.apps.silver.devops.gov.bc.ca/designer/en/forms";

    case "test":
      return "https://soba-test-designer.apps.silver.devops.gov.bc.ca/en";

    default:
      throw new Error(`Invalid DEP_ENV: ${depEnv}`);
  }
}

const baseURL = getExpectedURL(depEnv);

console.log(`DEP_ENV: ${depEnv}`);
console.log(`Playwright Base URL: ${baseURL}`);

export default defineConfig({
  testDir: "./tests",

  fullyParallel: false,
  workers: 1,

  use: {
    baseURL,

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
      use: {
        browserName: "chromium",
      },
    },
  ],
});
