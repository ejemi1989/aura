export type Platform = "instagram" | "youtube" | "tiktok" | "linkedin" | "generic";
export type Style = "professional" | "casual" | "dramatic" | "playful" | "cinematic";

export interface ScriptBriefCtx {
  goal: string;
  audience: string;
  platform: Platform;
  style: Style;
  brandVoice?: string;
}

export interface ScriptBeat {
  name: string;
  /** Full beat text: stage direction + spoken line. Used as the image-generation
   *  prompt so the visual matches the brief, the platform, and the intent. */
  narrative: string;
  /** Just the words the narrator reads aloud. Fed into Speechify/OpenAI TTS
   *  and shown in the storyboard so what the audience hears matches what
   *  they see on the card. Falls back to `narrative` when unset. */
  voiceoverLine?: string;
  caption: string;
}

/**
 * Seasoned brand-scriptwriter engine. Turns a brief into a beat-sheet video
 * script (Hook → Pain → Promise → Proof → Objection/Zoom → Payoff → CTA)
 * written as concrete, spoken narration lines. The pipeline feeds each scene's
 * `description` straight into Speechify TTS, so writing real, brief-aware
 * narration here is what makes the voiceover sound agency-written rather than
 * templated.
 *
 * Server-safe: a pure function with no store dependency, shared by the WebMCP
 * `generate_script` tool and the `/api/webmcp/execute` + `/api/orchestrate`
 * API routes (which earlier shadowed it with an inline template).
 */
function platformProfile(p: Platform) {
  switch (p) {
    case "instagram":
      return {
        beats: ["Hook", "Pain", "Promise", "Proof", "Objection", "Zoom", "Payoff", "CTA"],
        cta: "link in bio",
        register: "direct, energetic, second-person, fast cuts",
        firstLine: "Lead with the boldest version of the payoff so the reel cannot be scrolled past.",
      };
    case "tiktok":
      return {
        beats: ["Hook", "Pain", "Promise", "Proof", "Zoom", "Payoff", "CTA"],
        cta: "follow and tap the link",
        register: "playful, casual, punchy one-liners",
        firstLine: "Open on a curiosity or pattern-interrupt to start the loop in the first second.",
      };
    case "youtube":
      return {
        beats: ["Hook", "Setup", "Pain", "Promise", "Proof", "Objection", "Zoom", "Payoff", "CTA"],
        cta: "sign up for early access",
        register: "warm, narrative, first-person, conversational storytelling",
        firstLine: "Open with a relatable moment or a question that invites the viewer into the story.",
      };
    case "linkedin":
      return {
        beats: ["Hook", "Context", "Pain", "Promise", "Proof", "Objection", "Payoff", "CTA"],
        cta: "request early access",
        register: "professional, credible, evidence-first, plainspoken confidence",
        firstLine: "Open with a credible, specific claim or a plainspoken problem statement.",
      };
    default:
      return {
        beats: ["Hook", "Pain", "Promise", "Proof", "Objection", "Zoom", "Payoff", "CTA"],
        cta: "sign up today",
        register: "clear, benefit-led, plainspoken",
        firstLine: "Open with a clear hook that names the outcome the viewer wants.",
      };
  }
}

function toneFor(style: Style) {
  switch (style) {
    case "cinematic":
      return { warm: ["grounded", "elemental", "felt"], verbs: ["feel", "remember"] };
    case "dramatic":
      return { warm: ["uncompromising", "striking", "bold"], verbs: ["demand", "insist"] };
    case "playful":
      return { warm: ["light", "easy", "enjoyable"], verbs: ["glide", "enjoy"] };
    case "casual":
      return { warm: ["everyday", "relatable", "simple"], verbs: ["walk", "move"] };
    default:
      return { warm: ["durable", "deliberate", "trusted"], verbs: ["choose", "rely"] };
  }
}

/**
 * Pull a clean shoe product name out of a goal/brief line, e.g.
 * "drive signups for an eco walking-shoe launch" → "eco walking shoe".
 * Falls back to a sensible default when nothing recognizable is found.
 */
function extractProduct(goal: string): string {
  const m = goal.match(/([\w-]*\s?){0,3}(?:shoe|sneaker|footwear)/i);
  let s = m ? m[0] : "";
  s = s.replace(/-/g, " ").trim();
  s = s
    .replace(/^(a|an|the|to|for|of|your|their|buy|sell|drive|increase|boost|promote|launch|get|our)\s+/i, "")
    .trim();
  return s || "our walking shoe";
}

/**
 * Build `n` beats for a brief. Guarantees at least one beat (clamps 1..12).
 */
export function buildBeats(n: number, brief: ScriptBriefCtx, keyMessage: string): ScriptBeat[] {
  const count = Math.max(1, Math.min(12, Math.round(n)));
  const prof = platformProfile(brief.platform);
  const tone = toneFor(brief.style);
  const audience = brief.audience?.trim() || "the people watching";
  const goal = brief.goal?.trim() || keyMessage;
  const isShoe = /shoe|footwear|sneaker|walk/.test(goal);
  const isEco = /eco|green|recycled|sustain|carbon/.test(goal);
  const product = isShoe ? extractProduct(goal) : "what we built";
  const brandVoice = brief.brandVoice?.trim();
  const voiceSuffix = brandVoice ? ` (in ${brandVoice} brand voice)` : "";
  const reasonNow =
    brief.platform === "linkedin"
      ? "Request early access today and get founder pricing plus a launch invite."
      : "First 1,000 signups get founder pricing and early access before it sells out.";

  const spokenHook = `${keyMessage || goal} — and it starts with the ${isShoe ? "shoes you walk in" : "details you notice"}.`;
  const arc: Array<{ name: string; narrative: () => string; voiceoverLine: () => string; caption: string }> = [
    {
      name: "Hook",
      narrative: () =>
        `${prof.firstLine} Spoken opener: "${spokenHook}"`,
      voiceoverLine: () => spokenHook,
      caption: "Hook",
    },
    {
      name: "Setup",
      narrative: () =>
        `You've probably seen the pitch before. This one's different, because it's built for ${audience}, on purpose.`,
      voiceoverLine: () =>
        `You've probably seen the pitch before. This one's different, because it's built for ${audience}, on purpose.`,
      caption: "Setup",
    },
    {
      name: "Context",
      narrative: () =>
        `For ${audience}, the choice was never about a single product. It's about the habits and standards that come with it.`,
      voiceoverLine: () =>
        `For ${audience}, the choice was never about a single product. It's about the habits and standards that come with it.`,
      caption: "Context",
    },
    {
      name: "Pain",
      narrative: () =>
        `You want to ${tone.verbs[0]} more. But every ${isShoe ? "walking shoe" : "option"} you've tried is either ${tone.warm[0]} to look at or made from things you can't feel good about — and you deserve ${tone.warm[1]} that finally lines up.`,
      voiceoverLine: () =>
        `You want to ${tone.verbs[0]} more. But every ${isShoe ? "walking shoe" : "option"} you've tried is either ${tone.warm[0]} to look at or made from things you can't feel good about — and you deserve ${tone.warm[1]} that finally lines up.`,
      caption: "Pain",
    },
    {
      name: "Promise",
      narrative: () =>
        `Meet ${product}, built ${isEco ? "from recycled materials" : "around you"}, designed to be ${tone.warm[1]} from the very first step.`,
      voiceoverLine: () =>
        `Meet ${product}, built ${isEco ? "from recycled materials" : "around you"}, designed to be ${tone.warm[1]} from the very first step.`,
      caption: "Promise",
    },
    {
      name: "Proof",
      narrative: () =>
        `Here's the proof: ${isEco ? "62% recycled materials," : "a build that lasts,"} real-world testing, and design that earns its place in a daily routine.`,
      voiceoverLine: () =>
        `Here's the proof: ${isEco ? "62% recycled materials," : "a build that lasts,"} real-world testing, and design that earns its place in a daily routine.`,
      caption: "Proof",
    },
    {
      name: "Objection",
      narrative: () =>
        `You might think ${isEco ? "better for the planet" : "a smarter build"} means worse for your feet. It doesn't — comfort and conscience can share one ${isShoe ? "walking shoe" : "product"}.`,
      voiceoverLine: () =>
        `You might think ${isEco ? "better for the planet" : "a smarter build"} means worse for your feet. It doesn't — comfort and conscience can share one ${isShoe ? "walking shoe" : "product"}.`,
      caption: "Objection",
    },
    {
      name: "Zoom",
      narrative: () =>
        `This is where it clicks: the ${tone.warm[2]} details, ${isShoe ? "the stride," : "the build,"} the feeling that someone made this for ${audience}.`,
      voiceoverLine: () =>
        `This is where it clicks: the ${tone.warm[2]} details, ${isShoe ? "the stride," : "the build,"} the feeling that someone made this for ${audience}.`,
      caption: "Zoom",
    },
    {
      name: "Payoff",
      narrative: () =>
        `More ${isShoe ? "steps" : "movement"}, less compromise — and a choice you can feel good about every single day.`,
      voiceoverLine: () =>
        `More ${isShoe ? "steps" : "movement"}, less compromise — and a choice you can feel good about every single day.`,
      caption: "Payoff",
    },
    {
      name: "CTA",
      narrative: () => `${reasonNow} ${prof.cta} — it takes 30 seconds.`,
      voiceoverLine: () => `${reasonNow} ${prof.cta} — it takes 30 seconds.`,
      caption: "Sign up",
    },
  ];

  const beats: ScriptBeat[] = [];
  // We have exactly `arc.length` distinct beats. Asking for more scenes than
  // that must NOT repeat the same narration line (previously `arc[i] ??
  // arc[arc.length-1]` looped the CTA back on itself, so scenes 11 & 12
  // read the exact same voiceover — the "repeating audio script" bug). Every
  // scene gets its own distinct spoken line instead.
  const continuationLines = continuationFor(product, tone, audience, isEco, isShoe);
  for (let i = 0; i < count; i++) {
    const isArcBeat = i < arc.length;
    const tpl = isArcBeat ? arc[i] : null;
    const name = tpl?.name ?? `Scene ${i + 1}`;
    const spoken = tpl
      ? tpl.voiceoverLine()
      : continuationLines[i - arc.length];
    const narrative = tpl
      ? tpl.narrative()
      : `${spoken} (${name.toLowerCase()})`;
    const clean = (s: string) => s.replace(/\s+/g, " ").trim();
    beats.push({
      name,
      narrative: name === "CTA" ? clean(narrative) : clean(`${narrative}${voiceSuffix}`),
      voiceoverLine:
        name === "CTA" ? clean(spoken) : clean(`${spoken}${voiceSuffix}`),
      caption: tpl?.caption ?? "Keep going",
    });
  }
  return beats;
}

/**
 * Distinct spoken lines for scenes beyond the built-in beat arc, so a long
 * script (8+ beats) never repeats the same narration. Each entry is a
 * different angle that stays on-message and reads like a real continuation.
 */
function continuationFor(
  product: string,
  tone: { warm: string[]; verbs: string[] },
  audience: string,
  isEco: boolean,
  isShoe: boolean
): string[] {
  const subject = isShoe ? product : "it";
  return [
    `And here's the part most people miss: ${subject} is built around ${audience}, not around a spec sheet.`,
    `Think about your last ${isShoe ? "walk" : "workday"} — the moments you actually noticed. That feeling is the whole point of ${product}.`,
    `Behind the scenes, ${product} was field-tested where ${audience} actually live, not in a showroom.`,
    `Every detail in ${product} earns its place — nothing is there just to fill a spec.`,
    `The real win isn't the ${isEco ? "materials" : "features"}. It's that ${subject} fits the way ${audience} actually live.`,
    `Give ${product} one honest week. You'll feel the difference before you can name it.`,
  ];
}
