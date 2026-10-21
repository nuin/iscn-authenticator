import { getValidationCoverage } from '@iscn/core';
import { reviewKaryotype } from '#lib/validation.ts';
import { ApiError, subscriptionRequired } from './errors.ts';
import { authenticateIntegrationKey } from './keys.ts';
import { readKaryotype } from './input.ts';
import { logApiRequest } from './logging.ts';
import { consumeValidation, getEntitlement, readUsage } from './usage.ts';

export type ApiOperation = 'validate' | 'usage';

export async function handleValidationApi(request: Request, db: D1Database, operation: ApiOperation): Promise<Response> {
  const requestId = crypto.randomUUID();
  const started = Date.now();
  let response: Response;
  try {
    const method = operation === 'validate' ? 'POST' : 'GET';
    if (request.method !== method) throw new ApiError(405, 'method_not_allowed', `Use ${method} for this endpoint.`, { Allow: method });
    const key = await authenticateIntegrationKey(db, request);
    const now = Math.floor(Date.now() / 1000);
    const entitlement = await getEntitlement(db, key.user_id, now);
    if (!entitlement) throw subscriptionRequired();
    if (operation === 'usage') {
      if (new URL(request.url).search) throw new ApiError(400, 'invalid_request', 'This endpoint does not accept query parameters.');
      response = apiResponse({ api_version: '1', request_id: requestId, usage: await readUsage(db, entitlement) }, requestId);
    } else {
      const karyotype = await readKaryotype(request);
      await db.prepare('UPDATE validation_api_key SET last_used_at = ? WHERE id = ? AND revoked_at IS NULL').bind(now, key.id).run();
      const headers = await consumeValidation(db, key, entitlement, Math.floor(Date.now() / 1000));
      const review = reviewKaryotype(karyotype);
      const coverage = getValidationCoverage(review.result.parsed);
      response = apiResponse({ api_version: '1', request_id: requestId, ...review,
        validation: { rule_version: coverage.rule_version, reference: coverage.reference,
          coverage_level: coverage.level, band_reference: coverage.band_reference } }, requestId, 200, headers);
    }
  } catch (error) {
    const failure = error instanceof ApiError ? error : new ApiError(503, 'service_unavailable', 'Validation is temporarily unavailable. Retry shortly.', { 'Retry-After': '5' });
    if (!(error instanceof ApiError)) console.error(JSON.stringify({ event: 'validation_api_failure', request_id: requestId, operation }));
    response = apiResponse({ request_id: requestId, error: { code: failure.code, message: failure.message } }, requestId, failure.status, failure.headers);
  }
  logApiRequest({ requestId, operation, method: request.method, status: response.status, durationMs: Date.now() - started });
  return response;
}

export function apiResponse(body: unknown, requestId: string, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...headers, 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'X-Request-Id': requestId, 'Referrer-Policy': 'no-referrer' } });
}
