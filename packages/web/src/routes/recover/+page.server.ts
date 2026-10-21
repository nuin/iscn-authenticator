import type { Actions, PageServerLoad } from './$types';
import { emailActions, loadEmailPage } from '#lib/server/email-auth/actions.ts';

export const load: PageServerLoad = (event) => loadEmailPage(event, 'recover');
export const actions: Actions = emailActions('recover');
