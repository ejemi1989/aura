# Video provider options

When the studio needs a real AI-generated video (image-to-video or
text-to-video), it tries providers in this order:

| Priority | Provider    | Env var               | Cost/sec (USD) | Notes |
| -------- | ----------- | --------------------- | -------------- | ----- |
| 1        | fal.ai      | `FAL_KEY`             | ~$0.05         | **Default.** Hosts ByteDance Seedance 2.0 (i2v + t2v). |
| 2        | Google Veo  | `GOOGLE_API_KEY`      | ~$0.35         | Best quality. 429 quota is the most common blocker. |
| 3        | Runway      | `RUNWAY_API_KEY`      | ~$0.12         | Direct Gen-3 access. |
| 4        | Luma        | `LUMA_API_KEY`        | ~$0.10         | Luma Ray i2v. |
| 5        | Replicate   | `REPLICATE_API_TOKEN` | ~$0.08         | Hosts many models. |
| 6        | Procedural  | _(none, browser)_     | $0             | Canvas + MediaRecorder. Last resort. |

> Images use the same provider chain via `FAL_IMAGE_MODEL` (default:
> Google **Nano Banana**, `fal-ai/nano-banana`; `nano-banana-2` and
> `nano-banana-pro` also available), with OpenAI gpt-image-1 as fallback.

## Why providers chain

In Pass 35 the `/api/generate/image-to-video` route tries each
provider in order, falling through to the next when the previous
one returns an error. Previously the route picked ONE provider per
request via `imageToVideoProvider()` and stopped at the first one.

When all real providers fail, the route falls back to a demo
placeholder (a tinted mp4 with the prompt text overlay) or to the
browser-side `procedural_video` tool which generates a real WebM via
Canvas + MediaRecorder.

## Recommended setup (Seedance via fal.ai)

The default video provider is **fal.ai — ByteDance Seedance 2.0**:

1. Sign up at https://fal.ai
2. Add credit (~$5 is enough for dozens of test clips)
3. Get the API key from https://fal.ai/dashboard/keys
4. Set `FAL_KEY=...` in `.env`
5. (Optional) Override the models:
   - `FAL_VIDEO_MODEL` — image-to-video (default `bytedance/seedance-2.0/image-to-video`)
   - `FAL_T2V_MODEL`   — text-to-video   (default `bytedance/seedance-2.0/text-to-video`)
   - `FAL_IMAGE_MODEL` — image generation (default `fal-ai/nano-banana`)
   - e.g. Kling/Luma: `fal-ai/kling-video/v1/standard/image-to-video`, `fal-ai/luma-dream-machine/image-to-video`, `fal-ai/minimax-video-01/image-to-video`
6. Restart the dev server. The i2v/t2v routes will use Seedance first,
   falling through to Veo (and then demo) when it errors.

## Procedural video (no key required)

The `procedural_video` WebMCP tool generates a real video file from
any scene's still image by animating it with Ken Burns transforms
(Ken Burns-in, Ken Burns-out, parallax drift, glide-up, pulse-zoom)
and recording the result via `MediaRecorder` in the browser. The
output is uploaded to `/public/assets/` and treated as a real video
clip by the timeline.

This is what the studio falls back to when no external provider is
reachable. Useful for demos when you don't have Veo/FAL credits.

To invoke it from the in-app director orchestrator or an external
agent, call the tool:

```
POST /api/webmcp/execute
{
  "name": "procedural_video",
  "input": { "sceneId": "scene_3", "pattern": "kenBurns-in" }
}
```

Or via the inspector's "Make motion" button when motion-graphics
shows demo-fallback.

## When to choose which

- **fal.ai (Seedance 2.0)**: default. Excellent price/quality and a
  5-min-or-so turnaround per clip. ~$0.05/sec.
- **Veo**: highest quality, ~$0.35/sec. Use when you want cinematic
  results and have Google Cloud credits.
- **Luma**: solid for stylized shots, ~$0.10/sec.
- **Runway Gen-3**: best for product shots with specific motion
  intent, ~$0.12/sec.
- **Replicate**: hosts many models. Pick the cheapest that's good
  enough for your use case.
- **Procedural**: zero cost, runs in the browser. Best when you
  need real video files but have no AI provider credits.
