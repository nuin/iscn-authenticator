import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	const { signature } = await request.json();

	if (!signature) {
		return json({ error: 'missing signature' }, { status: 400 });
	}

	// Anonymize the signature
	const hash = await sha256Hex(signature);

	// Log to Axiom or just console
	const log = {
		ts: new Date().toISOString(),
		level: 'info',
		event: 'explain_miss',
		signature_hash: hash
	};

	console.log(JSON.stringify(log));

	// If Axiom is configured, we could send it there too.
	// For now, console is fine as Cloudflare logs it.

	return json({ ok: true });
};

async function sha256Hex(input: string): Promise<string> {
	const bytes = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
