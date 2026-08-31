// Shared helper for building WebMCP tool factories.
//
// Each tool in src/lib/webmcp/tools/* is a factory that takes the live
// studio store snapshot and returns a WebMCPTool descriptor. This file
// centralizes the boilerplate (name validation, annotation defaults,
// executable signature) so every tool reads the same.
//
// Per the spec (index.bs, ModelContextTool Dictionary), `execute` is a
// callback that takes (inputObject, options) where options is
// { signal: AbortSignal }. We unwrap the input argument for convenience
// inside each tool, and surface the AbortSignal so tools can abort
// in-flight HTTP requests.

import type { WebMCPExecuteOptions, WebMCPTool, WebMCPToolAnnotations } from "@/types";
import { assertValidToolName } from "./toolName";

/**
 * Returns a frozen, valid WebMCPTool descriptor for a tool whose execute
 * callback receives the parsed input object. Validates the name at
 * factory-call time so misconfigured tools fail loudly during build,
 * not at runtime when the browser rejects them.
 */
export function defineTool<TInput extends Record<string, unknown>>(def: {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: WebMCPToolAnnotations;
  execute: (input: TInput, options: WebMCPExecuteOptions) => Promise<unknown> | unknown;
}): WebMCPTool<TInput> {
  assertValidToolName(def.name);
  if (!def.description || def.description.trim().length === 0) {
    throw new Error(`Tool "${def.name}" has an empty description.`);
  }
  return Object.freeze({
    name: def.name,
    title: def.title,
    description: def.description,
    inputSchema: def.inputSchema,
    annotations: def.annotations,
    execute: def.execute,
  }) as WebMCPTool<TInput>;
}
