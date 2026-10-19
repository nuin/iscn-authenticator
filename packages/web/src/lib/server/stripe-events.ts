export interface BillingTarget {
  customerId: string;
  subscriptionId: string;
  userId?: string;
}

export interface BillingEvent {
  id: string;
  target: BillingTarget | null;
}

export function stripeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid Stripe object');
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid Stripe field');
  return value;
}

export function stripeId(value: unknown, prefix: string): string {
  const id = requiredString(typeof value === 'object' && value !== null ? stripeObject(value).id : value);
  if (!id.startsWith(prefix) || !/^[a-zA-Z0-9_]+$/.test(id) || id.length <= prefix.length) {
    throw new Error('Invalid Stripe identifier');
  }
  return id;
}

export function accountMetadata(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const metadata = stripeObject(value);
  return metadata.customer_id === undefined ? undefined : requiredString(metadata.customer_id);
}

function checkoutTarget(object: Record<string, unknown>): BillingTarget | null {
  if (object.object !== 'checkout.session') throw new Error('Invalid Checkout object');
  stripeId(object.id, 'cs_');
  const mode = requiredString(object.mode);
  const status = requiredString(object.payment_status);
  if (!['subscription', 'payment', 'setup'].includes(mode) ||
      !['paid', 'unpaid', 'no_payment_required'].includes(status)) {
    throw new Error('Invalid Checkout status');
  }
  const customerId = object.customer == null ? null : stripeId(object.customer, 'cus_');
  const subscriptionId = object.subscription == null ? null : stripeId(object.subscription, 'sub_');
  const metadataId = accountMetadata(object.metadata);
  const referenceId = object.client_reference_id == null ? undefined : requiredString(object.client_reference_id);
  if (metadataId && referenceId && metadataId !== referenceId) throw new Error('Conflicting account references');
  if (mode !== 'subscription' || status === 'unpaid') return null;
  if (!customerId || !subscriptionId) throw new Error('Incomplete subscription Checkout');
  const userId = metadataId ?? referenceId;
  return userId ? { customerId, subscriptionId, userId } : null;
}

function invoiceTarget(object: Record<string, unknown>): BillingTarget | null {
  if (object.object !== 'invoice') throw new Error('Invalid invoice object');
  stripeId(object.id, 'in_');
  const customerId = stripeId(object.customer, 'cus_');
  let subscription = object.subscription;
  if (object.parent != null) {
    const parent = stripeObject(object.parent);
    if (parent.type === 'subscription_details') {
      const current = stripeObject(parent.subscription_details).subscription;
      if (subscription != null && stripeId(subscription, 'sub_') !== stripeId(current, 'sub_')) {
        throw new Error('Conflicting subscription references');
      }
      subscription = current;
    }
  }
  return subscription == null ? null : { customerId, subscriptionId: stripeId(subscription, 'sub_') };
}

export function parseBillingEvent(value: unknown): BillingEvent {
  const event = stripeObject(value);
  const id = stripeId(requiredString(event.id), 'evt_');
  const type = requiredString(event.type);
  if (event.object !== 'event' || !Number.isSafeInteger(event.created) || Number(event.created) < 0) {
    throw new Error('Invalid event envelope');
  }
  const object = stripeObject(stripeObject(event.data).object);
  requiredString(object.object);
  let target: BillingTarget | null = null;
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(type)) {
    target = checkoutTarget(object);
  } else if (['invoice.paid', 'invoice.payment_succeeded', 'invoice.payment_failed'].includes(type)) {
    target = invoiceTarget(object);
  } else if (['customer.subscription.created', 'customer.subscription.updated',
    'customer.subscription.deleted', 'customer.subscription.paused', 'customer.subscription.resumed'].includes(type)) {
    if (object.object !== 'subscription') throw new Error('Invalid subscription object');
    target = { customerId: stripeId(object.customer, 'cus_'), subscriptionId: stripeId(object.id, 'sub_') };
  }
  return { id, target };
}
