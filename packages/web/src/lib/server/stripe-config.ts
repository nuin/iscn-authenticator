export const STRIPE_API = 'https://api.stripe.com/v1';
export const STRIPE_API_VERSION = '2025-03-31.basil';

export function stripeHeaders(secretKey: string): Record<string, string> {
  return { Authorization: `Bearer ${secretKey}`, 'Stripe-Version': STRIPE_API_VERSION };
}
