// Shared helpers for the Build-mode verification harnesses.
//
// Config:
//   PORT                    dev port to hit (default 3010 — 3000/3001/3002 are
//                           taken on the demo box). Respects STUDIO_BASE too.
//   PLAYWRIGHT_CORE         absolute path to a playwright-core module (default
//                           picks up the one bundled with the gstack tooling).
//   CHROME_EXECUTABLE       absolute path to a Chrome/Chromium binary (default
//                           is the system Google Chrome).

const BASE =
  process.env.STUDIO_BASE || `http://localhost:${process.env.PORT || "3010"}`;

const PLAYWRIGHT_CORE =
  process.env.PLAYWRIGHT_CORE ||
  "/Users/oladimeji/.claude/skills/gstack/node_modules/playwright-core";

const CHROME_EXECUTABLE =
  process.env.CHROME_EXECUTABLE ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
let failed = 0;
const failMessages = [];

function check(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failMessages.push(name + (extra ? ` — ${extra}` : ""));
    console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ""}`);
  }
  return cond;
}

function summary(label) {
  console.log(`\n${label}: ${passed} pass, ${failed} fail`);
  if (failed > 0) {
    console.log("Failed checks:");
    for (const f of failMessages) console.log(`  - ${f}`);
  }
  process.exitCode = failed > 0 ? 1 : 0;
  return failed === 0;
}

async function launch() {
  const { chromium } = require(PLAYWRIGHT_CORE);
  return chromium.launch({
    executablePath: CHROME_EXECUTABLE,
    headless: true,
    args: ["--no-sandbox"],
  });
}

async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page._consoleErrors = errors;
  return page;
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

// The studio app polls /api/webmcp/get_state every ~700ms (useExternalSync)
// and it does a single client-side App Router navigation to "/" right after
// the first paint. Two consequences for the verification harness:
//
//   1. `waitUntil:"networkidle"` NEVER resolves — the app's update loop never
//      goes idle. Any gate using networkidle will hang / time out.
//   2. `waitUntil:"domcontentloaded"` + a tight (5s) timeout is a race on a
//      slow disk: the first visit has to compile the route, and the client
//      navigation can tear down the execution context mid-goto, which Chrome
//      surfaces as "Target page, context or browser has been closed".
//
// The reliable pattern is: navigate with `commit` (resolves as soon as the
// response head is in), then explicitly wait for the React shell to mount.
// Optionally warm the route first so the compile is done before we attach a
// browser at all.
async function gotoStudio(page, { warm = true } = {}) {
  // Warm the route via plain HTTP so the dev-server route is compiled before
  // a browser ever attaches — removes the cold-compile race entirely.
  if (warm) {
    try {
      await fetch(BASE + "/", { method: "GET" });
    } catch {
      /* dev server may be mid-reload; ignore */
    }
  }
  await page.goto(BASE + "/", {
    waitUntil: "commit",
    timeout: 60000,
  });
  // Wait for the actual interactive React shell (not just the SSR shell).
  // The workspace tablist is the strongest signal that hydration + the
  // client-side App Router navigation to "/" have both settled.
  try {
    await page.waitForSelector(
      '[role="tablist"][aria-label="Workspace tabs"]',
      { timeout: 30000 },
    );
    // Let the client-side navigation commit and the first paint of the
    // workspace land before any gate mutates state.
    await new Promise((r) => setTimeout(r, 300));
  } catch {
    /* tabs may be absent in odd states; gates will surface any issue */
  }
  return page;
}

async function webmcpTool(name, input) {
  const r = await fetch(BASE + "/api/webmcp/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, input }),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ok: !!j.ok, err: j.error || j.message || null };
}

async function resetServer() {
  await fetch(BASE + "/api/webmcp/execute", { method: "DELETE" });
}

module.exports = {
  BASE,
  sleep,
  check,
  summary,
  launch,
  newPage,
  bodyText,
  gotoStudio,
  webmcpTool,
  resetServer,
};
