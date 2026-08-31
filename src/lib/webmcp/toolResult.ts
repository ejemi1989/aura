import type { ToolResult } from "@/types";

/**
 * Wraps a plain string in the content-block shape used by the spec's own
 * `add-todo` example (index.bs, "Imperative Tool Registration"):
 *
 *   return { content: [{ type: "text", text: "..." }] };
 *
 * The IDL technically allows `execute` to resolve to `Promise<any>`, but
 * every tool in this app returns this shape consistently so an external
 * agent gets the same result contract regardless of which tool it calls.
 */
export function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

/** Flattens a ToolResult back down to a single string for internal use
 * (the in-app Director's plan/verify logic works against plain text). */
export function resultText(result: ToolResult): string {
  return result.content.map((c) => c.text).join("\n");
}
