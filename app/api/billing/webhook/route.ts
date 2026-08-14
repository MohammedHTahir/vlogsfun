import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { constructWebhookEvent, planFromStripePriceId, intervalFromStripePriceId } from '@/lib/billing/stripe';
import { upsertSubscription } from '@/lib/billing/subscriptions';
import type { PlanId } from '@/lib/billing/plans';
import type { SubscriptionStatus } from '@/lib/billing/types';

export const runtime = 'nodejs';

/**
 * Stripe webhook — the source of truth for subscription state.
 * Subscribe to these events in the Stripe dashboard:
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *
 * The raw request body is required for signature verification.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return Response.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(raw, sig);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Webhook verification failed.' },
      { status: 400 }
    );
  }

  try {
    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      await syncSubscription(event.data.object as Stripe.Subscription);
    }
    return Response.json({ received: true });
  } catch (err) {
    // Return 500 so Stripe retries transient failures.
    return Response.json(
      { error: err instanceof Error ? err.message : 'Webhook handler failed.' },
      { status: 500 }
    );
  }
}

/** Mirror a Stripe subscription into our `subscriptions` table. */
async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  // userId is stamped in subscription metadata at checkout.
  const userId = sub.metadata?.userId;
  if (!userId) return;

  const priceId = (sub.items.data[0]?.price?.id) ?? null;
  const status = mapStatus(sub.status);
  const plan: PlanId = status === 'canceled' ? 'free' : (planFromStripePriceId(priceId) ?? 'free');

  await upsertSubscription({
    userId,
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : (sub.customer?.id ?? null),
    stripeSubscriptionId: sub.id,
    plan,
    billingInterval: status === 'canceled' ? null : intervalFromStripePriceId(priceId),
    status,
    currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
    currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  });
}

/** Map Stripe subscription statuses to our internal union. */
function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'active':      return 'active';
    case 'trialing':    return 'trialing';
    case 'past_due':    return 'past_due';
    case 'canceled':    return 'canceled';
    case 'unpaid':      return 'unpaid';
    case 'incomplete':  return 'incomplete';
    case 'incomplete_expired': return 'incomplete_expired';
    case 'paused':      return 'paused';
    default:            return 'free';
  }
}
