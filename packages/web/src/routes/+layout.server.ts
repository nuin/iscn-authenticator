import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => ({
	pathname: url.pathname,
	signedIn: Boolean(locals.session && locals.user)
});
