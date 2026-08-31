// Retry with exponential backoff + jitter, honoring AbortSignal.
//
// Wraps one-shot upstream calls (fal submit, OpenAI image/TTS) so transient
// failures — rate limits (429), provider 5xx, and network/timeout errors —
// are retried with sleep growing by a random factor before the caller gives
// up. Deterministic, small, and safe to use from any route.

export interface RetryOptions {
  signal?: AbortSignal;
  /** Total attempts including the first. Default 4. */
  retries?: number;
  /** Initial backoff in ms. Default 800. */
  baseMs?: number;
  /** Cap on backoff in ms. Default 10000. */
  maxMs?: number;
}

/** True when an error is worth retrying (rate limit, 5xx, network). */
export function isRetryable(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return false;
  if (err instanceof Error && /aborted/i.test(err.message)) return false;
  if (typeof (err as any)?.status === "number") {
    const status = (err as any).status as number;
    return status === 429 || status >= 500;
  }
  // Network / fetch failures are retryable.
  return true;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

/**
 * Runs `fn`, retrying transient failures with exponential backoff + jitter.
 * The final failure is rethrown so callers keep their existing error paths.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const { signal, retries = 4, baseMs = 800, maxMs = 10000 } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    if (attempt > 0) {
      // Full jitter: random delay between base and cap, growing per attempt.
      const backoff = Math.min(maxMs, baseMs * 2 ** attempt);
      const delay = Math.floor(backoff * (0.5 + Math.random()));
      try {
        await sleep(delay, signal);
      } catch (err) {
        throw err; // abort
      }
    }
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === retries - 1) break;
    }
  }
  throw lastErr;
}
