# Stripe Webhook — Production Setup for launch-lense.vercel.app

## Step 1 — Create the webhook endpoint in Stripe Dashboard

1. Go to **https://dashboard.stripe.com/webhooks**
2. Click **"Add endpoint"**
3. Endpoint URL:
   ```
   https://launch-lense.vercel.app/api/webhooks/stripe
   ```
4. Under **"Select events to listen to"**, add exactly one event:
   ```
   checkout.session.completed
   ```
5. Click **"Add endpoint"**

> **Why only one event?** The handler ignores all other event types anyway (they are idempotent-logged and returned 200). Adding only what you need keeps the dashboard noise-free and slightly reduces Stripe charges in high-volume scenarios.

---

## Step 2 — Copy the signing secret

After creating the endpoint, Stripe shows a **Signing secret** that looks like:
```
whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Copy it. You will paste this into Vercel in Step 3.

---

## Step 3 — Add environment variables in Vercel

Go to **https://vercel.com/your-team/launchlense/settings/environment-variables** and add the following. Set them for **Production** (and optionally Preview).

| Variable | Value | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` | From https://dashboard.stripe.com/apikeys — use the **Secret key**, not the Publishable key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | From Step 2 above |
| `NEXT_PUBLIC_STRIPE_PAYMENT_GATE` | `true` | Enables the Budget node + payment flow on the canvas |

> **Test mode first:** Use `sk_test_...` and a test webhook endpoint while developing. Stripe has a separate test-mode webhook you can create at https://dashboard.stripe.com/test/webhooks.

---

## Step 4 — Add the remaining required env vars (full list)

Add these to Vercel if not already present:

```bash
# Supabase (required for everything)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...          # safe to expose — RLS protects data
SUPABASE_SERVICE_ROLE_KEY=eyJ...              # server-only, never put in NEXT_PUBLIC_

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_STATE_SECRET=<random 32-char string>   # openssl rand -hex 32

# PostHog analytics
NEXT_PUBLIC_POSTHOG_KEY=phc_...
POSTHOG_API_KEY=phc_...          # same as NEXT_PUBLIC_POSTHOG_KEY is fine

# Groq (Genome + AngleAgent + VideoBriefAgent)
GROQ_API_KEY=gsk_...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PAYMENT_GATE=true

# App URL (used in OAuth redirects + Stripe success/cancel URLs)
NEXT_PUBLIC_APP_URL=https://launch-lense.vercel.app
```

---

## Step 5 — Redeploy

After adding env vars, Vercel does **not** automatically redeploy. Trigger a new deployment:

```bash
# Option A — push a trivial commit
git commit --allow-empty -m "chore: trigger redeploy for env vars" && git push

# Option B — use Vercel dashboard
# Go to Deployments → click the three dots on the latest deploy → Redeploy
```

---

## Step 6 — Verify the webhook is firing

1. In Stripe Dashboard → Webhooks → click your endpoint
2. You will see a **"Send test webhook"** button — send `checkout.session.completed`
3. The response should show `200 {"received":true}`
4. Check Vercel **Function Logs** at https://vercel.com/your-team/launchlense/logs for the log line: `[stripe webhook] signature failed` (good — means the test event has a fake signature) OR `[stripe webhook] sprint_payments update` if a real event fires

> **Important:** The test event Stripe sends will fail signature verification (it uses a fake body) — that is expected. Real payments from the Stripe-hosted checkout page will verify correctly because Stripe signs them with your `STRIPE_WEBHOOK_SECRET`.

---

## Step 7 — Test the full payment flow end-to-end

1. Run a sprint through to `HEALTHGATE_DONE`
2. Open the **Budget & pay** panel (click the Budget node or auto-opens after healthgate)
3. Set budgets and click **"Proceed to Stripe Checkout"**
4. Use Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC
5. After payment, Stripe redirects back to `/canvas/<sprint_id>?payment=success`
6. Within 1–3 seconds, the webhook fires and `dispatchAngles` runs server-side
7. The canvas updates via Supabase Realtime — **AngleNode transitions to "running" without a page refresh**

---

## How the webhook enforces the payment gate

```
User pays → Stripe sends checkout.session.completed to /api/webhooks/stripe
  → Verifies signature (rejects if invalid)
  → Checks stripe_processed_events (idempotent — safe to retry)
  → Updates sprint_payments.status = 'completed'
  → Calls dispatchAngles(sprintId)   ← THE ONLY PATH to angles
  → dispatchAngles checks hasCompletedPayment() before running
  → Supabase Realtime pushes sprint row UPDATE to the canvas
  → Canvas normalises new state and re-renders nodes
```

The frontend **cannot bypass this**. Even if a user manually hits `POST /api/sprint/:id/angles`, the route checks `hasCompletedPayment()` server-side and returns `402 Payment Required` when the gate is enabled.

---

## Permissions summary (what the webhook endpoint needs)

| Permission | Why |
|---|---|
| Raw request body (`request.text()`) | Stripe signature verification requires the exact raw bytes |
| `STRIPE_WEBHOOK_SECRET` | To call `stripe.webhooks.constructEvent()` |
| `SUPABASE_SERVICE_ROLE_KEY` | To update `sprint_payments` and `sprints` tables (bypasses RLS) |
| `GROQ_API_KEY` | `dispatchAngles` calls AngleAgent which calls Groq |
| Network egress to Supabase + Groq | Standard Vercel serverless — no extra configuration needed |

The webhook route does **not** need:
- Stripe publishable key
- User session / auth token
- Any client-side environment variable
