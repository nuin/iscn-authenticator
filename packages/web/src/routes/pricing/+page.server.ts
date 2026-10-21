import { env } from 'cloudflare:workers';
import { getCheckoutOffering } from '#lib/server/billing-availability.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const offering = await getCheckoutOffering(env);
  return { checkoutAvailable: Boolean(offering), offering };
};
