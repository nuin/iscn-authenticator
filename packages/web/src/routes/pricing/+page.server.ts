import { env } from 'cloudflare:workers';
import { checkoutAvailable } from '#lib/server/billing-availability.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ checkoutAvailable: checkoutAvailable(env) });
