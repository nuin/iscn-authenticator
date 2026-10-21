interface RequestLog {
  requestId: string;
  operation: 'validate' | 'usage';
  method: string;
  status: number;
  durationMs: number;
}

/** Emit only operational metadata; request bodies and credentials are never accepted. */
export function logApiRequest(entry: RequestLog, sink: (line: string) => void = console.info): void {
  sink(JSON.stringify({ event: 'validation_api_request', request_id: entry.requestId,
    operation: entry.operation, method: entry.method, status: entry.status, duration_ms: entry.durationMs }));
}
