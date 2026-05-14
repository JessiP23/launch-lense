// ─────────────────────────────────────────────────────────────────────────────
// Meta call-to-action type resolver.
//
// Meta's Marketing API only accepts a fixed enum for `call_to_action.type`
// (LEARN_MORE, SIGN_UP, SHOP_NOW, …). Our copy agents generate free-form
// button labels like "GET INSTANT GTM STRATEGY", which Meta rejects with
// error code 100.
//
// This helper maps a free-form label to the closest valid Meta enum.
//   1. Direct match (uppercased + spaces→underscores).
//   2. Keyword heuristic for the handful of intents we care about.
//   3. Fallback to LEARN_MORE — the safest neutral default for B2B/SaaS
//      lead-gen, which is our entire current use case.
//
// Keeping the allowlist short on purpose: every entry here is a CTA we
// would actually want our agent to use. Anything outside this list folds
// down to LEARN_MORE rather than risk a Meta rejection mid-launch.
// ─────────────────────────────────────────────────────────────────────────────

// Meta's accepted enum (subset we care about). GET_STARTED is NOT in
// Meta's list — many copywriters use it, so we normalise to LEARN_MORE.
const META_VALID = new Set([
  'LEARN_MORE', 'SIGN_UP', 'SUBSCRIBE', 'APPLY_NOW', 'BOOK_NOW',
  'CONTACT_US', 'DOWNLOAD', 'GET_OFFER', 'GET_QUOTE', 'ORDER_NOW',
  'SHOP_NOW', 'BUY_NOW', 'INSTALL_APP', 'WATCH_MORE', 'SEE_MORE',
]);

export function resolveMetaCtaType(raw: string | null | undefined): string {
  if (!raw) return 'LEARN_MORE';
  const norm = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');

  // 1. Direct enum hit.
  if (META_VALID.has(norm)) return norm;
  // Common alias we accept but Meta does not.
  if (norm === 'GET_STARTED' || norm === 'START_NOW') return 'LEARN_MORE';

  // 2. Keyword heuristic. Ordered roughly from most specific to least.
  const low = raw.toLowerCase();
  if (/\bbuy\b|\bpurchase\b/.test(low)) return 'BUY_NOW';
  if (/\bshop\b|\bshop now\b/.test(low)) return 'SHOP_NOW';
  if (/\border\b/.test(low)) return 'ORDER_NOW';
  if (/\bbook\b|\bschedule\b|\breserve\b/.test(low)) return 'BOOK_NOW';
  if (/\bapply\b/.test(low)) return 'APPLY_NOW';
  if (/\bsign[\s-]?up\b|\bregister\b|\bjoin\b|\bcreate account\b/.test(low)) return 'SIGN_UP';
  if (/\bsubscribe\b/.test(low)) return 'SUBSCRIBE';
  if (/\bdownload\b/.test(low)) return 'DOWNLOAD';
  if (/\binstall\b/.test(low)) return 'INSTALL_APP';
  if (/\bquote\b/.test(low)) return 'GET_QUOTE';
  if (/\boffer\b|\bdeal\b|\bdiscount\b/.test(low)) return 'GET_OFFER';
  if (/\bcontact\b|\btalk to\b|\bget in touch\b/.test(low)) return 'CONTACT_US';
  if (/\bwatch\b/.test(low)) return 'WATCH_MORE';
  if (/\bsee\b/.test(low)) return 'SEE_MORE';

  // 3. Fallback.
  return 'LEARN_MORE';
}

// Human-friendly labels for each Meta enum we expose in the UI. Order is
// the order they appear in the dropdown — most-used first. Keep this in
// sync with META_VALID above; everything in this list MUST be a value
// Meta accepts.
export const META_CTA_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'LEARN_MORE',  label: 'Learn More' },
  { value: 'SIGN_UP',     label: 'Sign Up' },
  { value: 'SUBSCRIBE',   label: 'Subscribe' },
  { value: 'APPLY_NOW',   label: 'Apply Now' },
  { value: 'BOOK_NOW',    label: 'Book Now' },
  { value: 'CONTACT_US',  label: 'Contact Us' },
  { value: 'GET_QUOTE',   label: 'Get Quote' },
  { value: 'GET_OFFER',   label: 'Get Offer' },
  { value: 'DOWNLOAD',    label: 'Download' },
  { value: 'SHOP_NOW',    label: 'Shop Now' },
  { value: 'BUY_NOW',     label: 'Buy Now' },
  { value: 'ORDER_NOW',   label: 'Order Now' },
  { value: 'INSTALL_APP', label: 'Install App' },
  { value: 'WATCH_MORE',  label: 'Watch More' },
  { value: 'SEE_MORE',    label: 'See More' },
];

// Exposed for tests.
export const _META_VALID_CTAS = META_VALID;
