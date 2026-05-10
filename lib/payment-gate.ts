/**
 * When true, angles / downstream agents require a completed Stripe Checkout
 * (see sprint_payments.status = 'completed'). Toggle with env for staging.
 */
export function isStripePaymentGateEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_GATE;
  return v === '1' || v === 'true';
}
