import 'server-only';
import Stripe from 'stripe';
import type { BillingInterval, PlanId } from './plans';

/**
 * Server-only Stripe client (AGENTS.md §15: the secret key never reaches the
 * browser). Stripe Checkout supports inline price_data so we don't need to
 * pre-create plans in the dashboard — prices are defined in plans.ts.
 *
 * Env vars:
 *   STRIPE_SECRET_KEY        — sk_test_... or sk_live_...
 *   STRIPE_WEBHOOK_SECRET    — whsec_... (from `stripe listen` or dashboard)
 *   STRIPE_MONTHLY_PRICE_ID  — price_... for the monthly plan
 *   STRIPE_YEARLY_PRICE_ID   — price_... for the yearly plan
 */

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set. Add it to .env.local.');
  }
  _stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
  return _stripe;
}

/** The Stripe Price ID for a given plan (from env). */
export function stripePriceId(plan: PlanId): string {
  const env =
    plan === 'monthly'
      ? process.env.STRIPE_MONTHLY_PRICE_ID
      : process.env.STRIPE_YEARLY_PRICE_ID;
  if (!env) {
    throw new Error(
      `STRIPE_${plan.toUpperCase()}_PRICE_ID is not set. Create the price in Stripe and add it to .env.local.`
    );
  }
  return env;
}

/** Map a Stripe Price ID back to our plan catalog. */
export function planFromStripePriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_MONTHLY_PRICE_ID) return 'monthly';
  if (priceId === process.env.STRIPE_YEARLY_PRICE_ID) return 'yearly';
  return null;
}

/** Billing interval for a Stripe price id. */
export function intervalFromStripePriceId(priceId: string | null | undefined): BillingInterval | null {
  const plan = planFromStripePriceId(priceId);
  if (plan === 'monthly') return 'month';
  if (plan === 'yearly') return 'year';
  return null;
}

/** Verify a Stripe webhook signature and return the parsed event. Throws on failure. */
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set. Add it to .env.local.');
  }
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}
