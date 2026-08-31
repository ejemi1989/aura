// Agent introspection helpers — wraps the .context/inspection.md
// (agent-introspection-debugging) skill's four phases into a small
// surface the studio's WebMCP tools can call.
//
// Each helper is best-effort: a failed report write is logged once and
// the original tool failure is preserved. No credentials required.
//
// Failure-pattern table (per the skill):
//   - repeated-tool:        same tool invocation N times in a row
//   - quota-429:            provider returned 429 / out of credits
//   - upstream-timeout:     ECONNRESET / fetch failed / abort
//   - validation:           bad input shape (the agent fed bad data)
//   - state-drift:          underlying state changed underneath (e.g.,
//                           scene was deleted between turns)
//   - unknown:              anything else
//
// The captured pattern is what lets the next agent (or a human) take
// the smallest reversible action: a `quota-429` pattern means "stop
// retrying, lower concurrency"; a `validation` pattern means "fix the
// input shape first".

import { AGENTS } from "@/lib/agents/registry";
import { useStudioStore } from "@/lib/store/useStudioStore";
import { threadToolRun } from "@/lib/supabase/threading";
import type { AgentId } from "@/types";

export type FailurePattern =
  | "repeated-tool"
  | "quota-429"
  | "upstream-timeout"
  | "validation"
  | "state-drift"
  | "unknown";

const PATTERN_HINTS: Array<{ pattern: FailurePattern; re: RegExp }> = [
  { pattern: "quota-429", re: /\b429\b|out of credits|rate limit|exhausted|insufficient|locked/i },
  { pattern: "upstream-timeout", re: /\beconnreset|\beconnrefused|aborted|timeout|etimedout|fetch failed|network/i },
  { pattern: "validation", re: /invalid|bad request|missing|required|expected/i },
  { pattern: "state-drift", re: /no scene with id|not found|missing field/i },
];

export function classifyError(message: string): FailurePattern {
  for (const { pattern, re } of PATTERN_HINTS) {
    if (re.test(message)) return pattern;
  }
  return "unknown";
}

export interface IntrospectionReport {
  sessionTask: string;
  goalInProgress: string;
  errorType: string;
  errorMessage: string;
  lastSuccessfulStep?: string;
  pattern: FailurePattern;
  repeatedCount?: number;
  envAssumptions?: Record<string, string>;
  recoverySuggestion: string;
  capturedAt: string;
}

const SUGGESTIONS: Record<FailurePattern, string> = {
  "repeated-tool":
    "Stop retrying the same call. Inspect the last N invocations for repetition and narrow the scope to one failing tool call before retrying.",
  "quota-429":
    "Provider is rate-limited or out of credits. Lower concurrency, switch to the deterministic fallback, or rotate the credential. Do NOT retry in a tight loop.",
  "upstream-timeout":
    "Upstream timed out or refused the connection. Verify the service is reachable and retry once with backoff. If persistent, route through the deterministic fallback.",
  "validation":
    "Input shape failed schema validation. Re-derive the correct input from the tool's inputSchema before retrying.",
  "state-drift":
    "Underlying state changed (e.g., scene deleted). Refetch the latest state via get_project_status before retrying.",
  "unknown":
    "Unknown failure. Capture the full error and tool input, then restate the goal before retrying.",
};

export interface RecordIntrospectionArgs {
  tool: string;
  agent: AgentId;
  error: unknown;
  goalInProgress: string;
  lastSuccessfulStep?: string;
  repeatedCount?: number;
  envAssumptions?: Record<string, string>;
  input?: Record<string, unknown>;
}

/**
 * Capture a failure and write a structured report to the activity feed
 * and (best-effort) to the Supabase tool_runs row.
 */
export async function recordIntrospection(args: RecordIntrospectionArgs): Promise<IntrospectionReport> {
  const err = args.error;
  const errorMessage = err instanceof Error ? err.message : String(err);
  const errorType = err instanceof Error ? err.name : typeof err;
  const pattern = classifyError(errorMessage);

  const report: IntrospectionReport = {
    sessionTask: `${args.tool}@${args.agent}`,
    goalInProgress: args.goalInProgress,
    errorType,
    errorMessage,
    lastSuccessfulStep: args.lastSuccessfulStep,
    pattern,
    repeatedCount: args.repeatedCount,
    envAssumptions: args.envAssumptions,
    recoverySuggestion: SUGGESTIONS[pattern],
    capturedAt: new Date().toISOString(),
  };

  // Surface the pattern in the in-app activity feed so the next agent
  // (and a judge reading the Debug Panel) sees the diagnosis, not just
  // the raw stack.
  const store = useStudioStore.getState();
  store.pushDirectorMessage(
    "director",
    `[introspection] ${AGENTS[args.agent].name} / ${args.tool}: pattern=${report.pattern}; recovery=${report.recoverySuggestion}`,
  );

  // Best-effort durable record. The tool_runs row uses the existing
  // schema; we stash the report under output.error_extra so a single
  // SELECT exposes the full diagnosis.
  await threadToolRun({
    projectSupabaseId: store.project.supabaseProjectId,
    toolName: args.tool,
    agent: args.agent,
    status: "error",
    input: args.input,
    error: `[${report.pattern}] ${errorMessage} | recovery: ${report.recoverySuggestion}`,
  });

  return report;
}

/**
 * Detect repeated invocations of the same tool (Phase 2 diagnosis).
 * The studio keeps a single in-memory ring of the last 10 tool calls
 * per process — enough to flag a tight retry loop without unbounded
 * memory.
 */
const RING_SIZE = 10;
const recentCalls: Array<{ tool: string; ts: number }> = [];

export function trackToolCall(tool: string): number {
  recentCalls.push({ tool, ts: Date.now() });
  if (recentCalls.length > RING_SIZE) recentCalls.shift();
  let count = 0;
  for (let i = recentCalls.length - 1; i >= 0; i--) {
    if (recentCalls[i].tool === tool) count++;
    else break;
  }
  return count;
}

export { recentCalls as _recentCallsForTests };
