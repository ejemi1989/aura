// Gate 2b — External WebMCP agent bridge.
//
// Verifies an external (server-side) agent can drive the full pipeline over
// HTTP and that the studio UI reflects it live: the external project +
// timeline scenes hydrate into the control room, the human approval modal
// appears, and approving clears it and moves the server project to
// phase=complete with zero pending approvals — but ONLY when the client is
// idle (the guard never lets an external project clobber an in-app session).
//
// Exit: 0 on all PASS, 1 otherwise.

const L = require("./lib");
const { sleep, check, summary, launch, newPage, gotoStudio, webmcpTool, resetServer } = L;

(async () => {
  console.log("\n== Gate 2b: external agent -> UI bridge ==");

  await resetServer();
  const results = [];
  const run = async (n, i) => results.push(await webmcpTool(n, i));
  await run("create_project", { name: "AURA Bridge", goal: "g", audience: "a", platform: "instagram", style: "premium" });
  await run("generate_script", { sceneCount: 2, keyMessage: "m" });
  await run("create_storyboard", { visualStyleNotes: "s" });
  for (const sc of ["scene_1", "scene_2"]) await run("generate_image", { sceneId: sc });
  for (const sc of ["scene_1", "scene_2"]) await run("image_to_video", { sceneId: sc, durationSeconds: 3 });
  for (const sc of ["scene_1", "scene_2"]) await run("text_to_speech", { sceneId: sc, line: "n", voiceTone: "warm" });
  for (const sc of ["scene_1", "scene_2"]) await run("write_caption", { sceneId: sc, purpose: "post_caption" });
  await run("compose_video", {});
  await run("review_video", {});
  await run("request_human_approval", { summary: "Approve Bridge Final", detail: "QA ok." });
  const failed = results.filter((r) => !r.ok);
  check("external agent drives all tools ok:true", failed.length === 0, JSON.stringify(failed));

  const browser = await launch();
  const page = await newPage(browser);
  await gotoStudio(page);

  let modal = false;
  for (let i = 0; i < 15; i++) {
    await sleep(700);
    if (await page.evaluate(() => !!document.querySelector('[role="dialog"]'))) {
      modal = true;
      break;
    }
  }
  check("approval modal hydrates from external agent", modal);
  const showsProject = await page.evaluate(() => document.body.innerText.includes("AURA Bridge"));
  check("UI reflects external project", showsProject);
  const sceneBtns = await page.evaluate(
    () => document.querySelectorAll('[data-scene-button], [title^="Scene"]').length,
  );
  check("timeline reflects external scenes", sceneBtns >= 2, "got " + sceneBtns);

  await page.getByRole("dialog").last().getByRole("button", { name: /Approve/i }).click();
  let closed = false;
  for (let i = 0; i < 20; i++) {
    await sleep(300);
    if (!(await page.evaluate(() => !!document.querySelector('[role="dialog"]')))) {
      closed = true;
      break;
    }
  }
  check("approve closes modal", closed);

  const gs = await (await fetch(L.BASE + "/api/webmcp/get_state")).json();
  check("server reaches phase=complete", gs.project && gs.project.phase === "complete", JSON.stringify(gs.project && gs.project.phase));
  check("server has zero pending approvals", (gs.pendingApprovals || []).length === 0);
  check("zero console errors", page._consoleErrors.length === 0, JSON.stringify(page._consoleErrors));

  await browser.close();
  return summary("Gate 2b");
})().catch((e) => {
  console.error("HARNESS FAIL:", e.message);
  process.exitCode = 1;
});
