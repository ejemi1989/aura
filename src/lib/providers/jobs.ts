// In-memory async job registry for the video generation routes.
//
// Video generation (fal queue) can take minutes, so the routes can run it in
// the background and return a `jobId` immediately. Clients poll
// GET /api/generate/jobs/:jobId for status. State lives in a module-scoped
// Map — fine for a single node process (the current runtime). On serverless
// with many instances this would move to Redis; the API shape stays the same.

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface Job<T = unknown> {
  id: string;
  kind: string;
  status: JobStatus;
  progress?: number;
  createdAt: number;
  updatedAt: number;
  /** Result payload on success. */
  result?: T;
  /** Error message on failure. */
  error?: string;
  /** Internal promise the route awaits to settle the job. */
  _settle?: Promise<void>;
}

const jobs = new Map<string, Job>();

export function newJobId(prefix = "job"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createJob<T>(kind: string): Job<T> {
  const job: Job<T> = {
    id: newJobId(kind),
    kind,
    status: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobs.set(job.id, job);
  return job;
}

export function updateJob<T>(id: string, patch: Partial<Omit<Job<T>, "id">>): Job<T> | undefined {
  const job = jobs.get(id) as Job<T> | undefined;
  if (!job) return undefined;
  Object.assign(job, patch, { updatedAt: Date.now() });
  return job;
}

export function getJob<T = unknown>(id: string): Job<T> | undefined {
  return jobs.get(id) as Job<T> | undefined;
}

/** Drop finished/old jobs so the map doesn't grow unbounded. Call periodically. */
export function sweepJobs(maxAgeMs = 60 * 60 * 1000, onlyFinished = true): void {
  const now = Date.now();
  for (const [id, job] of jobs) {
    const done = job.status === "succeeded" || job.status === "failed";
    if ((!onlyFinished || done) && now - job.updatedAt > maxAgeMs) {
      jobs.delete(id);
    }
  }
}

/**
 * Public, JSON-safe view of a job (no internal promise).
 */
export function publicJob<T>(job: Job<T>): {
  id: string;
  kind: string;
  status: JobStatus;
  progress?: number;
  error?: string;
  result?: T;
} {
  const { _settle, ...rest } = job as any;
  return rest;
}
