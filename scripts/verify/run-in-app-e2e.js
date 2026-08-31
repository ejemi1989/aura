// Gate 1a — Fresh in-app production run end-to-end (human veto + refinement).
//
// Verifies: READY idle -> Run Studio -> Director plan preview -> crew runs ->
// approval gate -> Reject -> pause strip -> Remake Scene 3 -> re-approval ->
// Campaign complete, with ZERO console errors throughout.
//
// Exit: 0 on all PASS, 1 otherwise.

const L = require("./lib");
const { sleep, check, summary, launch, newPage, gotoStudio, bodyText } = L;

(async () => {
  const browser = await launch();
  const page = await newPage(browser);

  await gotoStudio(page);
  await sleep(600);

  console.log("\n== Gate 1a: fresh in-app E2E production run ==");

  let t = await bodyText(page);
  check(
    "idle control room loads",
    /READY FOR PRODUCTION/i.test(t) || /Ready for production/i.test(t),
    t.slice(0, 80),
  );

  // Quick-goal box must be present and its LLM orchestrate probe must
  // degrade gracefully to demo when no OPENAI_API_KEY is set (so the
  // Send button falls back to the deterministic in-app director).
  check(
    "quick-goal input present",
    (await page.getByLabel("Quick goal for the studio").count()) > 0,
  );
  const orchRes = await fetch(L.BASE + "/api/orchestrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      brief: { name: "X", goal: "test", audience: "test", platform: "instagram", style: "professional" },
    }),
  });
  const orch = await orchRes.json().catch(() => ({}));
  check(
    "quick-goal orchestrate probes demo without a key",
    orch.mode === "demo",
    "mode=" + orch.mode,
  );

  await page.getByRole("button", { name: /Run Studio/i }).first().click();

  // Director's plan is announced in the brief rail shortly after Run.
  let planSeen = false;
  for (let i = 0; i < 10; i++) {
    await sleep(300);
    t = await bodyText(page);
    if (/Director's plan/i.test(t) || /production plan/i.test(t)) {
      planSeen = true;
      break;
    }
  }
  check("Director's plan previewed before generation", planSeen);

  // Crew runs -> approval modal appears.
  let approve = false;
  for (let i = 0; i < 140; i++) {
    await sleep(250);
    t = await bodyText(page);
    if (/Approval Required/i.test(t)) {
      approve = true;
      break;
    }
  }
  check("human approval gate opens", approve);
  if (!approve) {
    console.log("  (console errors so far: " + JSON.stringify(page._consoleErrors) + ")");
    await browser.close();
    return summary("Gate 1a");
  }

  // Hero move: Reject -> confirm -> pause strip.
  await page.getByRole("button", { name: /Reject/i }).first().click();
  await sleep(150);
  await page.getByRole("button", { name: /Confirm Reject/i }).click();
  await sleep(400);
  t = await bodyText(page);
  check("reject pauses production (pause strip)", /paused/i.test(t) || /waiting/i.test(t));

  // Scene-level override: pick Scene 3, type a revision, Remake.
  const scene3 = page.locator('[title^="Scene 3:"]').first();
  await scene3.click();
  const vetoBox = page.getByPlaceholder(/does not feel premium/i).first();
  await vetoBox.fill("does not feel premium - elevate the product hero shot.");
  await page.getByRole("button", { name: /Remake Scene 3/i }).click();

  // Re-QA + re-approval.
  let reapprove = false;
  for (let i = 0; i < 90; i++) {
    await sleep(250);
    t = await bodyText(page);
    if (/after the revision/i.test(t) || /Approval Required/i.test(t)) {
      reapprove = true;
      break;
    }
  }
  check("re-approval after revision requested", reapprove);

  const dialog = page.locator('[role="dialog"]').last();
  await dialog.getByRole("button", { name: /^Approve$/i }).click();
  await sleep(1000);
  t = await bodyText(page);
  check("campaign completes after approval", /Campaign complete/i.test(t));
  check("zero console errors", page._consoleErrors.length === 0, JSON.stringify(page._consoleErrors));

  await browser.close();
  return summary("Gate 1a");
})().catch((e) => {
  console.error("HARNESS FAIL:", e.message);
  process.exitCode = 1;
});
