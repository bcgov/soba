const fs = require("node:fs/promises");
const { createRequire } = require("node:module");
const path = require("node:path");

const playwrightDir = path.resolve(__dirname, "../integration/playwright");
const requirePlaywright = createRequire(
  path.join(playwrightDir, "package.json"),
);

async function captureAccessToken(meUrl, tokenFile, baseUrl) {
  requirePlaywright("dotenv").config({
    path: path.join(playwrightDir, ".env"),
    quiet: true,
  });
  const frontendUrl = new URL(baseUrl || process.env.BASE_URL);
  const { chromium } = requirePlaywright("@playwright/test");
  const { formsettings, login } = requirePlaywright("./support/soba_login.ts");
  formsettings();

  const expectedMeUrl = new URL(meUrl).href;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30_000);
    await page.goto(frontendUrl.href);

    const [response] = await Promise.all([
      page.waitForResponse(
        async (response) => {
          const request = response.request();
          return (
            response.url() === expectedMeUrl &&
            request.method() === "GET" &&
            response.ok() &&
            /^Bearer \S+$/i.test(
              (await request.headerValue("authorization")) ?? "",
            )
          );
        },
        { timeout: 90_000 },
      ),
      login(page),
    ]);
    const authorization = await response.request().headerValue("authorization");
    await fs.writeFile(tokenFile, authorization.slice("Bearer ".length), {
      flag: "wx",
      mode: 0o600,
    });
  } finally {
    await browser.close();
  }
}

captureAccessToken(process.argv[2], process.argv[3], process.argv[4]).catch(
  () => {
    console.error(
      "SOBA Playwright login failed. Check the credentials, Chromium, and frontend and API URLs.",
    );
    process.exitCode = 1;
  },
);
