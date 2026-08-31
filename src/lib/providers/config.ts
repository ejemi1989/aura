// Server-side provider configuration.
//
// All third-party API keys live here, never in the browser bundle. The
// generation routes in src/app/api/generate/* import from this module and
// pick the best available provider based on what's configured.
//
// If no key for a given capability is set, the route falls back to a
// deterministic placeholder so the studio remains demoable end-to-end
// without any paid accounts.

export type ProviderName = "openai" | "google" | "fal" | "replicate" | "speechify" | "runway" | "luma" | "demo";

export interface ProviderConfig {
  name: ProviderName;
  available: boolean;
  reason?: string;
}

/**
 * Returns the active provider for image generation. OpenAI's gpt-image-1 is
 * preferred when OPENAI_API_KEY is set, since it's the locked primary AI
 * provider per the production spec (system.md §7, §45). Replicate is the
 * alternative. FAL is intentionally NOT in this chain.
 */
/**
 * Reads a runtime config flag controlling whether routes may stream demo
 * placeholders. Defaults to true so the studio remains runnable with no
 * keys; set DEMO_MODE=false in production to force every route to return
 * an error when its provider isn't configured.
 */
export function demoModeAllowed(): boolean {
  return process.env.DEMO_MODE !== "false";
}

/**
 * Dead-man switch for the judge-facing live URL. When DEMO_MODE=enforced,
 * every provider selector returns `demo` even when real API keys are set,
 * so a deployed instance can NEVER trigger paid provider billing — the
 * Human Veto "Remake" path and any generation burn placeholders instead.
 * This makes a public demo link safe to hand to judges with zero cost risk,
 * regardless of what keys happen to be present in the environment.
 *
 * Set to "enforced" on the demo deploy; leave unset (or "true") locally so
 * real providers work when you record assets. Mutually exclusive with
 * building a paid demo — see DEMO_MODE=false above.
 */
export function demoModeEnforced(): boolean {
  return process.env.DEMO_MODE === "enforced";
}

/** If demo mode is enforced, return a demo provider config and skip keys. */
function enforcedIf(): ProviderConfig | null {
  if (demoModeEnforced()) {
    return {
      name: "demo",
      available: true,
      reason: "DEMO_MODE=enforced: real providers disabled on this demo instance.",
    };
  }
  return null;
}

export function imageProvider(): ProviderConfig {
  const enforced = enforcedIf();
  if (enforced) return enforced;
  // OpenAI is the locked image provider per .context/system.md §7 and §45.
  // FAL is intentionally not in the chain — the spec's DO NOT DO list
  // forbids adding it.
  if (process.env.OPENAI_API_KEY) {
    return { name: "openai", available: true };
  }
  if (process.env.REPLICATE_API_TOKEN) {
    return { name: "replicate", available: true };
  }
  return { name: "demo", available: true, reason: "No image provider key set; using placeholder image." };
}

export function textToSpeechProvider(): ProviderConfig {
  const enforced = enforcedIf();
  if (enforced) return enforced;
  // Speechify is the primary voice provider. When SPEECHIFY_API_KEY is set
  // it takes priority over OpenAI TTS; OpenAI is the alternative.
  if (process.env.SPEECHIFY_API_KEY) {
    return { name: "speechify", available: true };
  }
  if (process.env.OPENAI_API_KEY) {
    return { name: "openai", available: true };
  }
  return { name: "demo", available: true, reason: "No TTS provider key set; using silent placeholder audio." };
}

export function textToVideoProvider(): ProviderConfig {
  const enforced = enforcedIf();
  if (enforced) return enforced;
  // Google Veo 3 is the locked video primary per the production spec
  // (system.md §23, §45). FAL is intentionally not in the chain — the
  // spec's DO NOT DO list forbids adding it.
  if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) {
    return { name: "google", available: true };
  }
  if (process.env.RUNWAY_API_KEY) {
    return { name: "runway", available: true };
  }
  if (process.env.REPLICATE_API_TOKEN) {
    return { name: "replicate", available: true };
  }
  if (process.env.LUMA_API_KEY) {
    return { name: "luma", available: true };
  }
  return { name: "demo", available: true, reason: "No text-to-video provider key set; using placeholder clip." };
}

export function imageToVideoProvider(): ProviderConfig {
  const enforced = enforcedIf();
  if (enforced) return enforced;
  if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) {
    return { name: "google", available: true };
  }
  if (process.env.RUNWAY_API_KEY) {
    return { name: "runway", available: true };
  }
  if (process.env.LUMA_API_KEY) {
    return { name: "luma", available: true };
  }
  if (process.env.REPLICATE_API_TOKEN) {
    return { name: "replicate", available: true };
  }
  return { name: "demo", available: true, reason: "No image-to-video provider key set; using placeholder clip." };
}

export function hasOpenAI(): boolean {
  if (demoModeEnforced()) return false;
  return !!process.env.OPENAI_API_KEY;
}
