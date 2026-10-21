import { stripeId, stripeObject } from './stripe-events.ts';
import { STRIPE_API, stripeHeaders } from './stripe-config.ts';

export interface ApiOffering {
  id: string;
  active: boolean;
  currency: string;
  amount: number;
  monthlyLimit: number;
}

export function parseApiOffering(value: unknown): ApiOffering | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const price = stripeObject(value);
  if (price.object !== 'price' || price.type !== 'recurring' || typeof price.active !== 'boolean' ||
      price.billing_scheme !== 'per_unit' || price.transform_quantity != null ||
      !Number.isSafeInteger(price.unit_amount) || Number(price.unit_amount) <= 0 ||
      typeof price.currency !== 'string' || !/^[a-z]{3}$/.test(price.currency)) return null;
  if (!price.recurring || typeof price.recurring !== 'object' || Array.isArray(price.recurring) ||
      !price.metadata || typeof price.metadata !== 'object' || Array.isArray(price.metadata)) return null;
  const recurring = stripeObject(price.recurring);
  const metadata = stripeObject(price.metadata);
  const allowance = metadata.validations_per_month;
  if (recurring.interval !== 'month' || recurring.interval_count !== 1 || recurring.usage_type !== 'licensed' ||
      typeof allowance !== 'string' || !/^[1-9]\d*$/.test(allowance) ||
      !Number.isSafeInteger(Number(allowance))) return null;
  return { id: stripeId(price.id, 'price_'), active: price.active, currency: price.currency,
    amount: Number(price.unit_amount), monthlyLimit: Number(allowance) };
}

export async function getApiOffering(secretKey: string, priceId: string): Promise<ApiOffering | null> {
  const id = stripeId(priceId, 'price_');
  const response = await fetch(`${STRIPE_API}/prices/${id}`, {
    headers: stripeHeaders(secretKey), signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('API offering lookup failed');
  const offering = parseApiOffering(await response.json());
  return offering?.id === id && offering.active ? offering : null;
}
