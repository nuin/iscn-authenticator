const reference = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: unknown) => ({ 'application/json': { schema } });
const integer = { type: 'integer', minimum: 0 };
const string = { type: 'string' };
const errorResponses = Object.fromEntries([
  [400, 'Invalid JSON or request envelope; not counted.'], [401, 'Missing, unknown or revoked integration key.'],
  [402, 'An active paid subscription period is required.'], [405, 'Method not allowed; see Allow header.'],
  [413, 'Body exceeds 16384 bytes; not counted.'], [415, 'Use uncompressed application/json.'],
  [429, 'Minute or subscription allowance exhausted; see Retry-After.'], [503, 'Service temporarily unavailable.'],
].map(([code, description]) => [code, { description, content: json(reference('Error')) }]));
const quotaHeaders = Object.fromEntries(['X-Quota-Limit', 'X-Quota-Used', 'X-Quota-Remaining', 'X-Quota-Reset',
  'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'].map((name) => [name, {
    description: name.endsWith('Reset') ? 'Reset time, Unix seconds.' : 'Account-wide counter or limit.', schema: integer,
  }]));

export const openapi = {
  openapi: '3.1.0',
  info: { title: 'ISCN Authenticator customer API', version: '1.0.0',
    description: 'Subscription-gated notation validation. Browser tools remain free. Each accepted validation consumes one unit, including invalid notation. No automatic overage charges. API keys are separate from website email-code sign-in. Read status and coverage, not valid alone.' },
  servers: [{ url: '/api/v1' }],
  security: [{ integrationKey: [] }],
  paths: {
    '/validate': { post: { operationId: 'validateKaryotype', summary: 'Check one karyotype',
      description: '60 requests per fixed UTC minute per account. Strict JSON body, 16384 bytes maximum. No query parameters, cookies, compression, batch requests or idempotency keys. Retrying an accepted request consumes another unit.',
      requestBody: { required: true, content: json({ type: 'object', additionalProperties: false,
        required: ['karyotype'], properties: { karyotype: { type: 'string', minLength: 1, maxLength: 4096, example: '47,XX,+21[5]/46,XX[10]' } } }) },
      responses: { '200': { description: 'Check completed. Notation errors also return HTTP 200.', headers: quotaHeaders, content: json(reference('Review')) }, ...errorResponses },
    } },
    '/usage': { get: { operationId: 'getUsage', summary: 'Read the current subscription allowance',
      description: 'No validation units consumed. Requires a current paid subscription. Query parameters are rejected.',
      responses: { '200': { description: 'Aggregate usage across all account integration keys.', content: json({ type: 'object',
        required: ['api_version', 'request_id', 'usage'], properties: { api_version: { const: '1' }, request_id: string,
          usage: { type: 'object', required: ['period_start', 'period_end', 'limit', 'used', 'remaining'],
            properties: { period_start: integer, period_end: integer, limit: integer, used: integer, remaining: integer } } } }) },
        ...Object.fromEntries(Object.entries(errorResponses).filter(([code]) => !['413', '415', '429'].includes(code))) },
    } },
  },
  components: {
    securitySchemes: { integrationKey: { type: 'http', scheme: 'bearer', bearerFormat: 'iscn_api_<64 hexadecimal characters>' } },
    schemas: {
      Error: { type: 'object', required: ['request_id', 'error'], properties: { request_id: string,
        error: { type: 'object', required: ['code', 'message'], properties: { code: string, message: string } } } },
      Review: { type: 'object', required: ['api_version', 'request_id', 'result', 'status', 'coverage', 'validation'], properties: {
        api_version: { const: '1' }, request_id: string,
        status: { enum: ['Checks passed', 'Issues found', 'Review required'] },
        result: { type: 'object', required: ['valid', 'errors', 'parsed'], properties: {
          valid: { type: 'boolean' }, errors: { type: 'array', items: string },
          parsed: { type: ['object', 'null'], description: 'Core KaryotypeAST, preserving source text. Null when parsing fails. AST fields may grow as grammar coverage expands.', additionalProperties: true },
        } },
        coverage: { type: 'array', items: { type: 'object', required: ['code', 'message'], properties: { code: string, message: string } } },
        validation: { type: 'object', required: ['rule_version', 'reference', 'coverage_level', 'band_reference'], properties: {
          rule_version: string, reference: string, coverage_level: { enum: ['supported', 'partial', 'unparsed'] }, band_reference: string,
        } },
      } },
    },
  },
};
