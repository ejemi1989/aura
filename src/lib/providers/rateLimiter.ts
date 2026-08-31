// Per-provider rate limiter — counting semaphore.
//
// Different providers have different concurrency limits (Speechify free
// plan = 1, OpenAI = generous, Veo = 3, FAL = 3). When the studio fires
// 5 TTS calls in parallel and the Speechify plan only allows 1 concurrent,
// the other 4 fail with `concurrency_limit_reached` (429). This module
// gives every provider a counting semaphore so calls queue up instead
// of fighting for capacity.
//
// Each provider call site (e.g. speechifyTTS) wraps its network call
// with `await limiters.speechify.run(() => client().audio.speech(...))`.
// The semaphore:
//   - holds up to `capacity` permits
//   - queues additional callers in FIFO order
//   - releases a permit when the wrapped call resolves OR throws
//   - exposes the current queue depth via `.pending` for diagnostics
//
// Env overrides: SPEECHIFY_CONCURRENCY, OPENAI_CONCURRENCY,
// VEO_CONCURRENCY, FAL_CONCURRENCY let the operator tune without
// code changes (e.g. raise the Speechify limit after upgrading plan).

class CountingSemaphore {
  private permits: number;
  private waiters: Array<() => void> = [];
  readonly capacity: number;
  readonly name: string;
  private _active = 0;
  private _served = 0;

  constructor(name: string, capacity: number) {
    this.name = name;
    this.capacity = Math.max(1, capacity);
    this.permits = this.capacity;
  }

  /** Number of calls currently in flight (executing). */
  get active(): number {
    return this._active;
  }

  /** Number of calls queued (waiting for a permit). */
  get pending(): number {
    return this.waiters.length;
  }

  /** Total calls served since process start (success + failure). */
  get served(): number {
    return this._served;
  }

  async acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException("Aborted", "AbortError");
    }
    if (this.permits > 0) {
      this.permits--;
      this._active++;
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const w = () => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      };
      const onAbort = () => {
        const i = this.waiters.indexOf(w);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(signal!.reason ?? new DOMException("Aborted", "AbortError"));
      };
      this.waiters.push(w);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
    this._active++;
  }

  release(): void {
    this._active--;
    this._served++;
    const next = this.waiters.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }

  /**
   * Wraps an async function so calls run at most `capacity` at a time.
   * The wrapped function is awaited synchronously; if it throws, the
   * permit is still released so the queue doesn't stall.
   */
  async run<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    await this.acquire(signal);
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Singleton rate limiters — one per provider. Created lazily so the
 * env-driven overrides are read at first use. Defaults are tuned for
 * the free / entry-tier plans most operators start on.
 *
 *   Speechify free = 1 concurrent request. This is the blocker the
 *   user hit in Pass 36 — `concurrency_limit_reached` 429s. By
 *   routing all Speechify calls through this limiter, the studio
 *   serializes them and never trips the upstream limit.
 */
export const limiters = {
  speechify: new CountingSemaphore(
    "speechify",
    envInt("SPEECHIFY_CONCURRENCY", 1),
  ),
  openai: new CountingSemaphore(
    "openai",
    envInt("OPENAI_CONCURRENCY", 5),
  ),
  veo: new CountingSemaphore(
    "veo",
    envInt("VEO_CONCURRENCY", 2),
  ),
  fal: new CountingSemaphore(
    "fal",
    envInt("FAL_CONCURRENCY", 3),
  ),
  runway: new CountingSemaphore(
    "runway",
    envInt("RUNWAY_CONCURRENCY", 2),
  ),
  luma: new CountingSemaphore(
    "luma",
    envInt("LUMA_CONCURRENCY", 2),
  ),
  replicate: new CountingSemaphore(
    "replicate",
    envInt("REPLICATE_CONCURRENCY", 2),
  ),
} as const;

export type ProviderLimiterName = keyof typeof limiters;

/** Format a snapshot of all limiter states — useful for logging or
 *  surfacing in the activity feed so the operator can see when a
 *  queue is building up. */
export function limiterSnapshot(): Record<
  ProviderLimiterName,
  { capacity: number; active: number; pending: number; served: number }
> {
  const out = {} as Record<
    ProviderLimiterName,
    { capacity: number; active: number; pending: number; served: number }
  >;
  for (const k of Object.keys(limiters) as ProviderLimiterName[]) {
    const l = limiters[k];
    out[k] = {
      capacity: l.capacity,
      active: l.active,
      pending: l.pending,
      served: l.served,
    };
  }
  return out;
}
