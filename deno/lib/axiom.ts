/**
 * Axiom log sink.
 *
 * Buffers JSON log lines in memory and flushes them to Axiom's ingest
 * endpoint either on a timer (default: every 1 second) or when the
 * buffer reaches a size threshold (default: 100 lines). Flushes are
 * fire-and-forget — a failed POST is reported to `onError` but never
 * blocks the request handler that produced the line.
 *
 * No retry logic: Axiom's own pipeline handles transient failures, and
 * retrying from this process would risk head-of-line blocking on
 * persistent outages. Lines dropped during an outage are still visible
 * on stdout via the `tee()` helper, so they remain in Deno Deploy's
 * 24-hour console buffer.
 *
 * Unlocks the HIPAA narrative: externally-retained, append-only request
 * log with a separate security boundary from the application's own
 * storage.
 */

export interface AxiomSinkOptions {
  /** Axiom ingest token (aaxt-... / xaat-...). Required. */
  token: string;
  /** Axiom dataset name. Required. */
  dataset: string;
  /**
   * Max milliseconds between timed flushes. Buffered lines wait at most
   * this long before being shipped. Default 1000.
   */
  flushMs?: number;
  /**
   * When the buffer reaches this many lines, flush immediately instead
   * of waiting for the timer. Default 100.
   */
  maxBuffer?: number;
  /**
   * Override ingest endpoint. Default: `https://api.axiom.co/v1/datasets`.
   * The dataset is appended as `/<dataset>/ingest`.
   */
  endpoint?: string;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
  /**
   * Called when a flush fails. Default logs the error to stderr so
   * operators can see the outage without tripping the request handler.
   */
  onError?: (err: unknown) => void;
}

export interface AxiomSink {
  /** Enqueue a single JSON line (one log record). */
  log: (line: string) => void;
  /** Force-flush the buffer now. Resolves when the POST completes. */
  flush: () => Promise<void>;
  /** Stop the internal timer and flush any remaining lines. */
  stop: () => Promise<void>;
}

const DEFAULT_ENDPOINT = "https://api.axiom.co/v1/datasets";
const DEFAULT_FLUSH_MS = 1000;
const DEFAULT_MAX_BUFFER = 100;

/**
 * Compose multiple log sinks into one. Each line is forwarded to every
 * sink in order; a failure in one sink does not interrupt the others.
 */
export function tee(
  ...sinks: Array<(line: string) => void>
): (line: string) => void {
  return (line: string) => {
    for (const sink of sinks) {
      try {
        sink(line);
      } catch {
        // Intentionally swallow — a broken sink must not starve the others.
      }
    }
  };
}

export function createAxiomSink(opts: AxiomSinkOptions): AxiomSink {
  if (!opts.token) throw new Error("axiom: token is required");
  if (!opts.dataset) throw new Error("axiom: dataset is required");

  const flushMs = opts.flushMs ?? DEFAULT_FLUSH_MS;
  const maxBuffer = opts.maxBuffer ?? DEFAULT_MAX_BUFFER;
  const endpointBase = opts.endpoint ?? DEFAULT_ENDPOINT;
  const url = `${endpointBase}/${encodeURIComponent(opts.dataset)}/ingest`;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const onError = opts.onError ?? ((err) => {
    console.error("[axiom] flush failed:", err);
  });

  let buffer: string[] = [];
  let stopped = false;

  async function flush(): Promise<void> {
    if (buffer.length === 0) return;
    // Swap the buffer out first so concurrent `log()` calls collect into
    // a fresh one while this batch is in flight.
    const batch = buffer;
    buffer = [];
    const body = batch.join("\n");
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${opts.token}`,
          "Content-Type": "application/x-ndjson",
        },
        body,
      });
      if (!res.ok) {
        // Drain the body so the underlying connection can be reused /
        // released; otherwise Deno warns about leaking resources.
        try {
          await res.text();
        } catch { /* ignore */ }
        throw new Error(`axiom ingest HTTP ${res.status}`);
      }
      // Drain successful body too.
      try {
        await res.text();
      } catch { /* ignore */ }
    } catch (err) {
      onError(err);
    }
  }

  function log(line: string): void {
    if (stopped) return;
    buffer.push(line);
    if (buffer.length >= maxBuffer) {
      // Fire and forget; errors go to onError.
      flush().catch((err) => onError(err));
    }
  }

  const timer = setInterval(() => {
    flush().catch((err) => onError(err));
  }, flushMs);
  // Allow the process to exit even if the timer is still pending.
  if (typeof Deno !== "undefined" && typeof Deno.unrefTimer === "function") {
    Deno.unrefTimer(timer);
  }

  async function stop(): Promise<void> {
    stopped = true;
    clearInterval(timer);
    await flush();
  }

  return { log, flush, stop };
}
