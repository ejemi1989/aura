"use client";

import { useStudioStore } from "@/lib/store/useStudioStore";
import { Badge } from "@/components/common/Badge";

/**
 * Tiny "Generated via X · Ys · $Z" badge shown on each artifact card
 * when real-provider provenance is recorded. Hidden for demo placeholders
 * (no provider info on the scene) so the grid stays clean.
 */
function ProvenanceBadge({
  provider,
  latencyMs,
  costUsd,
  label,
}: {
  provider?: string;
  latencyMs?: number;
  costUsd?: number;
  label: string;
}) {
  if (!provider || provider === "demo") return null;
  const parts: string[] = [`via ${provider}`];
  if (typeof latencyMs === "number" && latencyMs > 0) {
    parts.push(`${(latencyMs / 1000).toFixed(1)}s`);
  }
  if (typeof costUsd === "number" && costUsd > 0) {
    parts.push(`$${costUsd.toFixed(3)}`);
  }
  return (
    <span
      title={`${label} — ${parts.join(" · ")}`}
      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary"
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
      {parts.join(" · ")}
    </span>
  );
}

export function StoryboardGrid() {
  const scenes = useStudioStore((s) => s.project.scenes);

  if (scenes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        The Storyboard will fill in here once the Scriptwriter and Graphic Designer have produced scenes.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3">
      {scenes.map((scene) => (
        <div
          key={scene.id}
          className="overflow-hidden rounded-studio border border-border bg-card"
        >
          <div className="relative flex aspect-video items-center justify-center bg-background">
            {scene.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={scene.imageUrl}
                alt={scene.voiceoverLine ?? scene.description}
                // object-contain keeps the FULL image visible — the image
                // is gpt-image-1 1536×1024 (3:2) which is taller than the
                // 16:9 aspect-video card, so object-cover would crop the
                // top and bottom. Contain letterboxes vertically so the
                // entire scene visual is preserved.
                className="h-full w-full object-contain ring-1 ring-inset ring-black/10 dark:ring-white/10"
              />
            ) : (
              <span className="text-[11px] text-muted-foreground">No visual yet</span>
            )}
            {scene.imageProvider && scene.imageProvider !== "demo" && (
              <div className="absolute right-1.5 top-1.5">
                <ProvenanceBadge
                  provider={scene.imageProvider}
                  latencyMs={scene.imageLatencyMs}
                  costUsd={scene.imageCostUsd}
                  label={`Scene ${scene.index} visual`}
                />
              </div>
            )}
          </div>
          <div className="p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground">
                Scene {scene.index}
              </span>
              <div className="flex flex-wrap items-center justify-end gap-1">
                {scene.videoUrl && <Badge tone="blue">video</Badge>}
                {scene.voiceoverUrl && <Badge tone="green">vo</Badge>}
                {scene.caption && <Badge tone="purple">copy</Badge>}
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {scene.videoProvider && scene.videoProvider !== "demo" && (
                <ProvenanceBadge
                  provider={scene.videoProvider}
                  latencyMs={scene.videoLatencyMs}
                  costUsd={scene.videoCostUsd}
                  label={`Scene ${scene.index} video`}
                />
              )}
              {scene.voiceProvider && scene.voiceProvider !== "demo" && (
                <ProvenanceBadge
                  provider={scene.voiceProvider}
                  latencyMs={scene.voiceLatencyMs}
                  costUsd={scene.voiceCostUsd}
                  label={`Scene ${scene.index} voiceover`}
                />
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
              {scene.voiceoverLine ?? scene.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
