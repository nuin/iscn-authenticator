import type { Guide } from './types.js';

export const setupGuides: Guide[] = [
	{
		slug: 'accounts-and-keys',
		title: 'Sign in and recover your account',
		description: 'Verify your email, sign in with a code, and recover access.',
		group: 'Set up your workflow',
		keywords: ['signup', 'login', 'password', 'revoke', 'rotate', 'billing', 'lost'],
		sections: [
            {
                id: 'verify-email',
                title: 'Verify your email before opening an account',
                steps: ['Open Create an account and enter an email address you control.', 'Look for an email from iscn@bioinformat.org. Enter its eight-digit code in the same browser within ten minutes.', 'After verification, your account opens in the dashboard. No password or account key is required.'],
                paragraphs: ['An account and session are created only after verification. Signup with an existing address signs you in to that account after the same email check.', 'Check your spam folder if the code does not arrive. Wait at least one minute before sending another. Use the newest code requested in that browser; five incorrect attempts require a new code. Never share codes with support or paste them into chat.'],
                links: [{ label: 'Create an account', href: '/signup' }, { label: 'Sign in', href: '/login' }]
            },
            {
                id: 'recover-access',
                title: 'Recover access and sign out other browsers',
                steps: ['Open Recover account access and enter your account email.', 'Enter the recovery code in the browser that requested it.', 'Recovery signs out other browser sessions and opens a fresh session.'],
                paragraphs: ['For an email-verified account, recovery preserves your subscription and API integration keys. If an integration key may be compromised, revoke it separately on API access.', 'If you cannot access the email inbox, contact iscn@bioinformat.org. Email changes require an identity review; there is no automatic recovery through another address.'],
                links: [{ label: 'Recover account access', href: '/recover' }, { label: 'Manage API keys', href: '/dashboard/api' }]
            },
            {
                id: 'existing-accounts',
                title: 'Moving from account keys to email codes',
                paragraphs: ['Old website account keys no longer sign you in. Use the email recorded on the account. The first email verification invalidates all pre-verification sessions and keys, including API integration keys, because those credentials were issued before email ownership was checked. Recreate API keys after that first verification.', 'Account identifiers, subscription details and usage records are preserved. Later sign-ins keep other verified sessions active. Recovery explicitly signs them out.', 'Email addresses are matched without case differences. If multiple older accounts share the same address with different capitalization, contact support; the service never merges them automatically. A self-hosted Deno service keeps its own separate account system.'],
                links: [{ label: 'Account access settings', href: '/dashboard/keys' }]
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
						['Create an account', 'A code is emailed through Cloudflare. Your email is stored with a short-lived challenge; an account is created only after verification.'],
						['Sign in', 'Your email and code are sent to the server. A verified code starts a session lasting up to 30 days.'],
						['Recover access or manage API keys', 'Recovery invalidates other sessions. API key metadata and hashes are stored on the server.'],
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
