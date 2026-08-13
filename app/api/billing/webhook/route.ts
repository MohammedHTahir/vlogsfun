import { NextRequest } from 'next/server';
import {
  getPaypalSubscription,
  intervalFromPaypalPlanId,
  planFromPaypalPlanId,
  verifyWebhookSignature,
  type PaypalSubscription,
} from '@/lib/billing/paypal';
import { upsertSubscription } from '@/lib/billing/subscriptions';
import type { PlanId } from '@/lib/billing/plans';
import type { SubscriptionStatus } from '@/lib/billing/types';

export const runtime = 'nodejs';

/**
 * PayPal webhook — the source of truth for subscription state. Every event is
 * verified with PayPal's verify-webhook-signature endpoint, then mirrored into
 * the `subscriptions` table so local permissions (project limit, export)
 * update automatically after subscribe, renewal, cancellation, or suspension.
 *
 * The raw request body is required for verification, so we read it with
 * `req.text()` (App Router route handlers do not pre-parse the body).
 *
 * Relevant event types (subscribe to these in the PayPal dashboard):
 *   BILLING.SUBSCRIPTION.ACTIVATED / .UPDATED / .CANCELLED / .SUSPENDED / .EXPIRED
 *   PAYMENT.SALE.COMPLETED (renewal paid — re-sync to extend the period end)
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();

  try {
    const verified = await verifyWebhookSignature({ headers: req.headers, rawBody: raw });
    if (!verified) {
      return Response.json({ error: 'Invalid webhook signature.' }, { status: 400 });
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Webhook verification failed.' },
      { status: 400 }
    );
  }

  let event: { event_type?: string; resource?: { id?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  try {
    const type = event.event_type ?? '';
    if (type.startsWith('BILLING.SUBSCRIPTION.') || type === 'PAYMENT.SALE.COMPLETED') {
      // For subscription events the resource IS the subscription; for
      // PAYMENT.SALE.COMPLETED the subscription id is in billing_agreement_id.
      const resource = event.resource as { id?: string; billing_agreement_id?: string } | undefined;
      const subscriptionId =
        type === 'PAYMENT.SALE.COMPLETED' ? resource?.billing_agreement_id : resource?.id;
      if (subscriptionId) {
        await syncSubscription(await getPaypalSubscription(subscriptionId));
      }
    }
    // Unhandled event types are acknowledged so PayPal stops retrying.
    return Response.json({ received: true });
  } catch (err) {
    // Return 500 so PayPal retries transient failures (e.g. DB hiccup).
    return Response.json(
      { error: err instanceof Error ? err.message : 'Webhook handler failed.' },
      { status: 500 }
    );
  }
}

/** Map a PayPal subscription onto our `subscriptions` row and persist it. */
async function syncSubscription(sub: PaypalSubscription): Promise<void> {
  // `custom_id` carries the InsForge user id we stamped at checkout.
  const userId = sub.custom_id;
  if (!userId) {
    // Nothing we can attribute this subscription to — skip rather than guess.
    return;
  }

  const status = mapStatus(sub.status);
  const plan: PlanId = status === 'canceled' ? 'free' : planFromPaypalPlanId(sub.plan_id) ?? 'free';

  await upsertSubscription({
    userId,
    // Existing columns are reused for PayPal ids (see subscriptions.ts).
    stripeCustomerId: sub.subscriber?.payer_id ?? null,
    stripeSubscriptionId: sub.id,
    plan,
    billingInterval: status === 'canceled' ? null : intervalFromPaypalPlanId(sub.plan_id),
    status,
    currentPeriodStart: sub.billing_info?.last_payment?.time ?? sub.start_time ?? null,
    currentPeriodEnd: sub.billing_info?.next_billing_time ?? null,
    // PayPal has no cancel-at-period-end; cancellation is immediate.
    cancelAtPeriodEnd: false,
  });
}

/** PayPal statuses map onto our union; CANCELLED/EXPIRED drop access. */
function mapStatus(status: string): SubscriptionStatus {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return 'active';
    case 'APPROVAL_PENDING':
    case 'APPROVED':
      // Approved but not yet active — treat like an incomplete checkout.
      return 'incomplete';
    case 'SUSPENDED':
      // Payment failure / merchant suspension — grace-period access like past_due.
      return 'past_due';
    case 'CANCELLED':
    case 'EXPIRED':
      return 'canceled';
    default:
      return 'free';
  }
}
