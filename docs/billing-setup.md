# Billing & subscriptions setup (PayPal + InsForge)

This wires up the subscription system: Free / Monthly ($9.99) / Yearly ($99.99)
plans, PayPal Subscriptions checkout, webhooks, and server-enforced project
limits. Complete these one-time steps before the feature works.

## 1. Create the `subscriptions` table (InsForge)

Run this SQL in the InsForge dashboard (SQL editor) or via `insforge` CLI. One
row per user; only the user can read their own row, and only the service key
(webhook / server routes) can write it.

```sql
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id text,      -- stores the PayPal payer id (legacy name)
  stripe_subscription_id text,  -- stores the PayPal subscription id (legacy name)
  plan text not null default 'free',
  billing_interval text,
  status text not null default 'free',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Users may read ONLY their own subscription. No client insert/update/delete:
-- all writes go through the server (admin key) in the PayPal webhook.
create policy "read own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);
```

> The `stripe_*` column names are legacy — billing migrated from Stripe to
> PayPal and the columns were kept to avoid a schema change. They store the
> PayPal payer id and PayPal subscription (billing agreement) id. Optional
> rename: `alter table public.subscriptions rename column stripe_customer_id to paypal_payer_id;`
> (and `stripe_subscription_id` → `paypal_subscription_id`), then update the
> field names in `lib/billing/subscriptions.ts`, `lib/billing/types.ts`, and
> the billing routes.

> The webhook and server routes use the InsForge **admin** key, which bypasses
> RLS, so no write policies are needed for anon/authenticated roles.

The existing `projects` table is unchanged — the project-limit check counts rows
there server-side.

## 2. PayPal developer dashboard

1. Create a **REST API app** at developer.paypal.com (Sandbox for dev) and copy
   the **Client ID** and **Secret**.
2. Create a **Product** (Catalog → Products → Add product, type "Service"),
   then two **billing plans** under it:
   - Monthly — $9.99 / month
   - Yearly — $99.99 / year
   Copy each plan id (`P-…`). Amounts must match `lib/billing/plans.ts`.
   (Plans can also be created via the `/v1/billing/plans` API.)
3. Create a **webhook** pointing at `https://<your-domain>/api/billing/webhook`
   subscribed to:
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.UPDATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.SUSPENDED`
   - `BILLING.SUBSCRIPTION.EXPIRED`
   - `PAYMENT.SALE.COMPLETED`
   Copy the **Webhook ID** (shown in the webhook's details).

Note: PayPal subscriptions cannot take inline prices (unlike Stripe Checkout's
`price_data`) — the plan ids are read from env vars. There is also no hosted
customer portal: "Manage Billing" redirects to the subscriber's own PayPal
account → Settings → Payments → Automatic payments. Cancellation is immediate
(PayPal has no cancel-at-period-end).

## 3. Environment variables (`.env.local`, server-only)

```bash
# PayPal — never expose these to the browser (no NEXT_PUBLIC_ prefix).
PAYPAL_ENV=sandbox            # or "live"
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=***PAYPAL_WEBHOOK_ID=xxx          # webhook id from step 2.3
PAYPAL_MONTHLY_PLAN_ID=P-xxx # from step 2.2
PAYPAL_YEARLY_PLAN_ID=P-xxx

# InsForge admin (service) key — the `api_key` from .insforge/project.json.
# Server-only: bypasses RLS, used by the webhook and project-limit routes.
INSFORGE_ADMIN_KEY=ik_xxx

# Public base URL used for PayPal return/cancel URLs.
# Optional in dev (falls back to the request origin / http://localhost:3000).
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 4. Local webhook testing

PayPal can't push webhooks to localhost, so either:

- expose the dev server (`ngrok http 3000` or a Cloudflare tunnel) and point a
  second sandbox webhook at the public URL, or
- use "Webhook simulator"-style manual testing: send a signed test event from
  the dashboard's webhook page (PayPal shows delivery attempts + responses).

Sandbox checkout flow: subscribe with a sandbox **personal** account; the money
moves between sandbox accounts only.

## 5. How enforcement works

- **Project limit** — creation goes through `POST /api/projects`, which verifies
  the user's token, computes their entitlement (subscription + live project
  count), and rejects Free users at 2 projects with HTTP 402. The client maps
  402 to an upgrade dialog. The browser cannot bypass this.
- **Shopify export** — gated in the editor by the server-provided entitlement
  (`canExport`); Free users see the upgrade dialog instead of the export flow.
- **Sync** — the webhook mirrors every PayPal subscription change into the
  `subscriptions` table, so permissions update automatically after checkout,
  renewal, cancellation, or suspension.
