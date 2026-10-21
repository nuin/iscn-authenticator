import { env } from 'cloudflare:workers';
import type { RequestHandler } from './$types';
import { handleValidationApi } from '#lib/server/validation-api/handler.js';

export const GET: RequestHandler = ({ request }) => handleValidationApi(request, env.DB, 'usage');
export const fallback = GET;
