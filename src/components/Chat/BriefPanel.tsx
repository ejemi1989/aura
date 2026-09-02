"use client";

import { useState, useEffect } from "react";
import clsx from "clsx";
import { useStudioStore } from "@/lib/store/useStudioStore";
import { runCreativeDirector } from "@/lib/agents/directorOrchestrator";
import { AGENT_ICONS } from "@/components/icons/AgentIcons";
import {
  CampaignIcon,
  TargetIcon,
  UsersIcon,
  PlatformIcon as PlatformFieldIcon,
  PaletteIcon,
  ClockIcon,
  SparkleIcon,
  PlayIcon,
  RefreshIcon,
  ImageIcon,
  VolumeIcon,
  TypeIcon,
  ScissorsIcon,
} from "@/components/icons/UIIcons";
import {
  PLATFORM_ICONS,
  PLATFORM_COLORS,
} from "@/components/icons/PlatformIcons";
import {
  STYLE_ICONS,
  STYLE_COLORS,
} from "@/components/icons/StyleIcons";
import {
  CAMPAIGN_TEMPLATES,
  CAMPAIGN_CATEGORIES,
  templatesByCategory,
} from "@/lib/campaignTemplates";
import type { CampaignTemplate, CampaignCategory } from "@/lib/campaignTemplates";
import type { CreativeBrief, AgentId, Scene } from "@/types";

const PLATFORMS: CreativeBrief["platform"][] = ["instagram", "tiktok", "youtube", "linkedin", "generic"];
const STYLES: CreativeBrief["style"][] = ["professional", "casual", "dramatic", "playful", "cinematic"];

// Seed the form with the first template (a starter brief).
const INITIAL_TEMPLATE = CAMPAIGN_TEMPLATES[0];

/**
 * Right-rail project panel. Sample briefs at the top, then a form
 * with leading-icon inputs, then a "Selected scene" inspector that
 * appears only when the user picks a clip on the timeline. Compact,
 * linear, no tab-switching.
 */
export function BriefPanel() {
  const phase = useStudioStore((s) => s.project.phase);
  const projectName = useStudioStore((s) => s.project.name);
  const setProjectMeta = useStudioStore((s) => s.setProjectMeta);
  const directorPlan = useStudioStore((s) => s.directorPlan);
  const scenes = useStudioStore((s) => s.project.scenes);
  const selectedSceneId = useStudioStore((s) => s.selectedSceneId);
  const selectScene = useStudioStore((s) => s.selectScene);
  const updateScene = useStudioStore((s) => s.updateScene);
  const setPlayhead = useStudioStore((s) => s.setPlayhead);

  const [running, setRunning] = useState(false);
  const [name, setName] = useState(INITIAL_TEMPLATE.name);
  const [goal, setGoal] = useState(INITIAL_TEMPLATE.goal);
  const [audience, setAudience] = useState(INITIAL_TEMPLATE.audience);
  const [platform, setPlatform] = useState<CreativeBrief["platform"]>(INITIAL_TEMPLATE.platform);
  const [style, setStyle] = useState<CreativeBrief["style"]>(INITIAL_TEMPLATE.style);
  const [duration, setDuration] = useState(INITIAL_TEMPLATE.targetDurationSeconds ?? 30);
  const [sceneCount, setSceneCount] = useState<number>(3);
  const [activeCategory, setActiveCategory] = useState<CampaignCategory>(CAMPAIGN_CATEGORIES[0]);
  const [vetoFeedback, setVetoFeedback] = useState("");

  const requestRevision = useStudioStore((s) => s.requestRevision);
  const revisionRequest = useStudioStore((s) => s.revisionRequest);

  const visibleTemplates = templatesByCategory(activeCategory);

  useEffect(() => {
    if (projectName && projectName !== name) {
      setName(projectName);
    }
  }, [projectName]);

  async function handleRun() {
    if (running) return;
    setRunning(true);
    // Pin the orchestrator's default scene count to the user's pick so the
    // run honors it (deterministic path reads from env at call time).
    process.env.NEXT_PUBLIC_PRESENTATION_MODE_SCENES = String(sceneCount);
    try {
      await runCreativeDirector({
        name: name.trim() || "Untitled Campaign",
        goal: goal.trim() || "create a short video about our product",
        audience: audience.trim() || "a general audience",
        platform,
        style,
        targetDurationSeconds: duration,
      });
    } catch (err) {
      useStudioStore.getState().logActivity(
        "creative-director",
        "error",
        `Director failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setRunning(false);
    }
  }

  function applySample(t: CampaignTemplate) {
    setName(t.name);
    setGoal(t.goal);
    setAudience(t.audience);
    setPlatform(t.platform);
    setStyle(t.style);
    setDuration(t.targetDurationSeconds ?? 30);
    setProjectMeta({ name: t.name });
  }

  const selectedScene: Scene | null = selectedSceneId
    ? scenes.find((s) => s.id === selectedSceneId) ?? null
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <CampaignIcon className="h-4 w-4" />
            Creative Brief
          </h2>
          <p className="text-[11px] text-muted-foreground">Tell the studio what to make</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Phase</span>
          <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-foreground">
            {phase.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Sample briefs */}
        <div className="border-b border-border p-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <SparkleIcon className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Campaign templates
            </span>
          </div>
          <div className="mb-1.5 flex flex-wrap gap-1">
            {CAMPAIGN_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={clsx(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-base",
                  activeCategory === cat
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {visibleTemplates.map((t) => (
              <button
                key={t.id}
                onClick={() => applySample(t)}
                className="rounded-md border border-border bg-background px-2.5 py-2 text-left transition-base hover:border-primary/50 hover:bg-muted"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-[12px] font-medium text-foreground">{t.name}</div>
                  <div className="flex shrink-0 items-center gap-1">
                    <PlatformChip platform={t.platform} />
                    <StyleChip style={t.style} />
                  </div>
                </div>
                <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                  {t.brand} · {t.keyMessage}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Form with leading icons */}
        <div className="space-y-3 p-3">
          <IconField label="Campaign" icon={<CampaignIcon className="h-3.5 w-3.5" />}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Campaign name"
              className="h-8 w-full bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </IconField>

          <IconField label="Goal" icon={<TargetIcon className="h-3.5 w-3.5" />} multiline>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What's the video trying to accomplish?"
              rows={2}
              className="w-full resize-none bg-transparent px-2.5 py-1.5 text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </IconField>

          <IconField label="Audience" icon={<UsersIcon className="h-3.5 w-3.5" />}>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Who is this for?"
              className="h-8 w-full bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </IconField>

          <IconField label="Platform" icon={<PlatformFieldIcon className="h-3.5 w-3.5" />}>
            <div className="grid w-full grid-cols-5 gap-1">
              {PLATFORMS.map((p) => {
                const Icon = PLATFORM_ICONS[p];
                const active = platform === p;
                return (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    title={p}
                    aria-label={p}
                    aria-pressed={active}
                    className={clsx(
                      "flex h-9 items-center justify-center rounded border transition-base",
                      active
                        ? "border-transparent bg-background shadow-[0_0_0_2px_var(--color-primary)]"
                        : "border-border bg-background hover:border-border/80"
                    )}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{
                        color: active ? PLATFORM_COLORS[p] : "var(--color-muted-foreground)",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </IconField>

          <IconField label="Style" icon={<PaletteIcon className="h-3.5 w-3.5" />}>
            <div className="grid w-full grid-cols-5 gap-1">
              {STYLES.map((s) => {
                const { Icon, label } = STYLE_ICONS[s];
                const active = style === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    title={label}
                    aria-label={label}
                    aria-pressed={active}
                    className={clsx(
                      "flex h-9 items-center justify-center rounded border transition-base",
                      active
                        ? "border-transparent bg-background shadow-[0_0_0_2px_var(--color-info)]"
                        : "border-border bg-background hover:border-border/80"
                    )}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{
                        color: active ? STYLE_COLORS[s] : "var(--color-muted-foreground)",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </IconField>

          <IconField label="Length" icon={<ClockIcon className="h-3.5 w-3.5" />}>
            <div className="flex w-full items-center gap-2">
              <input
                type="range"
                min={5}
                max={120}
                value={duration}
                onChange={(e) => setDuration(Math.max(5, Math.min(120, Number(e.target.value))))}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              <div className="w-14 rounded-md border border-border bg-background px-2 py-1 text-right font-mono text-[11px] tabular-nums text-foreground">
                {duration}s
              </div>
            </div>
          </IconField>

          <IconField label="Scenes" icon={<SparkleIcon className="h-3.5 w-3.5" />}>
            <div className="grid w-full grid-cols-4 gap-1">
              {[2, 3, 5, 8].map((n) => {
                const active = sceneCount === n;
                const label =
                  n === 2 ? "2" : n === 3 ? "3 · Fast" : n === 5 ? "5 · Std" : "8 · Long";
                return (
                  <button
                    key={n}
                    onClick={() => setSceneCount(n)}
                    aria-pressed={active}
                    title={`${n} scenes — ${n === 2 ? "~1 min live" : n === 3 ? "~1.7 min live" : n === 5 ? "~2 min live" : "~3 min live"}`}
                    className={clsx(
                      "flex h-9 items-center justify-center rounded border text-[11px] font-medium transition-base",
                      active
                        ? "border-transparent bg-background text-foreground shadow-[0_0_0_2px_var(--color-primary)]"
                        : "border-border bg-background text-muted-foreground hover:border-border/80",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </IconField>

          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className={clsx(
              "flex h-10 w-full items-center justify-center gap-2 rounded-studio text-sm font-medium transition-base",
              running
                ? "cursor-not-allowed bg-muted text-muted-foreground"
                : "bg-primary text-white hover:opacity-90"
            )}
          >
            {running ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                Studio running…
              </>
            ) : (
              <>
                <PlayIcon className="h-3.5 w-3.5" />
                Run Studio
              </>
            )}
          </button>
        </div>

        {/* Director's plan */}
        {directorPlan.length > 0 && (
          <div className="border-t border-border bg-background p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <ScissorsIcon className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Director's plan · {directorPlan.length} steps
              </span>
            </div>
            <ol className="space-y-1 text-[11px] text-muted-foreground">
              {directorPlan.map((step, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="w-3.5 shrink-0 text-right text-muted-foreground">{i + 1}.</span>
                  <span className="min-w-0 flex-1">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Selected scene inspector — only when a clip is picked */}
        {selectedScene && (
          <div className="border-t border-border bg-background p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ScissorsIcon className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Selected · Scene {selectedScene.index}
                </span>
              </div>
              <button
                onClick={() => selectScene(null)}
                className="text-[10px] text-muted-foreground hover:text-foreground"
                aria-label="Deselect clip"
              >
                Clear
              </button>
            </div>

            <textarea
              value={selectedScene.description}
              onChange={(e) => updateScene(selectedScene.id, { description: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-border bg-input px-2 py-1.5 text-[11px] text-foreground outline-none"
            />

            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Dur</span>
              <input
                type="range"
                min={1}
                max={20}
                step={0.5}
                value={selectedScene.durationSeconds ?? 4}
                onChange={(e) => updateScene(selectedScene.id, { durationSeconds: Number(e.target.value) })}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
              <span className="w-10 rounded border border-border bg-input px-1.5 py-0.5 text-center font-mono text-[10px] tabular-nums text-foreground">
                {(selectedScene.durationSeconds ?? 0).toFixed(1)}s
              </span>
            </div>

            <div className="mt-2 flex items-center gap-1">
              <RegenBtn label="Image" tone="blue" icon={<ImageIcon className="h-3 w-3" />} onClick={() => regenerateTool("generate_image", selectedScene.id)} />
              <RegenBtn label="Video" tone="blue" icon={<ImageIcon className="h-3 w-3" />} onClick={() => regenerateTool("image_to_video", selectedScene.id)} />
              <RegenBtn label="Voice" tone="green" icon={<VolumeIcon className="h-3 w-3" />} onClick={() => regenerateTool("text_to_speech", selectedScene.id)} />
              <RegenBtn label="Caption" tone="purple" icon={<TypeIcon className="h-3 w-3" />} onClick={() => regenerateTool("write_caption", selectedScene.id)} />
            </div>

            {/* Human veto — the hero interaction. Remaking a scene sends the
                running Director a revisionRequest it picks up at its next
                checkpoint (mid-prodution) or uses to remake + re-QA + re-approve
                (after a rejection). The optional reason drives refine_scene's
                feedback so the remake is visibly targeted. */}
            <div className="mt-2 rounded-md border border-danger/30 bg-danger/5 p-2">
              <div className="flex items-center gap-1.5">
                <VetoIcon className="h-3.5 w-3.5 text-danger" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-danger">
                  Human veto
                </span>
                {revisionRequest?.sceneId === selectedScene.id && (
                  <span className="rounded-full bg-danger/15 px-1.5 py-0.5 text-[9px] font-medium text-danger">
                    remake queued
                  </span>
                )}
              </div>
              <textarea
                value={vetoFeedback}
                onChange={(e) => setVetoFeedback(e.target.value)}
                placeholder="Why? e.g. does not feel premium, elevate the product. Optional."
                rows={2}
                className="mt-1.5 w-full resize-none rounded border border-border bg-input px-2 py-1.5 text-[11px] text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => {
                  requestRevision({
                    sceneId: selectedScene.id,
                    sceneIndex: selectedScene.index,
                    feedback: vetoFeedback.trim() || undefined,
                  });
                  setVetoFeedback("");
                }}
                className="mt-1.5 inline-flex w-full items-center justify-center gap-1.5 rounded border border-danger/40 py-1.5 text-[11px] font-semibold text-danger transition-base active:scale-[0.97] hover:bg-danger/10"
              >
                <VetoIcon className="h-3.5 w-3.5" />
                Remake Scene {selectedScene.index}
              </button>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                {running
                  ? "Pauses the crew, refreshes this frame, then resumes."
                  : "Triggers a remake now, then re-runs QA and re-asks for approval."}
            </p>
            </div>

            <button
              onClick={() => setPlayhead(0)}
              className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded border border-border bg-input py-1 text-[11px] font-medium text-muted-foreground transition-base hover:border-primary/50 hover:text-foreground"
            >
              <PlayIcon className="h-3 w-3" />
              Play from this clip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function IconField({
  label,
  icon,
  children,
  multiline,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={clsx(
          "flex w-full items-start rounded-md border border-border bg-input pl-2 pr-2.5 transition-base focus-within:border-primary",
          multiline ? "py-1" : "h-9"
        )}
      >
        <span className="mt-1.5 shrink-0 text-muted-foreground">{icon}</span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </label>
  );
}

function RegenBtn({
  label,
  tone,
  icon,
  onClick,
}: {
  label: string;
  tone: "blue" | "green" | "purple";
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex flex-1 items-center justify-center gap-1 rounded border px-1.5 py-1 text-[10px] font-medium transition-base",
        tone === "blue" && "border-primary/30 bg-primary/8 text-primary hover:bg-primary/15",
        tone === "green" && "border-success/30 bg-success/8 text-success hover:bg-success/15",
        tone === "purple" && "border-info/30 bg-info/8 text-info hover:bg-info/15"
      )}
    >
      <RefreshIcon className="h-2.5 w-2.5" />
      {label}
    </button>
  );
}

async function regenerateTool(name: string, sceneId: string) {
  const { runTool } = await import("@/lib/webmcp/runTool");
  const scene = useStudioStore.getState().project.scenes.find((s) => s.id === sceneId);
  if (!scene) return;
  if (name === "generate_image") {
    await runTool(name, { sceneId });
  } else if (name === "image_to_video" || name === "text_to_video") {
    await runTool(name, { sceneId, durationSeconds: scene.durationSeconds ?? 4 });
  } else if (name === "text_to_speech") {
    // Speak only the words the narrator reads aloud (not the producer
    // direction mixed into `description`). Falls back to `description`
    // for legacy state files predating the split.
    await runTool(name, {
      sceneId,
      line: scene.voiceoverLine ?? scene.description,
      voiceTone: "warm",
    });
  } else if (name === "write_caption") {
    await runTool(name, { sceneId, purpose: "on_screen_text" });
  }
}

function PlatformChip({ platform }: { platform: CreativeBrief["platform"] }) {
  const Icon = PLATFORM_ICONS[platform];
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide">
      <Icon className="h-2.5 w-2.5" style={{ color: PLATFORM_COLORS[platform] }} />
      <span className="text-muted-foreground">{platform}</span>
    </span>
  );
}

function StyleChip({ style }: { style: CreativeBrief["style"] }) {
  const { Icon, label } = STYLE_ICONS[style];
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide">
      <Icon className="h-2.5 w-2.5" style={{ color: STYLE_COLORS[style] }} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function VetoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}
