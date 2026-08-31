// Gate 3 — Final demo / submission readiness.
//
// Static + small dynamic checks for the final pause: production build,
// type-check, provider-independence (zero keys), gitignore hygiene, README
// accuracy, screenshots present, and a 90-second rehearsal timing of an
// in-app pipeline run.
//
// Exit: 0 on all PASS, 1 otherwise.

const L = require("./lib");
const { sleep, check, summary, launch, newPage, gotoStudio, bodyText } = L;
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const REPO = path.resolve(__dirname, "..", "..");

function cmd(label, cmdline, opts = {}) {
  try {
    const out = execSync(cmdline, { cwd: REPO, stdio: "pipe", ...opts });
    check(label, true);
    return out;
  } catch (e) {
    check(label, false, (e.stderr || e.message || "").toString().slice(0, 200));
    return null;
  }
}

(async () => {
  console.log("\n== Gate 3: final demo / submission readiness ==");

  // Dynamic checks FIRST so the heavy `npm run build` doesn't corrupt the
  // dev server's `.next` cache (next build and next dev share the same dir).
  const browser = await launch();
  const page = await newPage(browser);

  // Provider-independence: no API keys are required. The dev server is
  // already running on DEMO_MODE=true (default).
  const envNoSecrets =
    !process.env.OPENAI_API_KEY &&
    !process.env.FAL_KEY &&
    !process.env.SPEECHIFY_API_KEY;
  check("demo mode is keyless (no provider keys set in harness)", envNoSecrets);

  // 90s rehearsal timing: run the in-app pipeline from Run Studio to
  // Campaign complete and time it. Auto-approve the gate so this is a
  // timing measurement, not a veto exercise.
  await fetch(L.BASE + "/api/webmcp/execute", { method: "DELETE" });
  await gotoStudio(page);
  await sleep(700);

  const t0 = Date.now();
  await page.getByRole("button", { name: /Run Studio/i }).first().click();
  let complete = false;
  let elapsed = 0;
  // 240 iterations * 500ms = 120s ceiling; the deterministic run finishes
  // in 15-25s but the dev server may be warm from prior gates.
  for (let i = 0; i < 240; i++) {
    await sleep(500);
    const t = await bodyText(page);
    if (/Approval Required/i.test(t)) {
      const dlg = page.locator('[role="dialog"]').last();
      if (await dlg.count()) {
        try {
          await dlg.getByRole("button", { name: /^Approve$/i }).click();
        } catch {}
      }
    }
    if (/Campaign complete/i.test(t)) {
      complete = true;
      elapsed = Date.now() - t0;
      break;
    }
  }
  check("90s rehearsal run completes", complete, elapsed ? `${elapsed}ms` : "did not complete");
  check(
    "90s rehearsal finishes under 90 seconds (deterministic demo mode)",
    complete && elapsed <= 90_000,
    complete ? `${elapsed}ms` : "n/a",
  );
  await browser.close();

  // Static checks.
  cmd("tsc --noEmit clean", "npx tsc --noEmit");

  // Gitignore hygiene: .studio-state.json and .env should be ignored.
  const ignored = (relpath) => {
    try {
      execSync(`git check-ignore ${relpath}`, { cwd: REPO, stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  };
  check(".studio-state.json is gitignored", ignored(".studio-state.json"));
  check(".env is gitignored", ignored(".env"));

  // Secret scan: no hardcoded keys in tracked src OR the commit-worthy
  // example/env-template files. Real credentials must never appear in
  // anything that ships to a public repo — .env.example is a common
  // leak vector (it gets committed, .env/.env.local don't).
  let leaked = "";
  try {
    leaked = execSync(
      "grep -rEn 'sk-[A-Za-z0-9]{20,}|AU[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|ghp_[A-Za-z0-9]{20,}|ak-live[A-Za-z0-9]{20,}|sk_x[A-Za-z0-9_-]{20,}|sk_[A-Za-z0-9]{20,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|sk-[A-Za-z0-9_]{20,}' src/ .env.example 2>/dev/null || true",
      { cwd: REPO, stdio: "pipe" },
    ).toString();
  } catch {}
  check("no hardcoded secrets in src/ or .env.example", leaked.trim().length === 0, leaked.slice(0, 160));

  // README accuracy: port 3010, 14 tools.
  const readme = fs.readFileSync(path.join(REPO, "README.md"), "utf8");
  check("README mentions port 3010", readme.includes("localhost:3010"));
  check("README says '16 tools'", readme.includes("16 tools"));

  // Screenshots for Devpost.
  const shotDir = path.join(REPO, ".context/data/screenshots");
  const present = (n) =>
    fs.readdirSync(shotDir).some((f) => f.startsWith(`${n}-`) && f.endsWith(".png"));
  check(
    "5 Devpost screenshots present",
    [1, 2, 3, 4, 5].every(present),
    [1, 2, 3, 4, 5].map((n) => `${n}:${present(n)}`).join(","),
  );

  // Production build LAST (corrupts dev's .next, so we run it only after
  // every dynamic check that needs the dev server).
  cmd("npm run build clean", "npm run build");

  return summary("Gate 3");
})().catch((e) => {
  console.error("HARNESS FAIL:", e.message);
  process.exitCode = 1;
});
