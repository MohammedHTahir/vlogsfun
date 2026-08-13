import { NextRequest } from 'next/server';
import { z } from 'zod';
import { bearerToken, getUserFromToken } from '@/lib/billing/admin';
import { paypalPlanId, paypalRequest } from '@/lib/billing/paypal';
import { appOrigin } from '@/lib/billing/server-utils';
import { PLANS } from '@/lib/billing/plans';

export const runtime = 'nodejs';

/**
 * Start a PayPal subscription for a paid plan (AGENTS.md §5: thin route, §15:
 * the PayPal secret stays server-side).
 *
 * PayPal has no equivalent of Stripe Checkout's inline `price_data`: recurring
 * plans must exist in PayPal ahead of time, so we look up the plan id from env
 * (PAYPAL_MONTHLY_PLAN_ID / PAYPAL_YEARLY_PLAN_ID) and create a subscription
 * that references it. The user id rides along as `custom_id`, which PayPal
 * returns on every webhook event so we can attribute the subscription.
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
  try {
    const subscription = await paypalRequest<{
      id: string;
      status: string;
      links?: Array<{ href: string; rel: string }>;
    }>('POST', '/v1/billing/subscriptions', {
      plan_id: paypalPlanId(plan.id),
      custom_id: user.id,
      subscriber: user.email ? { email_address: user.email } : undefined,
      application_context: {
        brand_name: 'vlogs.fun',
        user_action: 'SUBSCRIBE_NOW',
        return_url: `${origin}/billing?checkout=success`,
        cancel_url: `${origin}/billing?checkout=cancelled`,
      },
    });

    const approve = subscription.links?.find((l) => l.rel === 'approve');
    if (!approve) {
      return Response.json(
        { error: 'PayPal did not return an approval URL.' },
        { status: 502 }
      );
    }
    return Response.json({ url: approve.href });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to start checkout.' },
      { status: 500 }
    );
  }
}
