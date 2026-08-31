// Shared LLM chat helper for the studio's specialist agents.
//
// Every content-producing specialist (Scriptwriter, Copywriter, Graphic
// Designer's storyboard, Critic/QA) reasons through a real chat-completions
// call instead of returning templated output. The agentic Director
// (/api/orchestrate) orchestrates; this module powers the *experts* under it.
//
// Recoverability: when the key is absent, the account has no credits, or the
// model errors, we throw a typed `LLMUnavailableError` so callers can fall
// back to their deterministic implementation (keeps the studio demoable with
// no/failed billing). We never silently emit placeholder content.

import OpenAI from "openai";
import { retryWithBackoff } from "@/lib/providers/retry";

export class LLMUnavailableError extends Error {
  readonly reason: "no_key" | "no_credits" | "error";
  readonly causeMessage?: string;
  constructor(reason: "no_key" | "no_credits" | "error", causeMessage?: string) {
    super(`LLM unavailable: ${reason}${causeMessage ? ` — ${causeMessage}` : ""}`);
    this.name = "LLMUnavailableError";
    this.reason = reason;
    this.causeMessage = causeMessage;
  }
}

/**
 * Test seam: `LLM_TEST_MODE=record` records real responses to
 * scripts/verify/fixtures/openai-chat.json; `LLM_TEST_MODE=replay` answers
 * from that recording so the routes can be exercised end-to-end without
 * spending OpenAI credits. Plain (or no) value = live calls.
 */
const TEST_FILE = "scripts/verify/fixtures/openai-chat.json";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatJSONOptions {
  system?: string;
  model?: string;
  /** Human-readable tag for the recorded fixture + error context. */
  channel?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Ask the model to produce JSON matching `schema`'s shape. `schema` is passed
 * to the model as a type contract (helpful for gpt-4.1-class models); the
 * parsed object is validated structurally and returned.
 *
 * Throws LLMUnavailableError when the LLM can't be used — the caller decides
 * fallback. Never returns placeholder content.
 */
export async function chatJSON<T>(
  user: string,
  schema: { prompt: string; shape: (raw: unknown) => T },
  opts: ChatJSONOptions = {}
): Promise<T> {
  const { system, channel = "generic" } = opts;
  const client = await getClient();
  const messages: ChatMessage[] = [
    ...(system ? [{ role: "system" as const, content: system }] : []),
    { role: "user", content: `${schema.prompt}\n\nReturn ONLY valid JSON.\n\n${user}` },
  ];

  const mode = process.env.LLM_TEST_MODE;

  if (mode === "record") {
    const out = await callLive(client, messages, opts, channel);
    appendRecording(channel, messages, out);
    return schema.shape(JSON.parse(out));
  }

  if (mode === "replay") {
    const out = lookupRecording(channel, messages);
    if (out === undefined) {
      throw new LLMUnavailableError("error", `replay fixture missing for channel "${channel}"`);
    }
    return schema.shape(JSON.parse(out));
  }

  const out = await callLive(client, messages, opts, channel);
  return schema.shape(JSON.parse(out));
}

function model(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
}

function getClient(): Promise<OpenAI> {
  if (!process.env.OPENAI_API_KEY) {
    return Promise.reject(new LLMUnavailableError("no_key"));
  }
  return Promise.resolve(new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
}

async function callLive(
  client: OpenAI,
  messages: ChatMessage[],
  opts: ChatJSONOptions,
  channel: string
): Promise<string> {
  try {
    const completion = await retryWithBackoff(
      () =>
        client.chat.completions.create({
          model: opts.model ?? model(),
          messages: messages as any,
          temperature: opts.temperature ?? 0.8,
          max_tokens: opts.maxTokens ?? 1200,
        }),
      { retries: 2, baseMs: 1500, maxMs: 10000 }
    );
    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("empty completion content");
    }
    return content;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/no credits|insufficient_quota|billing/i.test(msg)) {
      throw new LLMUnavailableError("no_credits", msg);
    }
    throw new LLMUnavailableError("error", msg);
  }
}

// ---------------------------------------------------------------------------
// Record / replay fixture (small JSON list, no real data shipped to repo)
// ---------------------------------------------------------------------------

function fixturePath() {
  return `${process.cwd()}/${TEST_FILE}`;
}

function readFixture(): unknown[] {
  try {
    const fs = require("fs") as typeof import("fs");
    return JSON.parse(fs.readFileSync(fixturePath(), "utf8"));
  } catch {
    return [];
  }
}

function writeFixture(rows: unknown[]) {
  const fs = require("fs") as typeof import("fs");
  fs.mkdirSync(fixturePath().split("/").slice(0, -1).join("/"), { recursive: true });
  fs.writeFileSync(fixturePath(), JSON.stringify(rows, null, 2));
}

function appendRecording(channel: string, messages: ChatMessage[], content: string) {
  try {
    const rows = readFixture();
    rows.push({ channel, messages, content });
    writeFixture(rows);
  } catch {
    /* best-effort recording */
  }
}

function lookupRecording(channel: string, _messages: ChatMessage[]): string | undefined {
  const rows = readFixture();
  // Replay matches on channel tag (first exact-message match else most recent
  // for that channel). Channel-matching keeps fixtures authorable by hand and
  // stable across prompt wording — the stub is for integration testing the
  // routing/fallback logic, not for diffing prompts.
  const byChannel = [...rows].reverse().filter((r: any) => r.channel === channel);
  if (byChannel.length === 0) return undefined;
  const exact = byChannel.find(
    (r: any) => JSON.stringify(r.messages) === JSON.stringify(_messages)
  ) as any;
  return exact ? exact.content : (byChannel as any[])[0].content;
}
