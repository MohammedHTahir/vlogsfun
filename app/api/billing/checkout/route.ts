import { NextRequest } from 'next/server';
import { z } from 'zod';
import { bearerToken, getUserFromToken } from '@/lib/billing/admin';
import { getStripe, stripePriceId } from '@/lib/billing/stripe';
import { appOrigin } from '@/lib/billing/server-utils';
import { PLANS } from '@/lib/billing/plans';
import { getSubscription } from '@/lib/billing/subscriptions';

export const runtime = 'nodejs';

/**
 * Create a Stripe Checkout Session for a recurring subscription.
 * The user is redirected to Stripe's hosted checkout page.
 * On success Stripe redirects to /billing?checkout=success,
 * on cancel to /billing?checkout=cancelled.
 *
 * If the user already has a Stripe customer id we attach the session to it so
 * their payment methods are remembered.
 */
const bodySchema = z.object({ plan: z.enum(['monthly', 'yearly']) });

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(bearerToken(req));
  if (!user) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Invalid plan.' }, { status: 400 });
  }

  const plan = PLANS[parsed.data.plan];
  if (!plan.interval) {
    return Response.json({ error: 'Selected plan is not billable.' }, { status: 400 });
  }

  const origin = appOrigin(req);
  const stripe = getStripe();

  // Reuse existing Stripe customer if we have one.
  const sub = await getSubscription(user.id);
  const existingCustomerId = sub?.stripe_customer_id ?? undefined;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: existingCustomerId,
      customer_email: existingCustomerId ? undefined : (user.email || undefined),
      line_items: [{ price: stripePriceId(plan.id), quantity: 1 }],
      subscription_data: {
        // Carry the InsForge user id so the webhook can attribute the subscription.
        metadata: { userId: user.id },
      },
      success_url: `${origin}/billing?checkout=success`,
      cancel_url: `${origin}/billing?checkout=cancelled`,
    });

    if (!session.url) {
      return Response.json({ error: 'Stripe did not return a checkout URL.' }, { status: 502 });
    }
    return Response.json({ url: session.url });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to start checkout.' },
      { status: 500 }
    );
  }
}
