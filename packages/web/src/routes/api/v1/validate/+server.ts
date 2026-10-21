import { env } from 'cloudflare:workers';
import type { RequestHandler } from './$types';
import { handleValidationApi } from '#lib/server/validation-api/handler.js';

export const POST: RequestHandler = ({ request }) => handleValidationApi(request, env.DB, 'validate');
export const fallback = POST;
