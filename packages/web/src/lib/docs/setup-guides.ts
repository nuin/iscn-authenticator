import type { Guide } from './types.js';

export const setupGuides: Guide[] = [
	{
		slug: 'accounts-and-keys',
		title: 'Manage your account and keys',
		description: 'Save your first key, sign in, and replace a key safely.',
		group: 'Set up your workflow',
		keywords: ['signup', 'login', 'password', 'revoke', 'rotate', 'billing', 'lost'],
		sections: [
			{
				id: 'save-your-first-key',
				title: 'Save your first key before continuing',
				steps: ['Create an account with your email address.', 'Copy the key shown after signup and store it in your password manager or approved secret store.', 'Continue to the dashboard after saving the key. You will use an active key to sign in again.'],
				paragraphs: ['The full key is shown once. The application stores its SHA-256 hash, not a recoverable copy of the key. Treat it as an account credential.'],
				links: [{ label: 'Create an account', href: '/signup' }, { label: 'Sign in', href: '/login' }]
			},
			{
				id: 'replace-a-key',
				title: 'Create a replacement, then revoke the old key',
				steps: ['Open Account keys in your dashboard and create a new key.', 'Save the new key before leaving the page.', 'Confirm you can sign in with the replacement before revoking a key you still need.', 'Revoke the old key. It can no longer be used to sign in.'],
				note: 'Keep at least one active key that you have saved. There is no self-service email recovery flow. Revoking a key does not sign out sessions that already exist.',
				links: [{ label: 'Manage keys', href: '/dashboard/keys' }]
			},
			{
				id: 'which-service',
				title: 'Use credentials with the service that issued them',
				paragraphs: ['Keys created in this hosted Pages application authenticate your account here. For hosted API access, create an integration key at /dashboard/api and activate a paid subscription when checkout is available.', 'A self-hosted Deno service has separate customers, keys, sessions, and quotas in Deno KV. Hosted account keys are stored in Cloudflare D1. The two stores are not connected, even though the key formats look similar.'],
				links: [{ label: 'Choose an integration option', href: '/docs/integration' }]
			},
			{
				id: 'access-and-billing',
				title: 'Check current commercial availability',
				paragraphs: ['The pricing and billing pages show whether paid checkout is configured. When checkout is unavailable, creating an account does not start a paid subscription.', 'The hosted API has a subscription allowance shared by integration keys. Browser checks do not consume it. Saved validation history and team roles are not provided. Deno quotas belong to a separate service.'],
				links: [{ label: 'View access and pricing', href: '/pricing' }, { label: 'Open billing', href: '/dashboard/billing' }]
			}
		]
	},
	{
		slug: 'integration',
		title: 'Choose an integration path',
		description: 'Compare the hosted customer API, local TypeScript, self-hosted Deno, and Python.',
		group: 'Set up your workflow',
		keywords: ['API', 'HTTP', 'REST', 'Node', 'Deno', 'Python', 'curl', 'Bearer', 'self-hosted'],
		sections: [
			{
				id: 'choose-runtime',
				title: 'Choose where checks run',
				table: {
					headings: ['Option', 'Use it for', 'Credentials'],
					rows: [
						['Hosted browser workspace', 'Interactive single and batch review on your device.', 'No account for single entries; sign in for batch.'],
						['TypeScript core from source', 'Checks inside your own Node or Deno application.', 'No service key.'],
						['Hosted customer API', 'Subscription-gated HTTP validation at /api/v1/validate.', 'An integration key from /dashboard/api.'],
						['Self-hosted Deno API', 'HTTP access with keys, rate limiting, and quotas you operate.', 'A key issued by that Deno deployment.'],
						['Python FastAPI wrapper', 'HTTP access to the separately maintained Python library.', 'No built-in key authentication; access controls are your responsibility.']
					]
				},
				note: 'The hosted endpoint is POST /api/v1/validate. Its /validate route is the browser workspace. Follow /docs/hosted-api for the hosted API contract; Deno endpoints below have different keys and response shapes.'
			},
			{
				id: 'typescript',
				title: 'Run the TypeScript core locally',
				paragraphs: ['Clone the repository and run these commands from its root with Node.js 24. Consume the built package from source.'],
				code: {
					label: 'Build and check an example',
					value: 'npm --prefix packages/core ci\nnpm --prefix packages/core run build\nnode --input-type=module -e \'\n  import { validateKaryotypeNative } from "./packages/core/dist/index.js";\n  console.log(JSON.stringify(validateKaryotypeNative("46,XX"), null, 2));\n\''
				},
				links: [{ label: 'Source repository', href: 'https://github.com/nuin/iscn-authenticator' }, { label: 'Understand the result contract', href: '/docs/reading-results' }]
			},
			{
				id: 'deno-api',
				title: 'Call a Deno service you operate',
				paragraphs: ['Deploy the Deno runtime or run it locally. Obtain a key from that deployment, then set ISCN_API_BASE and ISCN_API_KEY in your server environment. The following request uses a JSON body.', 'The endpoint returns HTTP 200 for completed checks, including valid: false results. Handle transport errors separately. Default Deno limits are 60 requests per minute with a burst of 120; monthly defaults are 10,000 for free and 1,000,000 for pro customer records. Operators can change these settings.'],
				code: {
					label: 'POST to your Deno service',
					value: 'curl --fail-with-body "$ISCN_API_BASE/validate" \\\n  -H "Authorization: Bearer $ISCN_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"karyotype":"46,XX"}\''
				},
				links: [{ label: 'Deno API reference', href: 'https://github.com/nuin/iscn-authenticator/blob/master/docs/api.md' }, { label: 'Deno operator guide', href: 'https://github.com/nuin/iscn-authenticator/blob/master/docs/admin.md' }]
			},
			{
				id: 'python-wrapper',
				title: 'Run the Python wrapper',
				paragraphs: ['The FastAPI wrapper uses the external iscn-authenticator Python package pinned by api/uv.lock. Run it from the repository root with Python 3.11 or newer. Its routes and error responses are separate from the Deno service.'],
				code: {
					label: 'Start a local Python service',
					value: 'uv sync --project api --locked\nuv run --project api --locked python -m uvicorn api.server:app --reload\n\n# In a second terminal:\ncurl --fail-with-body http://127.0.0.1:8000/validate \\\n  -H "Content-Type: application/json" \\\n  -d \'{"karyotype":"46,XX"}\''
				},
				links: [{ label: 'Python library repository', href: 'https://github.com/nuin/iscn-authenticator-py' }]
			}
		]
	},
	{
		slug: 'data-handling',
		title: 'Understand data handling',
		description: 'See what stays in your browser and which actions contact a service.',
		group: 'Set up your workflow',
		keywords: ['privacy', 'local', 'network', 'storage', 'history', 'patient', 'logs', 'export'],
		sections: [
			{
				id: 'browser-checks',
				title: 'Browser checks stay on your device',
				paragraphs: ['After the page and its assets load, single, batch and report checks run in your browser. FISH construction and CNV evidence calculations also run locally. Review inputs, narratives, evidence citations and reviewer names are not sent by these checks to the application server.', 'There is no server-side validation history. CSV and JSON downloads are generated locally. Inputs remain in page memory until cleared or discarded; no review data is written to localStorage. The browser, operating system, clipboard, and downloaded files remain part of your own data-handling environment.'],
				note: 'Use notation without patient names or specimen identifiers. If you put a karyotype in a URL, the URL is sent when the page is requested and can appear in browser history or infrastructure logs. Paste into the workspace for local checking.'
			},
			{
				id: 'account-requests',
				title: 'Account and billing actions use the server',
				table: {
					headings: ['Action', 'Data flow'],
					rows: [
						['Create an account', 'Your email and account records are stored in Cloudflare D1. A key hash is stored for authentication.'],
						['Sign in', 'The entered key is sent to the server for verification. A session cookie keeps you signed in.'],
						['Create or revoke keys', 'Account and key metadata are read or updated on the server.'],
						['Use configured billing', 'The server creates a Stripe session. Payment details are entered on Stripe’s pages.'],
						['Visit pages or the example library', 'The host receives normal page requests and associated request metadata.']
					]
				},
				links: [{ label: 'Read the privacy notice', href: '/privacy' }]
			},
			{
				id: 'self-hosted-data',
				title: 'Hosted and self-hosted APIs send notation to a server',
				paragraphs: ['The hosted /api/v1/validate endpoint sends notation to Cloudflare for processing. Its application storage contains hashed integration keys, subscription entitlements and aggregate counts, not notation or results. See /docs/hosted-api for its full contract.', 'Calling a Deno or Python HTTP service sends the karyotype to that service. Review the deployment, proxies, logging, access controls, and retention settings before integrating.', 'The Deno request logger omits karyotype payloads, but this does not establish how every proxy or hosting provider handles a request. POST bodies avoid putting the notation into the request URL.', 'This documentation and the repository’s compliance templates do not establish certification, an executed agreement, or suitability for a particular laboratory workflow.'],
				links: [{ label: 'Compare integration options', href: '/docs/integration' }]
			}
		]
	}
];
