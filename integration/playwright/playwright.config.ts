import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";
import path from "path";

// Load .env
dotenv.config({ path: path.resolve(__dirname, ".env") });

const depEnv = process.env.DEP_ENV || "dev";
const authFile = path.resolve(__dirname, "support", "user.json");

function getExpectedURL(depEnv: string): string {
  // PR environments: DEP_ENV is a PR number
  if (/^\d+$/.test(depEnv)) {
    const prNumber = Number(depEnv);
    //const slot = prNumber % 20;
    return `https://soba-dev.apps.silver.devops.gov.bc.ca/designer-${prNumber}/en`;
  }

  switch (depEnv.toLowerCase()) {
    case "dev":
      return "https://soba-dev.apps.silver.devops.gov.bc.ca/designer/en";

    case "test":
      return "https://soba-test.apps.silver.devops.gov.bc.ca/designer/en";

    default:
      throw new Error(`Invalid DEP_ENV: ${depEnv}`);
  }
}

const resolvedBaseURL = process.env.BASE_URL || getExpectedURL(depEnv);
const BASE_URL = resolvedBaseURL;

console.log(`DEP_ENV: ${depEnv}`);
console.log(`Playwright Base URL: ${BASE_URL}`);

export default defineConfig({
  testDir: "./tests",

  fullyParallel: false,
  workers: 1,

  use: {
    baseURL: BASE_URL,

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
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: BASE_URL,
        headless: true,
      },
    },

    // All E2E tests use the authenticated session
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: BASE_URL,
        headless: true,
        storageState: authFile,
        video: "retain-on-failure",
        screenshot: "only-on-failure",
        trace: "on-first-retry",
        ignoreHTTPSErrors: true,
      },
      dependencies: ["setup"],
    },
  ],
});
