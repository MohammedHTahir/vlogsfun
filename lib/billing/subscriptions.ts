import 'server-only';
import { getAdminClient } from './admin';
import { computeEntitlement } from './entitlements';
import type { BillingInterval, PlanId } from './plans';
import type { Entitlement, Subscription, SubscriptionStatus } from './types';

/**
 * Server-side `subscriptions` repository. All access uses the admin client
 * (bypasses RLS) because writes happen in the PayPal webhook where there is no
 * user session, and reads back the row for server-side gating. Keep every query
 * here (AGENTS.md §14) — routes stay thin.
 *
 * NOTE on column names: the table was provisioned with `stripe_customer_id` /
 * `stripe_subscription_id` columns during the Stripe era. Billing now runs on
 * PayPal, so those columns store the PayPal payer id and PayPal subscription
 * (billing agreement) id respectively. They can be renamed with:
 *   ALTER TABLE subscriptions RENAME COLUMN stripe_customer_id TO paypal_payer_id;
 *   ALTER TABLE subscriptions RENAME COLUMN stripe_subscription_id TO paypal_subscription_id;
 * (then update the field names in this file, types.ts, and the routes).
 */

const TABLE = 'subscriptions';

function unwrap<T>(data: unknown): T | null {
  const row = Array.isArray(data) ? data[0] : data;
  return (row as T) ?? null;
}

/** Fetch a user's subscription row, or null if they've never subscribed. */
export async function getSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await getAdminClient()
    .database.from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .limit(1);

  if (error) {
    throw new Error(error.message ?? 'Failed to load subscription.');
  }
  return unwrap<Subscription>(data);
}


/** Count the projects a user owns. Drives the Free-plan limit check. */
export async function countUserProjects(userId: string): Promise<number> {
  const { data, error } = await getAdminClient()
    .database.from('projects')
    .select('id')
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message ?? 'Failed to count projects.');
  }
  return Array.isArray(data) ? data.length : 0;
}

export interface SubscriptionUpsert {
  userId: string;
  /** PayPal payer id (stored in the legacy stripe_customer_id column). */
  stripeCustomerId: string | null;
  /** PayPal subscription / billing-agreement id (legacy stripe_subscription_id column). */
  stripeSubscriptionId: string | null;
  plan: PlanId;
  billingInterval: BillingInterval | null;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * Insert or update the subscription row for a user (one row per user). Called
 * from the webhook after every relevant PayPal event so local state always
 * mirrors PayPal. Uses `user_id` as the natural key.
 */
export async function upsertSubscription(input: SubscriptionUpsert): Promise<void> {
  const db = getAdminClient().database;
  const now = new Date().toISOString();

  const record = {
    user_id: input.userId,
    stripe_customer_id: input.stripeCustomerId,
    stripe_subscription_id: input.stripeSubscriptionId,
    plan: input.plan,
    billing_interval: input.billingInterval,
    status: input.status,
    current_period_start: input.currentPeriodStart,
    current_period_end: input.currentPeriodEnd,
    cancel_at_period_end: input.cancelAtPeriodEnd,
    updated_at: now,
  };

  const existing = await getSubscription(input.userId);

  if (existing) {
    const { error } = await db.from(TABLE).update(record).eq('user_id', input.userId);
    if (error) throw new Error(error.message ?? 'Failed to update subscription.');
    return;
  }

  const { error } = await db.from(TABLE).insert([{ ...record, created_at: now }]);
  if (error) throw new Error(error.message ?? 'Failed to create subscription.');
}


/** Load the authoritative entitlement for a user (subscription + project count). */
export async function getEntitlement(userId: string): Promise<Entitlement> {
  const [sub, projectCount] = await Promise.all([
    getSubscription(userId),
    countUserProjects(userId),
  ]);
  return computeEntitlement(sub, projectCount);
}
