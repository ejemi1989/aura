// WebMCP tool-name validation per the spec (index.bs, "registerTool",
// step 9). Names must:
//   • be 1–128 characters long
//   • contain only ASCII alphanumeric, U+005F LOW LINE (_),
//     U+002D HYPHEN-MINUS (-), or U+002E FULL STOP (.)
//
// Tools that don't satisfy this rule are rejected synchronously by the
// browser with InvalidStateError. We mirror the check here so we can
// surface a clear developer-facing error during the in-app tool build
// step, before the browser sees a tool name it would refuse.

const VALID_NAME_RE = /^[A-Za-z0-9_\-.]{1,128}$/;

export function isValidToolName(name: string): boolean {
  return VALID_NAME_RE.test(name);
}

export function assertValidToolName(name: string): void {
  if (!isValidToolName(name)) {
    throw new Error(
      `Invalid WebMCP tool name "${name}". Names must be 1–128 chars of ASCII alphanumeric, "_", "-", or "."`
    );
  }
}

/**
 * Spec says tools can declare `annotations: { readOnlyHint }` to tell the
 * agent the tool doesn't modify state. We mark these tools readOnlyHint so
 * the browser can show a lighter confirmation affordance (or skip it
 * entirely, per the spec).
 */
export const READ_ONLY_ANNOTATIONS = { readOnlyHint: true } as const;

/**
 * Spec security FAQ mentions a forthcoming hint for consequential actions
 * (issue #176). We co-opt `untrustedContentHint` as a hint that the tool
 * *prompts* for user confirmation — agents should ensure the user is
 * actually present before invoking it.
 */
export const CONSEQUENTIAL_ANNOTATIONS = {
  untrustedContentHint: false,
} as const;
