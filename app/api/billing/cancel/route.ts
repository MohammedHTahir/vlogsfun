import { NextRequest } from 'next/server';
import { z } from 'zod';
import { bearerToken, getUserFromToken } from '@/lib/billing/admin';
import { getStripe } from '@/lib/billing/stripe';
import { getSubscription, upsertSubscription } from '@/lib/billing/subscriptions';

export const runtime = 'nodejs';

/**
 * Cancel or resume a Stripe subscription.
 *
 * { resume: false } (default) — sets cancel_at_period_end = true so access
 *   continues until the period ends, then stops. The webhook will sync state.
 *
 * { resume: true } — removes the cancellation so the subscription renews.
 */
const bodySchema = z.object({ resume: z.boolean().optional() });

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(bearerToken(req));
  if (!user) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const resume = parsed.success ? parsed.data.resume === true : false;

  const sub = await getSubscription(user.id);
  if (!sub?.stripe_subscription_id) {
    return Response.json({ error: 'No active subscription to cancel.' }, { status: 400 });
  }

  const stripe = getStripe();
  try {
    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: !resume,
    });

    // Optimistically update local state — the webhook will also sync it.
    await upsertSubscription({
      userId: user.id,
      stripeCustomerId: sub.stripe_customer_id,
      stripeSubscriptionId: sub.stripe_subscription_id,
      plan: sub.plan,
      billingInterval: sub.billing_interval,
      status: sub.status,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: updated.cancel_at_period_end,
    });

    return Response.json({ ok: true, cancelAtPeriodEnd: updated.cancel_at_period_end });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to update subscription.' },
      { status: 500 }
    );
  }
}
