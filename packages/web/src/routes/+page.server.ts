import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const karyotype = url.searchParams.get('karyotype');
	if (karyotype) redirect(302, `/validate?${new URLSearchParams({ karyotype })}`);
};
