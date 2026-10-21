import { env } from 'cloudflare:workers';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ApiError } from '#lib/server/validation-api/errors.ts';
import { createIntegrationKey, listIntegrationKeys, revokeIntegrationKey } from '#lib/server/validation-api/keys.ts';
import { getEntitlement, readUsage } from '#lib/server/validation-api/usage.ts';

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  if (!locals.user) throw redirect(302, '/login');
  setHeaders({ 'Cache-Control': 'private, no-store' });
  const entitlement = await getEntitlement(env.DB, locals.user.id);
  return { keys: await listIntegrationKeys(env.DB, locals.user.id),
    usage: entitlement ? await readUsage(env.DB, entitlement) : null, apiBase: `${url.origin}/api/v1` };
};

export const actions: Actions = {
  create: async ({ locals, request }) => {
    if (!locals.user) throw redirect(302, '/login');
    const label = (await request.formData()).get('label');
    if (typeof label !== 'string') return fail(400, { message: 'Enter a key label.' });
    try {
      const key = await createIntegrationKey(env.DB, locals.user.id, label);
      return { success: true, plaintext: key.plaintext };
    } catch (error) {
      if (error instanceof ApiError) return fail(error.status, { message: error.message });
      throw error;
    }
  },
  revoke: async ({ locals, request }) => {
    if (!locals.user) throw redirect(302, '/login');
    const id = (await request.formData()).get('key_id');
    if (typeof id !== 'string' || !id) return fail(400, { message: 'Select a key to revoke.' });
    await revokeIntegrationKey(env.DB, locals.user.id, id);
    return { success: true, message: 'API key revoked. Future requests with it will be rejected.' };
  },
};
