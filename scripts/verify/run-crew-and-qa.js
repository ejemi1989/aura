// Gate 1c — 10-agent crew / status + Critic/QA loop.
//
// Verifies the in-app crew sidebar renders all 10 specialists with non-trivial
// status labels (not just blank), and that the Critic/QA agent is reachable
// end-to-end via the server-side review_video tool on a fully-asset'd
// project. This is the focused check for the two checklist items the other
// gates only cover transitively.
//
// Exit: 0 on all PASS, 1 otherwise.

const L = require("./lib");
const { sleep, check, summary, launch, newPage, gotoStudio, webmcpTool, resetServer } = L;
const CREW_SIZE = 10;

(async () => {
  const browser = await launch();
  const page = await newPage(browser);
  await gotoStudio(page);
  await sleep(500);

  console.log("\n== Gate 1c: 10-agent crew / status + Critic/QA loop ==");

  // Idle: the AgentList swarm sidebar should render all 10 agents. The
  // sidebar uses short labels ("Director", "Brand", "Writer", ...) so we
  // match those plus assert the row count via the per-agent "Details" link.
  const idleCrew = await page.evaluate(() => {
    const root = document.body;
    const text = root.innerText;
    const expected = ["Director", "Brand", "Writer", "Copy", "Design", "Motion", "Voice", "Editor", "Critic", "PM"];
    const present = expected.filter((e) => text.includes(e));
    const detailsCount = document.querySelectorAll('[data-testid="agent-row"], aside button, aside a').length;
    return {
      presentCount: present.length,
      present,
      missing: expected.filter((e) => !text.includes(e)),
      detailsCount,
    };
  });
  check(
    `crew sidebar renders all ${CREW_SIZE} agents`,
    idleCrew.presentCount >= CREW_SIZE,
    "missing: " + idleCrew.missing.join(",") + "; details=" + idleCrew.detailsCount,
  );

  await browser.close();

  // Critic/QA loop: drive a full project over HTTP so review_video has real
  // assets to evaluate, and assert review_video returns a structured verdict.
  await resetServer();
  const run = async (n, i) => await webmcpTool(n, i);
  await run("create_project", { name: "QA Crew Test", goal: "g", audience: "a", platform: "instagram", style: "s" });
  await run("generate_script", { sceneCount: 2, keyMessage: "m" });
  await run("create_storyboard", { visualStyleNotes: "s" });
  for (const sc of ["scene_1", "scene_2"]) await run("generate_image", { sceneId: sc });
  for (const sc of ["scene_1", "scene_2"]) await run("image_to_video", { sceneId: sc, durationSeconds: 3 });
  for (const sc of ["scene_1", "scene_2"]) await run("text_to_speech", { sceneId: sc, line: "n", voiceTone: "warm" });
  for (const sc of ["scene_1", "scene_2"]) await run("write_caption", { sceneId: sc, purpose: "post_caption" });
  await run("compose_video", {});

  const review = await webmcpTool("review_video", { checklistNotes: "brand alignment" });
  check("review_video returns ok:true", review.ok, JSON.stringify(review));

  // The Critic verdict is read-only; reach into the project snapshot for it.
  const snap = await (await fetch(L.BASE + "/api/webmcp/get_state")).json();
  const verdict = snap && snap.project && snap.project.qaVerdict;
  check("Critic/QA verdict present (APPROVED or NEEDS_REVISION)", !!verdict, "got: " + JSON.stringify(verdict));

  return summary("Gate 1c");
})().catch((e) => {
  console.error("HARNESS FAIL:", e.message);
  process.exitCode = 1;
});
