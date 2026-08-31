# Seed assets — AURA demo bundle

This directory holds the pre-recorded artifacts the studio ships with so
the deployed live URL can show real Veo 3 / OpenAI video without burning
provider budget per judge.

## What lives here

- `manifest.json` — the seed campaign: 4 scenes, each with image / video /
  voiceover URLs + provider metadata. The studio reads this when
  `SEED_DEMO=true` is set and `create_project` is called.
- `scene_N_image.png`, `scene_N_video.mp4`, `scene_N_voice.wav` — the
  real provider artifacts (12 files for 4 scenes). These are committed
  to the repo so the deployed URL serves them directly from `public/`.

## How to (re-)generate the seed with real providers

This is what you do locally once to ship the recording. It costs ~$53
total (4 scenes × 30s × $0.35/sec Veo 3 + $0.16 OpenAI images + $0.06
TTS).

```bash
# .env.local
GOOGLE_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-key

# Start the studio
PORT=3010 npm run dev

# Reset and seed a fresh project with real providers
curl -X DELETE http://localhost:3010/api/webmcp/execute
# (Run a campaign in the UI; the routes hit Veo 3 + OpenAI.)

# After the run, copy the persisted assets from public/assets/ into
# public/assets/seed/aura-demo/. The serverStore keeps the runtime
# assets under .studio-state.json + public/assets/.
```

Then update `manifest.json` to point at the new files and update the
provider metadata (`imageProvider: "openai"`, `videoProvider: "google"`,
etc.). Commit and push.

## What happens at runtime when SEED_DEMO=true

1. A judge opens `http://localhost:3010/` (or your deployed URL).
2. They click **Run Studio**. `createProjectTool` checks `SEED_DEMO`.
3. If true, it loads `manifest.json` and pre-populates the project
   with the 4 scenes — provider metadata, image/video/voice URLs,
   captions — and jumps the Director to phase `assets` with all 4
   scenes already having `videoUrl`. The crew is shown as DONE.
4. The judge sees the real Veo 3 mp4s play in the Workspace preview,
   the real OpenAI jpgs in the Storyboard grid, and the Debug Panel
   shows `4 real · 0 demo · $42.220 spent` from the manifest metadata.
5. The Human Veto gate still fires — judge can Reject and Remake.
   The remake path triggers `refine_scene`, which calls the real
   provider (Veo 3 / OpenAI) since `SEED_DEMO` only short-circuits the
   initial `create_project`, not subsequent regeneration.

## What happens at runtime when SEED_DEMO is unset

The studio runs in normal demo mode — `create_project` creates an empty
project and the Director dispatches the 9 specialists to generate
placeholder assets. No real providers are called. This is the default
and recommended path for the deployed URL.

## Cost math (for re-recording)

Per scene (30s video):
- OpenAI gpt-image-1: $0.040
- Google Veo 3 image-to-video: $10.500
- OpenAI TTS: $0.015
- Per scene total: $10.555

4-scene happy path: $42.22
+ Reject → Remake Scene 3 (1 extra): $52.78

To bring it under $20/recording, drop to 15s scenes (≈$5.25/scene) or
2 scenes (≈$21). But 30s is the quality bar for a Devpost hero shot.

## File size budget

Each Veo 3 30s clip is ~5-15 MB. 4 clips × ~10 MB = ~40 MB. Plus 4 jpgs
(~400 KB each) and 4 wavs (~1 MB each) = ~5 MB. Total seed bundle:
~45 MB. Acceptable for the public repo.
