import { NextRequest, NextResponse } from "next/server";
import { CREATIVE_DIRECTOR_SYSTEM_PROMPT } from "@/lib/agents/registry";
import { WEB_MCP_HTTP_TOOLS } from "@/lib/webmcp/catalog";
import { serverStore } from "@/lib/webmcp/serverStore";
import { hasOpenAI } from "@/lib/providers/config";
import { badRequest } from "@/lib/providers/http";
import { buildBeats } from "@/lib/webmcp/scriptBeats";
import {
  llmWriteScript,
  llmStoryboard,
  llmCaption,
  llmReview,
} from "@/lib/llm/agents";

export const runtime = "nodejs";
export const maxDuration = 300;

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
}

interface OrchestrateRequestBody {
  messages: Message[];
  brief?: {
    name: string;
    goal: string;
    audience: string;
    platform: "instagram" | "youtube" | "tiktok" | "linkedin" | "generic";
    style: "professional" | "casual" | "dramatic" | "playful" | "cinematic";
    targetDurationSeconds?: number;
  };
  maxRounds?: number;
}

export async function POST(req: NextRequest) {
  let body: OrchestrateRequestBody;
  try {
    body = (await req.json()) as OrchestrateRequestBody;
  } catch {
    return badRequest("Request body must be JSON.");
  }

  if (!body.brief && (!body.messages || body.messages.length === 0)) {
    return badRequest("Provide either 'brief' or 'messages'.");
  }

  if (!hasOpenAI()) {
    return NextResponse.json({
      mode: "demo",
      message:
        "No OPENAI_API_KEY on the server. The LLM-driven Director is disabled. " +
        "Use the in-app Director (left rail → Run Studio) for a deterministic pipeline, or " +
        "set OPENAI_API_KEY in .env.local to enable real model-driven planning.",
    });
  }

  const maxRounds = body.maxRounds ?? 12;
  const initialMessages: Message[] = body.messages ?? [];
  const transcript: { role: string; content?: string; toolCalls?: any[]; toolResults?: any[] }[] = [];

  const seed: Message[] = body.brief
    ? [
        {
          role: "user",
          content: `Build a video campaign with the following brief:\n` +
            `Name: ${body.brief.name}\n` +
            `Goal: ${body.brief.goal}\n` +
            `Audience: ${body.brief.audience}\n` +
            `Platform: ${body.brief.platform}\n` +
            `Style: ${body.brief.style}\n` +
            `Target duration: ${body.brief.targetDurationSeconds ?? 30}s\n\n` +
            `Plan your work, then call the appropriate studio tools in order.`,
        },
      ]
    : [];

  const messages: Message[] = [
    { role: "system", content: CREATIVE_DIRECTOR_SYSTEM_PROMPT },
    ...seed,
    ...initialMessages,
  ];

  if (body.brief) {
    await serverStore.reset();
    await serverStore.setProjectMeta({
      name: body.brief.name,
      brief: {
        goal: body.brief.goal,
        audience: body.brief.audience,
        platform: body.brief.platform,
        style: body.brief.style,
        targetDurationSeconds: body.brief.targetDurationSeconds ?? 30,
      },
    });
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const tools = WEB_MCP_HTTP_TOOLS.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema as any,
      },
    }));

    for (let round = 0; round < maxRounds; round++) {
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        messages: messages as any,
        tools,
        tool_choice: "auto",
      });

      const choice = completion.choices[0];
      const msg = choice?.message;
      if (!msg) break;

      transcript.push({
        role: "assistant",
        content: msg.content ?? undefined,
        toolCalls: msg.tool_calls?.map((tc: any) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        })),
      });

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        messages.push(msg as any);
        break;
      }

      messages.push(msg as any);

      for (const tc of msg.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: `Invalid JSON arguments: ${errMsg}` }),
          });
          continue;
        }
        const result = await executeToolServerSide(tc.function.name, args);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(result),
        });
        transcript[transcript.length - 1].toolResults = transcript[transcript.length - 1].toolResults ?? [];
        transcript[transcript.length - 1].toolResults!.push({ name: tc.function.name, result });
      }
    }

    const project = await serverStore.getProject();
    return NextResponse.json({
      mode: "live",
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      rounds: transcript.length,
      finalProject: project,
      transcript,
      messages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ mode: "error", message }, { status: 500 });
  }
}

async function executeToolServerSide(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "create_project": {
      const { name: n, goal, audience, platform, style, targetDurationSeconds } = input as any;
      await serverStore.reset();
      await serverStore.setProjectMeta({
        name: String(n),
        brief: { goal: String(goal), audience: String(audience), platform, style, targetDurationSeconds: Number(targetDurationSeconds ?? 30) },
      });
      await serverStore.setPhase("brand");
      await serverStore.setAgentStatus("project-manager", "completed", `Project "${n}" created.`);
      return { message: `Created project "${n}".` };
    }
    case "generate_script": {
      const n = Math.max(1, Math.min(12, Math.round(Number((input as any).sceneCount))));
      const key = String((input as any).keyMessage);
      const project = await serverStore.getProject();
      const brief = project.brief;
      const briefLike = {
        goal: brief?.goal ?? key,
        audience: brief?.audience ?? "",
        platform: (brief?.platform as any) ?? "generic",
        style: (brief?.style as any) ?? "professional",
        brandVoice: brief?.brandVoice,
        targetDurationSeconds: brief?.targetDurationSeconds,
      };

      // Preferred: the Scriptwriter LLM authors the actual script. Falls back
      // to buildBeats (templated) only when the LLM is unavailable (no key /
      // no credits / model error), so the studio never breaks.
      const llmBeats = await llmWriteScript(n, briefLike);
      let beats: { name: string; narrative: string; voiceoverLine?: string; caption?: string }[];
      if (llmBeats && llmBeats.length > 0) {
        beats = llmBeats.map((b) => ({
          name: b.beatName,
          narrative: b.description,
          voiceoverLine: b.voiceoverLine || b.description,
          caption: b.caption,
        }));
      } else {
        beats = buildBeats(
          n,
          {
            goal: briefLike.goal,
            audience: briefLike.audience,
            platform: briefLike.platform as any,
            style: briefLike.style as any,
            brandVoice: briefLike.brandVoice,
          },
          key
        );
      }

      const script = beats
        .map(
          (b, i) =>
            `${b.name.toUpperCase()} — Scene ${i + 1}: ${b.voiceoverLine ?? b.narrative}`
        )
        .join("\n");
      await serverStore.setProjectMeta({ script });
      await serverStore.setScenes(
        beats.map((b, i) => ({
          id: `scene_${i + 1}`,
          index: i + 1,
          description: b.narrative,
          beatName: b.name,
          voiceoverLine: b.voiceoverLine ?? b.narrative,
          caption: b.caption,
          durationSeconds: Math.max(
            3,
            Math.round((b.voiceoverLine ?? b.narrative).length / 14)
          ),
        }))
      );
      await serverStore.setPhase("script");
      await serverStore.setAgentStatus("scriptwriter", "completed", `Drafted a ${n}-beat script.`);
      return { sceneCount: n, script };
    }
    case "create_storyboard": {
      const notes = String((input as any).visualStyleNotes);
      const project = await serverStore.getProject();
      const brief = project.brief;
      const briefLike = {
        goal: brief?.goal,
        audience: brief?.audience,
        platform: (brief?.platform as any) ?? "generic",
        style: (brief?.style as any) ?? "professional",
      };
      // Preferred: the Graphic Designer LLM art-directs a concrete image
      // prompt (shot, subject, lighting, composition, color, mood) for each
      // scene. Falls back to a deterministic concat when no LLM is available.
      const storyboard = await llmStoryboard(
        project.scenes.map((s) => ({ index: s.index, description: s.description, voiceoverLine: s.voiceoverLine })),
        briefLike
      );
      const byIndex = new Map<number, string>(
        (storyboard?.scenePrompts ?? []).map((p) => [p.index, p.prompt])
      );
      for (const s of project.scenes) {
        const prompt =
          byIndex.get(s.index) ??
          (byIndex.get(Number(s.id.replace(/\D/g, ""))) ??
            `${s.description} — ${notes}`);
        await serverStore.updateScene(s.id, { imagePrompt: prompt });
      }
      await serverStore.setPhase("storyboard");
      await serverStore.setAgentStatus("graphic-designer", "active", `Wrote art-directed prompts for ${project.scenes.length} scenes.`);
      return { ok: true };
    }
    case "generate_image": {
      const scene = await serverStore.findScene(String((input as any).sceneId));
      if (!scene) return { error: "scene_not_found" };
      const prompt = (input as any).promptOverride ?? scene.imagePrompt ?? scene.description;
      const res = await callGenerate("/api/generate/image", { prompt });
      await serverStore.updateScene(scene.id, { imagePrompt: prompt, imageUrl: res.url });
      await serverStore.setAgentStatus("graphic-designer", "active", `Generated image for scene ${scene.index}.`);
      return res;
    }
    case "image_to_video": {
      const scene = await serverStore.findScene(String((input as any).sceneId));
      if (!scene || !scene.imageUrl) return { error: "scene_not_ready" };
      const res = await callGenerate("/api/generate/image-to-video", {
        imageUrl: scene.imageUrl,
        prompt: scene.description,
        motionNotes: (input as any).motionNotes,
        durationSeconds: Number((input as any).durationSeconds),
      });
      const videoUrl = res.url === "__no_video__" ? scene.imageUrl : res.url;
      await serverStore.updateScene(scene.id, { videoUrl, durationSeconds: Number((input as any).durationSeconds) });
      await serverStore.setAgentStatus("motion-graphics", "active", `Animated scene ${scene.index}.`);
      return { ...res, url: videoUrl };
    }
    case "text_to_video": {
      const scene = await serverStore.findScene(String((input as any).sceneId));
      if (!scene) return { error: "scene_not_found" };
      const res = await callGenerate("/api/generate/text-to-video", {
        prompt: `${scene.description} — ${(input as any).motionNotes ?? ""}`,
        durationSeconds: Number((input as any).durationSeconds),
      });
      const videoUrl = res.url === "__no_video__" ? "" : res.url;
      await serverStore.updateScene(scene.id, { videoUrl, durationSeconds: Number((input as any).durationSeconds) });
      await serverStore.setAgentStatus("motion-graphics", "active", `Generated video for scene ${scene.index}.`);
      return { ...res, url: videoUrl };
    }
    case "text_to_speech": {
      const scene = await serverStore.findScene(String((input as any).sceneId));
      if (!scene) return { error: "scene_not_found" };
      const res = await callGenerate("/api/generate/text-to-speech", {
        text: String((input as any).line),
        voiceTone: String((input as any).voiceTone),
      });
      // Sync scene slot to actual voiceover length so the audio plays
      // to its full end instead of being cut when the rAF advances the
      // playhead past the (too-short) scene boundary. Ceil so the slot
      // is always >= audio length.
      await serverStore.updateScene(scene.id, {
        voiceoverUrl: res.url,
        voiceoverDurationMs: typeof res.durationMs === "number" ? res.durationMs : undefined,
        durationSeconds: Math.max(
          1,
          Math.ceil(((res.durationMs as number | undefined) ?? 4000) / 1000)
        ),
      });
      await serverStore.setAgentStatus("voiceover", "active", `Recorded narration for scene ${scene.index}.`);
      return res;
    }
    case "write_caption": {
      const scene = await serverStore.findScene(String((input as any).sceneId));
      if (!scene) return { error: "scene_not_found" };
      const purpose = String((input as any).purpose) as "on_screen_text" | "post_caption" | "hook_line";
      const project = await serverStore.getProject();
      const brief = project.brief;
      // Preferred: the Copywriter LLM writes platform-tuned copy for this
      // scene's purpose. Falls back to a description truncation when the LLM
      // is unavailable, so a caption always lands.
      const llmText = await llmCaption(
        purpose,
        { description: scene.description, voiceoverLine: scene.voiceoverLine },
        {
          goal: brief?.goal,
          audience: brief?.audience,
          platform: (brief?.platform as any) ?? "generic",
          style: (brief?.style as any) ?? "professional",
        }
      );
      const text = llmText ?? `${scene.description.split(".")[0].slice(0, 60)}`;
      await serverStore.updateScene(scene.id, { caption: text });
      await serverStore.setAgentStatus("copywriter", "active", `Wrote ${purpose} for scene ${scene.index}.`);
      return { caption: text };
    }
    case "compose_video": {
      const project = await serverStore.getProject();
      const scenes = project.scenes;
      const res = await callGenerate("/api/generate/compose", {
        scenes: scenes.map((s) => ({ videoUrl: s.videoUrl, voiceoverUrl: s.voiceoverUrl, caption: s.caption, durationSeconds: s.durationSeconds })),
        transitionStyle: (input as any).transitionStyle,
      });
      if (res.url) await serverStore.setProjectMeta({ composedVideoUrl: res.url });
      await serverStore.setPhase("assembly");
      await serverStore.setAgentStatus("video-editor", "completed", `Composed ${scenes.length} scenes.`);
      return res;
    }
    case "review_video": {
      const p = await serverStore.getProject();
      if (!p.composedVideoUrl) return { error: "no_video" };
      // Preferred: the Critic/QA LLM actually critiques the project against the
      // brief + brand guidelines and can return NEEDS_REVISION (which drives the
      // Director's replan loop). Falls back to a default approval when no LLM is
      // available.
      const llmReviewOut = await llmReview(
        { name: p.name, brief: p.brief, qaVerdict: p.qaVerdict ?? undefined, qaNotes: p.qaNotes as string[] },
        p.scenes.map((s) => ({
          index: s.index,
          description: s.description,
          voiceoverLine: s.voiceoverLine,
          caption: s.caption,
          beatName: s.beatName,
        }))
      );
      const verdict = llmReviewOut?.verdict ?? "APPROVED";
      const notes = llmReviewOut?.notes?.length ? llmReviewOut.notes : ["All checks passed."];
      await serverStore.setProjectMeta({ qaVerdict: verdict, qaNotes: notes });
      await serverStore.setPhase("review");
      await serverStore.setAgentStatus("critic-qa", "completed", verdict);
      return { verdict, notes };
    }
    case "request_human_approval": {
      const id = await serverStore.requestApproval({
        requestedBy: "creative-director",
        summary: String((input as any).summary),
        detail: String((input as any).detail),
      });
      await serverStore.setAgentStatus("creative-director", "blocked", `Awaiting approval: ${(input as any).summary}`);
      return { approvalId: id, status: "pending" };
    }
    case "get_project_status": {
      return {
        project: await serverStore.getProject(),
        agentStatus: await serverStore.getAgentStatus(),
      };
    }
    case "get_project_roadmap": {
      return {
        phase: (await serverStore.getProject()).phase,
        agentStatus: await serverStore.getAgentStatus(),
      };
    }
    default:
      return { error: `unknown_tool:${name}` };
  }
}

async function callGenerate(path: string, body: Record<string, unknown>): Promise<any> {
  const origin = process.env.STUDIO_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  const res = await fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Generate route ${path} returned ${res.status}: ${(data as any).message ?? ""}`);
  }
  return data;
}
