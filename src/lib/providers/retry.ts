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

/**
 * True when an error represents a PERMANENT account/balance failure that
 * retrying will never fix — retrying it just burns wall-clock (exponential
 * backoff) before the caller falls back to demo. Distinct from a true
 * transient 429 rate-limit, which IS worth retrying.
 */
export function isPermanentAccountFailure(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const msg =
    (err as any)?.message ??
    (err as any)?.response_data?.message ??
    (err as any)?.error?.message ??
    "";
  const status = (err as any)?.status ?? (err as any)?.response?.status;
  if (typeof status === "number" && status === 429) {
    // A 429 that the provider explicitly labels as out-of-credits / an
    // exhausted or locked account is permanent — keep the retry for plain
    // rate-limit 429s.
    return /out of credits|no credits|credits remaining|insufficient balance|billing|locked|exhausted|spend cap|quota not available|PAYMENT_REQUIRED/i.test(
      String(msg)
    );
  }
  return false;
}

/** True when an error is worth retrying (rate limit, 5xx, network). */
export function isRetryable(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return false;
  if (err instanceof Error && /aborted/i.test(err.message)) return false;
  // Permanent account failures (out of credits, locked) will never succeed
  // on retry — fail fast so we reach the demo fallback immediately.
  if (isPermanentAccountFailure(err)) return false;
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
