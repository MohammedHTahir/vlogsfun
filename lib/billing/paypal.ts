import 'server-only';
import type { BillingInterval, PlanId } from './plans';

/**
 * Server-only PayPal REST client (AGENTS.md §15: the client secret must never
 * reach the browser). PayPal has no official Node SDK for the Subscriptions
 * API, so we call the REST endpoints directly with an OAuth2 client-credentials
 * access token (cached in memory until shortly before expiry).
 *
 * Unlike Stripe Checkout, PayPal does NOT accept inline price data — recurring
 * plans must be created ahead of time in the PayPal dashboard (or via the
 * /v1/billing/plans API) and referenced by plan id. Those ids come from env:
 *   PAYPAL_MONTHLY_PLAN_ID, PAYPAL_YEARLY_PLAN_ID
 */

const SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';
const LIVE_BASE = 'https://api-m.paypal.com';

let cachedToken: { value: string; expiresAt: number } | null = null;

export function paypalBaseUrl(): string {
  return (process.env.PAYPAL_ENV ?? 'sandbox').toLowerCase() === 'live'
    ? LIVE_BASE
    : SANDBOX_BASE;
}

/** Base URL of the customer-facing PayPal site (autopay management page). */
export function paypalAccountUrl(): string {
  return (process.env.PAYPAL_ENV ?? 'sandbox').toLowerCase() === 'live'
    ? 'https://www.paypal.com'
    : 'https://www.sandbox.paypal.com';
}

function credentials(): { clientId: string; secret: string } {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    throw new Error(
      'PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set. Add them to .env.local (see docs/billing-setup.md).'
    );
  }
  return { clientId, secret };
}

/** Obtain (and cache) an OAuth2 access token for server-side API calls. */
async function accessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }
  const { clientId, secret } = credentials();
  const res = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    throw new Error(`PayPal auth failed (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    // Refresh a minute early so an in-flight request never uses a stale token.
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

/** Authenticated PayPal REST call. Throws with PayPal's message on non-2xx. */
export async function paypalRequest<T = unknown>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${paypalBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const message =
      (payload as { message?: string } | null)?.message ?? `PayPal request failed (HTTP ${res.status}).`;
    throw new Error(message);
  }
  // Some endpoints (e.g. suspend/cancel) return 204 No Content.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** The PayPal billing plan id for one of our paid plans (from env). */
export function paypalPlanId(plan: PlanId): string {
  const env =
    plan === 'monthly' ? process.env.PAYPAL_MONTHLY_PLAN_ID : process.env.PAYPAL_YEARLY_PLAN_ID;
  if (!env) {
    throw new Error(
      `PAYPAL_${plan.toUpperCase()}_PLAN_ID is not set. Create the plan in PayPal and add it to .env.local.`
    );
  }
  return env;
}

/** Inverse of {@link paypalPlanId} — map a PayPal plan id back to our catalog. */
export function planFromPaypalPlanId(planId: string | null | undefined): PlanId | null {
  if (!planId) return null;
  if (planId === process.env.PAYPAL_MONTHLY_PLAN_ID) return 'monthly';
  if (planId === process.env.PAYPAL_YEARLY_PLAN_ID) return 'yearly';
  return null;
}

/** Billing interval for a PayPal plan id, for the `subscriptions` row. */
export function intervalFromPaypalPlanId(planId: string | null | undefined): BillingInterval | null {
  const plan = planFromPaypalPlanId(planId);
  if (plan === 'monthly') return 'month';
  if (plan === 'yearly') return 'year';
  return null;
}

/** Shape of the subset of a PayPal subscription resource we actually use. */
export interface PaypalSubscription {
  id: string;
  plan_id: string;
  status: string;
  custom_id?: string;
  subscriber?: { payer_id?: string; email_address?: string };
  billing_info?: { next_billing_time?: string; last_payment?: { time?: string } };
  start_time?: string;
}

export function getPaypalSubscription(id: string): Promise<PaypalSubscription> {
  return paypalRequest<PaypalSubscription>('GET', `/v1/billing/subscriptions/${id}`);
}

/**
 * Verify an incoming PayPal webhook event. PayPal's scheme is "call us back
 * with the headers + body and we'll tell you if it's genuine" rather than a
 * local HMAC, using the webhook id from the dashboard.
 */
export async function verifyWebhookSignature(req: {
  headers: Headers;
  rawBody: string;
}): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    throw new Error(
      'PAYPAL_WEBHOOK_ID is not set. Add it to .env.local (see docs/billing-setup.md).'
    );
  }
  const result = await paypalRequest<{ verification_status: string }>(
    'POST',
    '/v1/notifications/verify-webhook-signature',
    {
      auth_algo: req.headers.get('paypal-auth-algo'),
      cert_url: req.headers.get('paypal-cert-url'),
      transmission_id: req.headers.get('paypal-transmission-id'),
      transmission_sig: req.headers.get('paypal-transmission-sig'),
      transmission_time: req.headers.get('paypal-transmission-time'),
      webhook_id: webhookId,
      webhook_event: JSON.parse(req.rawBody),
    }
  );
  return result.verification_status === 'SUCCESS';
}
