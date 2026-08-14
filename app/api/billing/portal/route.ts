import { NextRequest } from 'next/server';
import { bearerToken, getUserFromToken } from '@/lib/billing/admin';
import { getStripe } from '@/lib/billing/stripe';
import { getSubscription } from '@/lib/billing/subscriptions';
import { appOrigin } from '@/lib/billing/server-utils';

export const runtime = 'nodejs';

/**
 * Create a Stripe Customer Portal session so the user can manage their
 * subscription, update payment methods, and view invoices — without us
 * building any of that UI ourselves.
 *
 * Requires the Customer Portal to be configured in the Stripe dashboard:
 * https://dashboard.stripe.com/test/settings/billing/portal
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromToken(bearerToken(req));
  if (!user) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const sub = await getSubscription(user.id);
  if (!sub?.stripe_customer_id) {
    return Response.json(
      { error: 'No billing account yet. Subscribe to a plan first.' },
      { status: 400 }
    );
  }

  const origin = appOrigin(req);
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/billing`,
    });
    return Response.json({ url: session.url });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to open billing portal.' },
      { status: 500 }
    );
  }
}
