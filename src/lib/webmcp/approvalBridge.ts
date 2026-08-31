// Bridges an in-flight `request_human_approval` tool call (which is paused
// inside an async execute() function, potentially awaiting a browser AI
// agent) to the human clicking Approve/Reject in the ApprovalModal UI.
//
// This has to live outside React/Zustand state because it holds a live
// function reference (the promise resolver), not serializable data.

const resolvers = new Map<string, (approved: boolean) => void>();

export function waitForHumanDecision(approvalId: string): Promise<boolean> {
  return new Promise((resolve) => {
    resolvers.set(approvalId, resolve);
  });
}

export function resolveHumanDecision(approvalId: string, approved: boolean) {
  const resolve = resolvers.get(approvalId);
  if (resolve) {
    resolve(approved);
    resolvers.delete(approvalId);
  }
}
