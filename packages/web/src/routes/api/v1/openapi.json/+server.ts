import { openapi } from '#lib/server/validation-api/openapi.ts';

export function GET(): Response {
  return Response.json(openapi, { headers: { 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
}
