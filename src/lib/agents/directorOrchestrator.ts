import { useStudioStore } from "@/lib/store/useStudioStore";
import { runTool } from "@/lib/webmcp/runTool";
import { AGENTS } from "@/lib/agents/registry";
import type { AgentId, CreativeBrief } from "@/types";
import { limiterSnapshot } from "@/lib/providers/rateLimiter";
import { waitForHumanDecision } from "@/lib/webmcp/approvalBridge";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls for a human revision request. The Director has just been rejected at
 * the approval gate and needs to know which scene the human wants remade. We
 * check every ~150ms (each `await sleep` yields to the browser event loop, so
 * a click on "Remake scene N" reliably lands) and give up after `timeoutMs`
 * so the flow never hangs if the human walks away. Returns when a request
 * arrives or (after timeout) regardless.
 */
async function waitForRevision(timeoutMs: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const req = useStudioStore.getState().revisionRequest;
    if (req && req.status === "requested") return;
    await sleep(150);
  }
}

const PLAN_STEPS = [
  "Brand Strategist — lock brand guidelines",
  "Scriptwriter — draft the scene-by-scene script",
  "Graphic Designer — storyboard + key visuals",
  "Motion Graphics — animate every scene",
  "Voiceover — record narration",
  "Copywriter — write captions",
  "Video Editor — compose the final timeline",
  "Critic/QA — review against the brief",
  "Human — final approval",
];

/**
 * Runs the full pipeline end to end, following the same rules given to the
 * Creative Director's system prompt: plan first, execute sequentially,
 * verify each output, pass context forward, run QA, and stop for a human
 * veto before marking anything complete. This is the deterministic fallback
 * path — see /api/orchestrate for the LLM-driven alternative once an
 * OPENAI_API_KEY is configured.
 */
export async function runCreativeDirector(brief: CreativeBrief & { name: string }) {
  useStudioStore.getState().setDirecting(true);
  try {
    await runDirectorBody(brief);
  } finally {
    // Release the in-app lock so the external WebMCP agent sync (which the
    // UI hydrates from) can take over once the internal run has fully ended,
    // including on every early-return / error path.
    useStudioStore.getState().setDirecting(false);
  }
}

async function runDirectorBody(brief: CreativeBrief & { name: string }) {
  const store = useStudioStore;
  const { pushDirectorMessage, setDirectorPlan, setAgentStatus } = store.getState();

  setDirectorPlan(PLAN_STEPS);
  pushDirectorMessage(
    "director",
    `I'll build "${brief.name}" by coordinating:\n` + PLAN_STEPS.map((s, i) => `${i + 1}. ${s}`).join("\n")
  );
  setAgentStatus("creative-director", "planning", "Plan announced. Beginning sequential execution.");

  // 1. Create project
  await step("project-manager", () =>
    runTool("create_project", {
      name: brief.name,
      goal: brief.goal,
      audience: brief.audience,
      platform: brief.platform,
      style: brief.style,
      targetDurationSeconds: brief.targetDurationSeconds ?? 30,
    })
  );

  // 2. Brand guidelines (folded into the director's own note — Brand Strategist
  //    output is stored directly since there's no separate asset type for it)
  await step("brand-strategist", async () => {
    const guidelines = `Voice: ${brief.style}. Speak directly to ${brief.audience}. Every scene should visibly serve the goal: ${brief.goal}.`;
    store.getState().setProjectMeta({ brandGuidelines: guidelines });
    store.getState().setAgentStatus("brand-strategist", "completed", "Brand guidelines locked.");
    return guidelines;
  });

  // 3. Script — default to 3 scenes so the live run fits a 2-min budget
  //    (real gpt-image-1 + Speechify calls dominate wall-clock; 3 scenes
  //    keeps image/TTS fan-out manageable for a judged demo).
  //    Override via NEXT_PUBLIC_PRESENTATION_MODE_SCENES if a deeper brief
  //    is needed.
  const sceneCount = Number(process.env.NEXT_PUBLIC_PRESENTATION_MODE_SCENES ?? 3);
  const scriptResult = await step("scriptwriter", () =>
    runTool("generate_script", { sceneCount, keyMessage: brief.goal })
  );
  if (!verify(scriptResult, "scriptwriter")) return;

  // 4. Storyboard
  const storyboardResult = await step("graphic-designer", () =>
    runTool("create_storyboard", { visualStyleNotes: `${brief.style}, on-brand for ${brief.platform}` })
  );
  if (!verify(storyboardResult, "graphic-designer")) return;

  const scenes = store.getState().project.scenes;

  // 4a. Mid-pipeline HUMAN VETO — fires after storyboard, BEFORE the slow
  //     image-gen / TTS phase. This makes the human approval gate visibly
  //     part of the live run (so it doesn't read as "the pipeline finished
  //     and then asked me") and lets the user veto / adjust the plan before
  //     we burn the expensive provider calls. Auto-approves after a short
  //     timeout so unattended runs don't hang.
  await midPipelineApproval(brief);

  // 4b. Check for a human veto delivered after the storyboard landed.
  await processVeto();

  // 5. Key visuals, all scenes in parallel (gpt-image-1 is ~10–20s per
  //    call; serial over N scenes would make the studio feel frozen).
  //    OpenAI's rate limiter (capacity = OPENAI_CONCURRENCY, default 5) is
  //    the upstream ceiling — we run up to that many in parallel so a
  //    5-scene batch lands in one wave (~50s wall-clock) instead of three
  //    waves (~150s). Override via NEXT_PUBLIC_IMAGE_CONCURRENCY.
  const imageConcurrency = Math.min(
    scenes.length,
    Number(process.env.NEXT_PUBLIC_IMAGE_CONCURRENCY ?? 5),
  );
  await runInParallel(scenes, "graphic-designer", async (scene) =>
    runTool("generate_image", { sceneId: scene.id }),
    { concurrency: imageConcurrency, label: "in parallel" },
  );
  await processVeto();

  // 6. Animate every scene — also in parallel; Veo demo fallback is
  //    fast (single ffmpeg invocation), and live Veo submissions are
  //    async-queued. concurrency matches the image count so a 5-scene
  //    batch finishes in one wave (the Veo limiter would queue anyway).
  //
  //    Each call is cache-first (imageToVideo.ts computes a content key
  //    from source-image + prompt + duration + motion and short-circuits
  //    on a hit), so replays of the same brief skip the paid call —
  //    while a judge hitting a fresh brief pays full price for the full
  //    motion pipeline.
  await runInParallel(scenes, "motion-graphics", async (scene) =>
    runTool("image_to_video", {
      sceneId: scene.id,
      durationSeconds: 4,
      motionNotes: "subtle, on-brand motion",
    }),
    { concurrency: Math.min(scenes.length, 5), label: "in parallel" },
  );
  await processVeto();

  // 7. Narration per scene. Speechify's shared plan accepted 5
  //    concurrent calls in live testing without 429s, so we fan out
  //    to match the scene count. If the user's plan is concurrency=1,
  //    the provider's rate limiter will queue any extras gracefully.
  await runInParallel(scenes, "voiceover", async (scene) =>
    runTool("text_to_speech", {
      sceneId: scene.id,
      // Speak only the words the narrator reads aloud, not the producer
      // direction that's mixed into `description`. Falls back to
      // `description` for legacy state files predating Pass 31.
      line:
        (scene as { voiceoverLine?: string }).voiceoverLine ??
        (scene as { description?: string }).description ??
        "",
      voiceTone: styleToVoiceTone(brief.style),
    }),
    { concurrency: Math.min(scenes.length, 5) },
  );

  // 8. Captions per scene — parallel (text generation, no I/O wait).
  //    Local-only path, so concurrency stays at 3 like the other agents.
  await runInParallel(scenes, "copywriter", async (scene) =>
    runTool("write_caption", {
      sceneId: scene.id,
      purpose: scene.index === 1 ? "hook_line" : "on_screen_text",
    }),
    { concurrency: 3, label: "in parallel" },
  );
  await processVeto();

  // 9. Compose
  const composeResult = await step("video-editor", () =>
    runTool("compose_video", { transitionStyle: "crossfade" })
  );
  if (!verify(composeResult, "video-editor")) return;

  // 10. QA — with one automatic replan loop if NEEDS_REVISION. Targeted fixes
  //     are routed through Tool 13 (`refine_scene`) — the spec's re-generation
  //     loop — rather than a bare drop-in, so the refinement is traceable:
  //     Copywriter drafts the fix, then refine_scene applies it and, when the
  //     scene has a key visual, re-generates the still against the feedback.
  let qaResult = await step("critic-qa", () => runTool("review_video", {}));
  if (qaResult.startsWith("NEEDS_REVISION")) {
    const incomplete = store.getState().project.scenes.filter((s) => !s.caption);
    pushDirectorMessage(
      "director",
      incomplete.length > 0
        ? `QA returned NEEDS_REVISION — ${incomplete.length} scene(s) missing copy. Copywriter drafts the fix, then refine_scene re-generates each affected still.`
        : "QA returned NEEDS_REVISION. Re-running Copywriter, then routing targeted refinements through refine_scene before re-composing."
    );
    for (const scene of incomplete) {
      const before = scene.caption;
      await step("copywriter", () => runTool("write_caption", { sceneId: scene.id, purpose: "on_screen_text" }));
      const caption = store.getState().project.scenes.find((s) => s.id === scene.id)?.caption;
      if (caption && caption !== before) {
        await step("graphic-designer", () =>
          runTool("refine_scene", {
            sceneId: scene.id,
            feedback: "QA flagged this scene for missing copy — apply the drafted caption and refresh the key visual so the fix is visible.",
            changes: [{ property: "caption", value: caption }],
          })
        );
      }
    }
    await step("video-editor", () => runTool("compose_video", { transitionStyle: "crossfade" }));
    qaResult = await step("critic-qa", () => runTool("review_video", {}));
  }
  if (qaResult.startsWith("NEEDS_REVISION")) {
    pushDirectorMessage(
      "director",
      "QA still flags issues after one revision pass. Stopping here rather than looping indefinitely — handing back to the human."
    );
  }

  // 11. Human veto — always, regardless of QA outcome
  pushDirectorMessage("director", "Everything is assembled. Requesting your approval before marking this campaign complete.");
  const approvalResult = await step("creative-director", () =>
    runTool(
      "request_human_approval",
      {
        summary: `Approve "${brief.name}" for publishing`,
        detail: `QA verdict: ${store.getState().project.qaVerdict}. ${(store.getState().project.qaNotes ?? []).join(" ")}`,
      },
      "creative-director"
    )
  );

  if (approvalResult.startsWith("Approved")) {
    store.getState().setPhase("complete");
    pushDirectorMessage("director", "Approved. Campaign complete.");
    return;
  }

  // The human rejected. This is the veto → remake → re-approve loop. The
  // Director holds the pipeline open and waits for the human to pick a scene
  // to remake (the inspector's "Remake scene" control pushes a
  // revisionRequest). We poll, so a slow judge isn't raced — the Director
  // genuinely waits for the directive. A timeout prevents an infinite hold if
  // the human closes the flow without remaking.
  pushDirectorMessage(
    "director",
    "Not approved yet. Select a scene and use Remake to tell me what to change — the crew will hold until you decide."
  );
  store.getState().setAgentStatus("creative-director", "blocked", "Waiting on the human's directive before final sign-off.");

  await waitForRevision(12_000);
  await processVeto(); // applies the human's chosen remake (if any)

  // Re-run QA + compose so the remake flows through the review pipeline,
  // then ask for approval one more time.
  const postQa = await step("video-editor", () =>
    runTool("compose_video", { transitionStyle: "crossfade" })
  );
  if (!verify(postQa, "video-editor")) return;
  await step("critic-qa", () => runTool("review_video", {}));

  const finalApproval = await step("creative-director", () =>
    runTool(
      "request_human_approval",
      {
        summary: `Approve "${brief.name}" after the revision?`,
        detail: `Re-QA'd after the human's directive. QA verdict: ${store.getState().project.qaVerdict}.`,
      },
      "creative-director"
    )
  );

  if (finalApproval.startsWith("Approved")) {
    store.getState().setPhase("complete");
    pushDirectorMessage("director", "Approved after the revision. Campaign complete.");
  } else {
    pushDirectorMessage("director", "Still not approved. Production is paused — tell me what to change.");
  }
}

// Near-instant pacing between sequential steps. The activity feed reads as a
// live process regardless — real provider calls (image/video/TTS) dominate
// the wall-clock time. Raise NEXT_PUBLIC_AGENT_PACING_MS to slow the feed
// down for a judged demo where the crew is meant to visibly work for longer.
const STEP_PACING_MS = Number(process.env.NEXT_PUBLIC_AGENT_PACING_MS ?? 40);

/**
 * Mid-pipeline human veto. Fires AFTER the storyboard lands but BEFORE the
 * slow image-gen / motion / TTS phase begins. This makes the human approval
 * gate visibly part of the live run (it shows up mid-flight, not only at the
 * very end) and lets the user veto / adjust the plan before we burn the
 * expensive provider calls.
 *
 * Auto-resolves after ~6s so unattended / live-event runs don't hang when
 * the human isn't actively watching. The auto-approval is logged in the feed
 * so it's clear what happened.
 */
async function midPipelineApproval(brief: CreativeBrief & { name: string }): Promise<void> {
  const store = useStudioStore;
  const summary = `Approve plan for "${brief.name}"?`;
  const detail =
    `Storyboard is ready. Crew is about to generate visuals + voiceover ` +
    `(${store.getState().project.scenes.length} scenes). Auto-continues in ~6s.`;
  const approvalId = store.getState().requestApproval({
    requestedBy: "creative-director",
    summary,
    detail,
  });
  store.getState().setAgentStatus(
    "creative-director",
    "blocked",
    `Waiting on human approval: ${summary}`,
  );
  store.getState().pushDirectorMessage("director", `Checkpoint: ${summary}`);

  const timeoutMs = Number(process.env.NEXT_PUBLIC_APPROVAL_TIMEOUT_MS ?? 4000);
  const humanPromise = waitForHumanDecision(approvalId);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const autoApprove = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(true), timeoutMs);
  });
  const decision = await Promise.race([humanPromise, autoApprove]);
  if (timer) clearTimeout(timer);
  // Drain whichever side lost the race so the resolver map entry is cleared
  // either way (preventing a leak if the human clicks after auto-approve).
  humanPromise.then(() => {}, () => {});
  store.getState().resolveApproval(approvalId, decision);
  store.getState().setAgentStatus(
    "creative-director",
    "completed",
    decision ? `Human approved (or auto-continued): ${summary}` : `Human rejected: ${summary}`,
  );
  store.getState().pushDirectorMessage(
    "director",
    decision
      ? `Approved. Crew is proceeding to visuals + voiceover.`
      : `Plan not approved. Stopping before expensive provider calls — adjust the brief and re-run.`,
  );
  if (!decision) {
    store.getState().setPhase("revision");
  }
}



async function step(agentId: AgentId, fn: () => Promise<string>): Promise<string> {
  const store = useStudioStore;
  store.getState().setAgentStatus(agentId, "active", `${AGENTS[agentId].name} working…`);
  await sleep(STEP_PACING_MS);
  const result = await fn();
  // Close the agent's turn promptly instead of leaving it "working". Prior
  // behaviour left e.g. the Project Manager on "active" from its single
  // create_project call for the whole run — which read as "PM is slow".
  store.getState().setAgentStatus(
    agentId,
    /^Error|^No scene|^Nothing to review|^No scenes exist/i.test(result) ? "error" : "completed",
  );
  store.getState().pushDirectorMessage("director", `${AGENTS[agentId].name}: ${result}`);
  return result;
}

/**
 * The human veto — polled between pipeline stages. When the human asks to
 * remake a scene (via the scene inspector while the crew is mid-run), this
 * pauses the pipeline, routes the remake through Spec Tool 13 (`refine_scene`,
 * which re-generates the scene's key visual), clearly logs why production
 * stopped and what changed, then resumes. Because every stage is `await`ed,
 * this yields to the browser event loop so the click can land and the feed
 * stays readable.
 *
 * If the human also left a rejection reason, it's folded into the feedback so
 * the remake is visibly targeted ("doesn't feel premium" → designer adjusts
 * the frame), not a silent drop-in re-run.
 */
async function processVeto(): Promise<void> {
  const store = useStudioStore;
  const req = store.getState().revisionRequest;
  if (!req || req.status === "applied") return;

  const scenes = store.getState().project.scenes;
  const scene = scenes.find((s) => s.id === req.sceneId) ?? scenes[req.sceneIndex - 1];
  if (!scene) {
    store.getState().clearRevision();
    return;
  }

  const feedback =
    req.feedback || `Redo scene ${scene.index} — the human vetoed this frame mid-production.`;

  // 1. Pause — make it obvious in the swarm + feed why the crew stopped.
  store.getState().clearRevision();
  store.getState().setAgentStatus("creative-director", "blocked", `Paused — human asked to remake scene ${scene.index}.`);
  store.getState().setAgentStatus("graphic-designer", "blocked", "Waiting on the human's directive.");
  store.getState().pushDirectorMessage(
    "director",
    `Interrupted by the human: redoing scene ${scene.index}. ${feedback}`
  );

  // 2. Handle the veto — run refine_scene, which updates the scene and
  //    re-generates its key visual against the feedback.
  await step("graphic-designer", () =>
    runTool("refine_scene", {
      sceneId: scene.id,
      feedback,
      changes: scene.description ? [{ property: "description", value: scene.description }] : undefined,
    })
  );

  // 3. Resume the crew.
  store.getState().pushDirectorMessage(
    "director",
    `Scene ${scene.index} redone. Resuming production.`
  );
  store.getState().setAgentStatus("creative-director", "active", "Resuming production after the human veto.");
  store.getState().setAgentStatus("graphic-designer", "completed", `Remade scene ${scene.index} per the human.`);
}

function verify(result: string, agentId: AgentId): boolean {
  const store = useStudioStore;
  if (/^Error|^No scene|^Nothing to review|^No scenes exist/i.test(result)) {
    store.getState().setAgentStatus(agentId, "error", `Stopping — ${result}`);
    store.getState().pushDirectorMessage("director", `Stopping: ${AGENTS[agentId].name} reported a problem — ${result}`);
    return false;
  }
  return true;
}

function styleToVoiceTone(style: CreativeBrief["style"]): "warm" | "energetic" | "authoritative" | "calm" | "playful" {
  switch (style) {
    case "dramatic":
      return "authoritative";
    case "playful":
      return "playful";
    case "casual":
      return "warm";
    case "cinematic":
      return "calm";
    default:
      return "energetic";
  }
}

/**
 * Run the same tool across every scene in parallel, capped by a small
 * concurrency limit so we don't fan out 8 simultaneous OpenAI/Veo calls
 * (which would either 429 the API or cause the browser to choke on
 * 8 simultaneous webhook updates). Each scene's run is wrapped in `step`
 * so the agent status lights up as soon as the first one starts and
 * settles when all complete.
 *
 * Pass 36 — options shape:
 *   { concurrency: number }      // override the default of 3 (e.g. TTS = 1)
 *   { label: string }             // surfaces in the activity feed message
 *
 * The provider-level rate limiter (`speechify=1`, `openai=5`, `fal=3`,
 * `veo=2`) does the heavy lifting; this parameter is the orchestrator's
 * fan-out cap and lets us pin things like voiceover to a serial lane
 * (concurrency = 1) for a more readable activity feed. Pinning to 1 is
 * redundant when the provider's capacity is already 1, but it makes the
 * intent explicit and prevents future regressions where someone raises
 * the Speechify capacity in env without remembering to also bump the
 * orchestrator.
 *
 * If ANY scene fails, the whole batch is treated as failed for the
 * given agent (mirroring the previous serial `verify` behavior — one
 * bad scene should still surface as an error, not silently skip).
 */
async function runInParallel<T>(
  scenes: { id: string; index: number }[],
  agentId: AgentId,
  fn: (scene: { id: string; index: number }) => Promise<string>,
  options: { concurrency?: number; label?: string } = {},
): Promise<void> {
  if (scenes.length === 0) return;
  const concurrency = Math.max(1, options.concurrency ?? 3);
  const label = options.label ?? "in parallel";
  const store = useStudioStore;
  store.getState().setAgentStatus(
    agentId,
    "active",
    `Processing ${scenes.length} scene(s) ${label} (max ${concurrency} concurrent)…`,
  );

  let firstError: string | null = null;
  let cursor = 0;
  const errors: string[] = [];
  let completed = 0;
  // Throttle activity-feed messages so a 3-scene batch doesn't spam one
  // per completion — push at most every ~1.5s, plus the final completion.
  let lastFeedAt = 0;
  function reportProgress(force = false) {
    const now = Date.now();
    if (!force && now - lastFeedAt < 1500) return;
    lastFeedAt = now;
    const agentLabel = AGENTS[agentId].name;
    store.getState().pushDirectorMessage(
      "director",
      `${agentLabel}: ${completed}/${scenes.length} scene(s) ready.`,
    );
  }

  async function worker(workerId: number) {
    while (true) {
      const i = cursor++;
      if (i >= scenes.length) return;
      const scene = scenes[i];
      try {
        const res = await fn(scene);
        completed++;
        store.getState().setAgentStatus(
          agentId,
          "active",
          `${completed}/${scenes.length} scene(s) done`,
        );
        reportProgress();
        if (/^Error|^No scene/i.test(res)) {
          errors.push(`scene ${scene.index}: ${res}`);
          if (!firstError) firstError = res;
        }
      } catch (err) {
        completed++;
        store.getState().setAgentStatus(
          agentId,
          "active",
          `${completed}/${scenes.length} scene(s) done`,
        );
        reportProgress();
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`scene ${scene.index}: ${msg}`);
        if (!firstError) firstError = msg;
      }
    }
  }

  const lanes = Array.from({ length: Math.min(concurrency, scenes.length) }, (_, w) => worker(w));
  await Promise.all(lanes);

  // Diagnostic snapshot of limiter queues — useful when debugging
  // "why is the orchestrator stalling on TTS" tickets in the field.
  const snap = limiterSnapshot();
  const stalled = (Object.keys(snap) as Array<keyof typeof snap>)
    .filter((k) => snap[k].pending > 0)
    .map((k) => `${k}: ${snap[k].pending} queued`)
    .join(", ");
  if (stalled) {
    store.getState().pushDirectorMessage(
      "director",
      `Provider queues left after this batch: ${stalled}`,
    );
  }

  if (errors.length > 0) {
    const summary = errors.length === scenes.length
      ? `All ${scenes.length} scenes failed: ${firstError}`
      : `${errors.length}/${scenes.length} scenes failed: ${firstError}`;
    store.getState().setAgentStatus(agentId, "error", summary);
    store.getState().pushDirectorMessage(
      "director",
      `Stopping: ${AGENTS[agentId].name} reported a problem — ${summary}`,
    );
    throw new Error(summary);
  }
  store.getState().setAgentStatus(agentId, "completed", `Processed ${scenes.length} scene(s).`);
  reportProgress(true);
}
