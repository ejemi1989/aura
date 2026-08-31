import { NextRequest, NextResponse } from "next/server";
import { imageProvider, demoModeAllowed } from "@/lib/providers/config";
import { openaiGenerateImage } from "@/lib/providers/openai";
import { badRequest, notConfigured, upstreamErrorResponse } from "@/lib/providers/http";
import { renderDemoImage, newAssetId } from "@/lib/providers/demoAssets";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RequestBody {
  prompt: string;
  // gpt-image-1 supported sizes (dall-e-3 sizes like 1792x1024 fail with 400).
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  projectId?: string;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return badRequest("Request body must be JSON.");
  }

  if (!body.prompt || typeof body.prompt !== "string" || body.prompt.trim().length < 3) {
    return badRequest("Field 'prompt' is required and must be at least 3 characters.", {
      prompt: "required",
    });
  }

  const provider = imageProvider();

  if (provider.name === "openai") {
    try {
      const result = await openaiGenerateImage(body.prompt, body.size ?? "1536x1024");
      return NextResponse.json({
        mode: "live",
        provider: "openai",
        url: result.url,
        model: result.model,
        revisedPrompt: result.revisedPrompt,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // If the upstream is 429 (out of credits / rate limit) or the account
      // is locked for an exhausted balance, AND demo is allowed, drop to demo
      // mode so the studio keeps producing assets rather than stalling. A
      // 5xx/4xx that isn't credits-related still surfaces as an error so the
      // human can see real failures.
      const isOutOfCredits = /\b429\b|out of credits|rate limit|exhausted|insufficient|user is locked/i.test(message);
      if (isOutOfCredits && demoModeAllowed()) {
        const id = newAssetId("img");
        const url = await renderDemoImage(body.prompt, id);
        return NextResponse.json({
          mode: "demo-fallback",
          provider: "demo",
          url,
          model: "demo-poster",
          reason: message,
          note:
            "OpenAI returned 429 (out of credits). Fell back to a real demo placeholder " +
            "so the studio keeps moving. Top up OPENAI_API_KEY or set DEMO_MODE=false to disable.",
        });
      }
      return upstreamErrorResponse({ provider: "openai", status: 502, message });
    }
  }

  if (!demoModeAllowed()) {
    return notConfigured(provider.name, "image generation");
  }

  // Demo path: render a real, visually distinct 1792×1024 PNG via
  // rsvg-convert so the storyboard and video preview are populated
  // even with zero API keys. Same hue as a real keyframe for that
  // prompt, so the studio looks like it's working.
  const id = newAssetId("img");
  const url = await renderDemoImage(body.prompt, id);
  return NextResponse.json({
    mode: "demo",
    provider: "demo",
    url,
    model: "demo-poster",
    note:
      "Demo mode — rendered a real placeholder image. Set OPENAI_API_KEY to swap in gpt-image-1. " +
      "Set DEMO_MODE=false to disable placeholders.",
  });
}
