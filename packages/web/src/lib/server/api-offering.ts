import { stripeId, stripeObject } from './stripe-events.ts';

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
      !Number.isSafeInteger(price.unit_amount) || Number(price.unit_amount) <= 0 ||
      typeof price.currency !== 'string' || !/^[a-z]{3}$/.test(price.currency)) return null;
  if (!price.recurring || typeof price.recurring !== 'object' || Array.isArray(price.recurring) ||
      !price.metadata || typeof price.metadata !== 'object' || Array.isArray(price.metadata)) return null;
  const recurring = stripeObject(price.recurring);
  const metadata = stripeObject(price.metadata);
  const allowance = metadata.validations_per_month;
  if (recurring.interval !== 'month' || recurring.interval_count !== 1 ||
      typeof allowance !== 'string' || !/^[1-9]\d*$/.test(allowance) ||
      !Number.isSafeInteger(Number(allowance))) return null;
  return { id: stripeId(price.id, 'price_'), active: price.active, currency: price.currency,
    amount: Number(price.unit_amount), monthlyLimit: Number(allowance) };
}

export async function getApiOffering(secretKey: string, priceId: string): Promise<ApiOffering | null> {
  const id = stripeId(priceId, 'price_');
  const response = await fetch(`https://api.stripe.com/v1/prices/${id}`, {
    headers: { Authorization: `Bearer ${secretKey}` }, signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('API offering lookup failed');
  const offering = parseApiOffering(await response.json());
  return offering?.id === id && offering.active ? offering : null;
}
