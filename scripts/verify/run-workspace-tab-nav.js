// Gate 1d — Workspace tab navigation.
//
// Verifies the Workspace tab strip (Storyboard / Script / Audio /
// Timeline) supports three navigation gestures, all with zero console
// errors:
//   1. Click — clicking a tab header switches the active tab.
//   2. Keyboard — ←/→ wrap around, Home/End jump to first/last
//      (WAI-ARIA tabs pattern).
//   3. Swipe — horizontal pointer drag on the panel content switches
//      the active tab (dx > 60px commits; shorter drags are ignored).
//
// On every tab change, the panel slides in from the direction of the
// previous tab with a spring-eased transform animation.
//
// Exit: 0 on all PASS, 1 otherwise.

const L = require("./lib");
const { sleep, check, summary, launch, newPage, gotoStudio } = L;
const TIMEOUT = 30000;

(async () => {
  const browser = await launch();
  const page = await newPage(browser);
  page.setDefaultTimeout(TIMEOUT);

  console.log("\n== Gate 1d: workspace tab navigation ==");

  // gotoStudio warms the route, uses waitUntil:"commit" (networkidle never
  // resolves on this app — it polls get_state every 700ms) and waits for the
  // React shell, then we settle briefly for the client-side nav to land.
  await gotoStudio(page);
  await sleep(800);

  // Scope all locators to the Workspace tablist (the inner one with
  // Storyboard/Script/Audio/Timeline) so it never matches the outer
  // top-level tabs (Studio / Agents / Brief).
  const workspaceTabs = page.locator('[role="tablist"][aria-label="Workspace tabs"]');
  const activeLabel = () =>
    page.evaluate(() => {
      const a = document.querySelector('[role="tablist"][aria-label="Workspace tabs"] [aria-selected="true"]');
      return a ? a.textContent.trim() : null;
    });
  const expectedIdx = (label) => ["Storyboard", "Script", "Audio", "Timeline"].indexOf(label);

  // 1. Initial state.
  check("starts on Storyboard", expectedIdx(await activeLabel()) === 0);

  // 2. Click navigation.
  await workspaceTabs.getByRole("tab", { name: "Script" }).click();
  await sleep(120);
  check("click Script -> Script", expectedIdx(await activeLabel()) === 1);
  await workspaceTabs.getByRole("tab", { name: "Audio" }).click();
  await sleep(120);
  check("click Audio -> Audio", expectedIdx(await activeLabel()) === 2);
  await workspaceTabs.getByRole("tab", { name: "Timeline" }).click();
  await sleep(120);
  check("click Timeline -> Timeline", expectedIdx(await activeLabel()) === 3);

  // 3. Arrow-key navigation (WAI-ARIA tabs pattern).
  await workspaceTabs.getByRole("tab", { name: "Timeline" }).focus();
  await page.keyboard.press("ArrowRight");
  await sleep(120);
  check("ArrowRight wraps to Storyboard", expectedIdx(await activeLabel()) === 0);
  await page.keyboard.press("ArrowLeft");
  await sleep(120);
  check("ArrowLeft wraps to Timeline", expectedIdx(await activeLabel()) === 3);
  await page.keyboard.press("End");
  await sleep(120);
  check("End -> Timeline", expectedIdx(await activeLabel()) === 3);
  await page.keyboard.press("Home");
  await sleep(120);
  check("Home -> Storyboard", expectedIdx(await activeLabel()) === 0);

  // 4. Horizontal swipe on the panel content.
  const panel = page.locator('[role="tabpanel"]');

  // Swipe LEFT (dx < 0) -> next tab.
  let box = await panel.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(box.x + box.width / 2 - i * 30, box.y + box.height / 2, { steps: 2 });
    await sleep(10);
  }
  await page.mouse.up();
  await sleep(200);
  check("swipe left -> Script", expectedIdx(await activeLabel()) === 1);

  // Swipe LEFT again -> Audio.
  box = await panel.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(box.x + box.width / 2 - i * 30, box.y + box.height / 2, { steps: 2 });
    await sleep(10);
  }
  await page.mouse.up();
  await sleep(200);
  check("swipe left again -> Audio", expectedIdx(await activeLabel()) === 2);

  // Swipe RIGHT (dx > 0) -> previous tab.
  box = await panel.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(box.x + box.width / 2 + i * 30, box.y + box.height / 2, { steps: 2 });
    await sleep(10);
  }
  await page.mouse.up();
  await sleep(200);
  check("swipe right -> back to Script", expectedIdx(await activeLabel()) === 1);

  // Short swipe (< 60px) should NOT change tabs.
  box = await panel.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 20, box.y + box.height / 2, { steps: 2 });
  await page.mouse.up();
  await sleep(200);
  check("short swipe is ignored", expectedIdx(await activeLabel()) === 1);

  // The navigation assertions above already prove each tab swap commits;
  // the panel content swap is implicit in the active-label checks.

  check("zero console errors", page._consoleErrors.length === 0, JSON.stringify(page._consoleErrors));

  await browser.close();
  return summary("Gate 1d");
})().catch((e) => {
  console.error("HARNESS FAIL:", e.message);
  process.exitCode = 1;
});
