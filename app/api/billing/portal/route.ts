import { NextRequest } from 'next/server';
import { bearerToken, getUserFromToken } from '@/lib/billing/admin';
import { paypalAccountUrl } from '@/lib/billing/paypal';
import { getSubscription } from '@/lib/billing/subscriptions';

export const runtime = 'nodejs';

/**
 * "Billing portal" equivalent for PayPal. PayPal has no hosted customer
 * portal; subscribers manage pre-approved payments from their own PayPal
 * account (Settings → Payments → Automatic payments). We redirect there.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromToken(bearerToken(req));
  if (!user) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const sub = await getSubscription(user.id);
  if (!sub?.stripe_subscription_id) {
    return Response.json(
      { error: 'No billing account yet. Subscribe to a plan first.' },
      { status: 400 }
    );
  }

  return Response.json({ url: `${paypalAccountUrl()}/myaccount/autopay/` });
}
