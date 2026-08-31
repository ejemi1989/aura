// LLM-powered specialist agents. Each content-producing expert reasons through
// chatJSON and falls back to a deterministic implementation when the LLM is
// unavailable (no key / no credits / model error), so the studio degrades
// gracefully instead of breaking.
//
// These are the *experts* the agentic Director (/api/orchestrate) delegates to.
// The Director decides the sequence; the specialists here author the content.

import { chatJSON, LLMUnavailableError } from "@/lib/llm/chat";

interface BriefLike {
  goal?: string;
  audience?: string;
  platform?: string;
  style?: string;
  brandVoice?: string;
  targetDurationSeconds?: number;
}

// ---------------------------------------------------------------------------
// Scriptwriter
// ---------------------------------------------------------------------------

export interface LLMScriptBeat {
  index: number;
  beatName: string;
  description: string;
  voiceoverLine: string;
  caption: string;
  durationEstimate: number;
}

const SCRIPT_SYSTEM = `You are a senior scriptwriter for short-form brand video.
You write scripts that respect the platform's pacing, the audience, and the brand
voice. Every scene has: a beat (Hook/Pain/Promise/Proof/Objection/Zoom/CTA), a
production note (the staged visual), the exact line the narrator reads aloud, a
short on-screen caption, and a duration estimate in seconds. Write like a working
creative, not a template. Vary cadence across scenes — hook fast, let proof breathe.
Do not invent data or claims without marking them as placeholders like [X].`;

const SCRIPT_SCHEMA = {
  prompt: `Return a JSON object of the form {"scenes":[{"index":1,"beatName":"Hook","description":"stage direction","voiceoverLine":"narrator reads this","caption":"on-screen","durationEstimate":5}]}`,
  shape: (raw: unknown): LLMScriptBeat[] => {
    const scenes = (raw as any)?.scenes;
    if (!Array.isArray(scenes)) throw new Error("script LLM: missing scenes array");
    return scenes.map((s: any, i: number) => ({
      index: Number(s?.index ?? i + 1),
      beatName: String(s?.beatName ?? ""),
      description: String(s?.description ?? ""),
      voiceoverLine: String(s?.voiceoverLine ?? s?.description ?? ""),
      caption: String(s?.caption ?? ""),
      durationEstimate: Number(s?.durationEstimate ?? 5) || 5,
    }));
  },
};

export async function llmWriteScript(count: number, brief: BriefLike): Promise<LLMScriptBeat[] | null> {
  try {
    return await chatJSON<LLMScriptBeat[]>(
      `Write a ${count}-scene short-form video script for this brand.
Goal: ${brief.goal ?? ""}
Audience: ${brief.audience ?? ""}
Platform: ${brief.platform ?? ""}
Style: ${brief.style ?? ""}
Brand voice: ${brief.brandVoice ?? ""}
Target duration: ${brief.targetDurationSeconds ?? 30}s`,
      SCRIPT_SCHEMA,
      {
        system: SCRIPT_SYSTEM,
        channel: "script",
        temperature: 0.85,
        maxTokens: 1600,
      }
    );
  } catch (err) {
    if (err instanceof LLMUnavailableError) return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Graphic Designer — storyboard (art-directed image prompts)
// ---------------------------------------------------------------------------

export interface LLPrompts {
  scenePrompts: { index: number; prompt: string }[];
}

const STORYBOARD_SYSTEM = `You are an art director who writes image-generation prompts
for a commercial video. For each scene you return a single detailed prompt: shot type
and camera, key subject, setting, lighting, color grade, composition, and mood — all
grounded in the brand style. Prompts must be self-contained for a text-to-image model
(no references to "the previous scene"). Write concrete visual language, not vague
adjectives.`;

const STORYBOARD_SCHEMA = {
  prompt: `Return JSON of the form {"scenePrompts":[{"index":1,"prompt":"... shot, subject, setting, lighting, color, mood ..."}]}`,
  shape: (raw: unknown): LLPrompts => {
    const sp = (raw as any)?.scenePrompts;
    if (!Array.isArray(sp)) throw new Error("storyboard LLM: missing scenePrompts");
    return {
      scenePrompts: sp.map((p: any) => ({
        index: Number(p?.index),
        prompt: String(p?.prompt ?? ""),
      })),
    };
  },
};

export async function llmStoryboard(
  scenes: { index: number; description: string; voiceoverLine?: string }[],
  brief: BriefLike
): Promise<LLPrompts | null> {
  try {
    const sceneLines = scenes
      .map(
        (s) => `${s.index}. ${s.description}${s.voiceoverLine ? ` — narrator: "${s.voiceoverLine}"` : ""}`
      )
      .join("\n");
    return await chatJSON<LLPrompts>(
      `Produce a storyboard image prompt for each scene.
Brand style: ${brief.style ?? ""} · platform: ${brief.platform ?? ""} · audience: ${brief.audience ?? ""}

Scenes:
${sceneLines}`,
      STORYBOARD_SCHEMA,
      { system: STORYBOARD_SYSTEM, channel: "storyboard", temperature: 0.9, maxTokens: 1800 }
    );
  } catch (err) {
    if (err instanceof LLMUnavailableError) return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Copywriter — on-screen text / hook / post caption
// ---------------------------------------------------------------------------

export interface LMCaption {
  text: string;
}

const CAPTION_SCHEMA = {
  prompt: `Return JSON of the form {"text":"... short platform-native copy ..."}`,
  shape: (raw: unknown): LMCaption => ({ text: String((raw as any)?.text ?? "") }),
};

const CAPTION_SYSTEM = `You are a copywriter for short-form social video. You write
punchy on-screen text, hooks, and post captions tuned to the platform's register.
Keep on-screen text to a handful of words a viewer can read in one glance. Hooks
open with tension. Captions use the platform's voice. No hashtag-stuffing.`;

export async function llmCaption(
  purpose: "on_screen_text" | "post_caption" | "hook_line",
  scene: { description: string; voiceoverLine?: string },
  brief: BriefLike
): Promise<string | null> {
  try {
    const res = await chatJSON<LMCaption>(
      `Purpose: ${purpose}
Platform: ${brief.platform ?? ""} · style: ${brief.style ?? ""}
Scene visual: ${scene.description}
${scene.voiceoverLine ? `Narrator says: "${scene.voiceoverLine}"` : ""}`,
      CAPTION_SCHEMA,
      { system: CAPTION_SYSTEM, channel: `caption:${purpose}`, temperature: 0.9, maxTokens: 120 }
    );
    return res.text || null;
  } catch (err) {
    if (err instanceof LLMUnavailableError) return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Critic / QA
// ---------------------------------------------------------------------------

export interface LLMReview {
  verdict: "APPROVED" | "NEEDS_REVISION";
  notes: string[];
}

const REVIEW_SYSTEM = `You are the final critic/QA gate for a brand video. Review the
project against the brief and brand guidelines. You do NOT generate content — you find
what is weak, on- or off-brand, unclear, or poorly paced, and give specific, actionable
notes a specialist could fix. Return APPROVED only if it genuinely holds up; otherwise
NEEDS_REVISION with concrete, non-platitudinous notes.`;

const REVIEW_SCHEMA = {
  prompt: `Return JSON of the form {"verdict":"APPROVED"|"NEEDS_REVISION","notes":["..."]}`,
  shape: (raw: unknown): LLMReview => {
    const v = String((raw as any)?.verdict ?? "").toUpperCase();
    const notes = Array.isArray((raw as any)?.notes) ? (raw as any).notes.map(String) : [];
    return { verdict: v === "APPROVED" ? "APPROVED" : "NEEDS_REVISION", notes };
  },
};

export async function llmReview(
  project: { name?: string; brief?: BriefLike; qaVerdict?: string; qaNotes?: string[] },
  scenes: { index: number; description: string; voiceoverLine?: string; caption?: string; beatName?: string }[]
): Promise<LLMReview | null> {
  try {
    const brief = project.brief ?? {};
    const sceneLines = scenes
      .map(
        (s) =>
          `${s.index}. [${s.beatName ?? "beat"}] ${s.description}${s.voiceoverLine ? ` | VO: "${s.voiceoverLine}"` : ""}${s.caption ? ` | caption: "${s.caption}"` : ""}`
      )
      .join("\n");
    return await chatJSON<LLMReview>(
      `Campaign: ${project.name ?? ""}
Goal: ${brief.goal ?? ""} · Audience: ${brief.audience ?? ""} · Platform: ${brief.platform ?? ""} · Style: ${brief.style ?? ""}

Script & production:
${sceneLines}

Prior QA (if any): ${(project.qaNotes ?? []).join("; ") || "none"}
Review it and return a verdict.`,
      REVIEW_SCHEMA,
      { system: REVIEW_SYSTEM, channel: "review", temperature: 0.3, maxTokens: 500 }
    );
  } catch (err) {
    if (err instanceof LLMUnavailableError) return null;
    throw err;
  }
}
