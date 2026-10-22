import { parseArgs } from 'node:util';
import { BillingTestError, createPrivateCheckout, inspectPrivateCheckout, expirePrivateCheckout } from './lib/billing-test.mjs';

const help = `Private Stripe sandbox checkout (operator only)

Set STRIPE_TEST_SECRET_KEY in your environment or the ignored packages/web/.env file.
Never use live keys or real card details.

npm run billing:test -- create --return-url <https-url> --attempt <unique-name>
npm run billing:test -- status --session <cs_test_...>
npm run billing:test -- expire --session <cs_test_...>

Creates a CAD 1.00/month test fixture, not an approved commercial price.
No production users, subscriptions, or API entitlements are updated.
Keep the returned Checkout URL private. A return redirect is not payment confirmation.
Use status to check payment; cancel completed test subscriptions in Stripe.
See docs/private-checkout.md in the repository root.`;

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    help: { type: 'boolean' }, 'return-url': { type: 'string' }, attempt: { type: 'string' }, session: { type: 'string' },
  } });
  if (values.help) {
    console.log(help);
  } else {
    const [command] = positionals;
    if (positionals.length !== 1 || !['create', 'status', 'expire'].includes(command) ||
        (command === 'create' ? values.session : values.attempt || values['return-url'])) {
      throw new BillingTestError('Invalid arguments. Run npm run billing:test -- --help.');
    }
    const secret = process.env.STRIPE_TEST_SECRET_KEY;
    const result = command === 'create'
      ? await createPrivateCheckout({ secret, returnUrl: values['return-url'], attempt: values.attempt })
      : await (command === 'status' ? inspectPrivateCheckout : expirePrivateCheckout)(secret, values.session);
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(error instanceof BillingTestError ? error.message : 'Private checkout failed. Check your arguments and sandbox configuration; see --help.');
  process.exitCode = 1;
}
