import { NextRequest } from 'next/server';
import { z } from 'zod';
import { bearerToken, getUserFromToken } from '@/lib/billing/admin';
import { paypalRequest } from '@/lib/billing/paypal';
import { getSubscription } from '@/lib/billing/subscriptions';

export const runtime = 'nodejs';

/**
 * Cancel the signed-in user's PayPal subscription.
 *
 * PayPal has no cancel-at-period-end: cancellation stops the agreement
 * immediately. The resulting `BILLING.SUBSCRIPTION.CANCELLED` webhook mirrors
 * the state into our table, and paid access ends. (Resume is a no-op — a
 * cancelled PayPal subscription cannot be reactivated; the user subscribes
 * again through checkout.)
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
  // The stripe_subscription_id column stores the PayPal subscription id
  // (see lib/billing/subscriptions.ts).
  if (!sub?.stripe_subscription_id) {
    return Response.json({ error: 'No active subscription to cancel.' }, { status: 400 });
  }

  if (resume) {
    return Response.json(
      { error: 'A cancelled PayPal subscription cannot be resumed. Please subscribe again.' },
      { status: 400 }
    );
  }

  try {
    await paypalRequest(
      'POST',
      `/v1/billing/subscriptions/${sub.stripe_subscription_id}/cancel`,
      { reason: 'Customer requested cancellation.' }
    );
    return Response.json({ ok: true, cancelAtPeriodEnd: false });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to cancel subscription.' },
      { status: 500 }
    );
  }
}
