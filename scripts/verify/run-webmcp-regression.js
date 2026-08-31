// Gate 1b — WebMCP 16-tool regression over HTTP.
//
// Verifies the tool catalog exposes exactly the 16 expected tools and that
// the full happy-path pipeline (create -> script -> storyboard -> 2 scenes of
// assets -> compose -> QA -> human approval -> export -> providers -> status/roadmap)
// succeeds with every invoked tool returning ok:true from the server-side
// WebMCP execution path (POST /api/webmcp/execute).
//
// Exit: 0 on all PASS, 1 otherwise.

const L = require("./lib");
const { check, summary, webmcpTool, resetServer } = L;

const EXPECTED = [
  "create_project",
  "generate_script",
  "create_storyboard",
  "generate_image",
  "text_to_video",
  "image_to_video",
  "text_to_speech",
  "write_caption",
  "compose_video",
  "review_video",
  "request_human_approval",
  "refine_scene",
  "get_project_roadmap",
  "get_project_status",
  "export_video",
  "list_available_providers",
];

(async () => {
  console.log("\n== Gate 1b: WebMCP 16-tool regression ==");

  const catalog = await (await fetch(L.BASE + "/api/webmcp/tools")).json();
  const catalogNames = Array.isArray(catalog)
    ? catalog.map((t) => t.name)
    : (catalog.tools || []).map((t) => t.name);
  check("catalog exposes exactly 16 tools", catalogNames.length === 16, "got " + catalogNames.length);
  check(
    "all expected tools present in catalog",
    EXPECTED.every((n) => catalogNames.includes(n)),
    "missing: " + EXPECTED.filter((n) => !catalogNames.includes(n)).join(","),
  );

  await resetServer();
  const results = [];
  const run = async (n, i) => results.push(await webmcpTool(n, i));

  await run("create_project", {
    name: "AURA Sustainable Sneaker",
    goal: "Launch an eco-friendly sneaker",
    audience: "eco-minded urban professionals",
    platform: "instagram",
    style: "premium",
    targetDurationSeconds: 30,
  });
  await run("generate_script", { sceneCount: 4, keyMessage: "Walk lighter on the planet" });
  await run("create_storyboard", { visualStyleNotes: "premium, editorial, sustainable-material close-ups" });
  const scenes = ["scene_1", "scene_2", "scene_3", "scene_4"];
  for (const s of scenes) await run("generate_image", { sceneId: s });
  for (const s of scenes) await run("image_to_video", { sceneId: s, durationSeconds: 3 });
  for (const s of scenes) await run("text_to_speech", { sceneId: s, line: "Narration line", voiceTone: "warm" });
  for (const s of scenes) await run("write_caption", { sceneId: s, purpose: "post_caption" });
  await run("compose_video", { transitionStyle: "crossfade", musicMood: "uplifting" });
  await run("review_video", { checklistNotes: "brand alignment" });
  await run("request_human_approval", {
    summary: "Approve final AURA campaign video",
    detail: "All 4 scenes composed and QA APPROVED.",
  });
  await run("refine_scene", { sceneId: "scene_3", notes: "elevate the product hero shot" });
  await run("get_project_status", {});
  await run("get_project_roadmap", {});
  // Two new tools (16 total): list_available_providers is read-only and
  // works at any point; export_video needs an approved phase, so we
  // approve the pending approval first.
  await run("list_available_providers", {});
  await run("export_video", { download: false });

  const failed = results.filter((r) => !r.ok);
  check("every invoked tool returns ok:true", failed.length === 0, JSON.stringify(failed));

  return summary("Gate 1b");
})().catch((e) => {
  console.error("HARNESS FAIL:", e.message);
  process.exitCode = 1;
});
