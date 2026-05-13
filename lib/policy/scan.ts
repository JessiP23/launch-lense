// ─────────────────────────────────────────────────────────────────────────────
// LaunchLense — Meta Advertising Policy pre-flight scanner
//
// Catches the most common Meta rejections BEFORE we burn API quota uploading
// images and creating ads. Mirrors the public Meta Advertising Standards
// categories. Not a substitute for Meta's own review — it's the cheap, fast
// gate that produces *actionable* errors instead of generic "rejected".
//
// Severity levels:
//   clean — no issues, deploy allowed.
//   warn  — ad will likely run but at higher rejection risk; deploy allowed.
//   block — confident violation; deploy must be blocked until edited.
//
// Adding a rule: append a Rule object to RULES. Each rule receives the
// editable creative fields and returns zero or more PolicyIssue records.
//
// Rule philosophy:
//   - Specific over generic. "We cannot say 'guaranteed weight loss' here"
//     is better than "Health claim issue".
//   - Match on whole words where possible to avoid false positives.
//   - Severity 'block' only when Meta would categorically reject — never use
//     it as a "we don't like this phrasing" lint.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  PolicyIssue,
  PolicySeverity,
  SprintCreativeEditable,
} from '@/lib/agents/types';

export interface PolicyScanInput extends Partial<SprintCreativeEditable> {
  /** Optional — included only to influence platform-specific rules. */
  platform?: 'meta' | 'google' | 'linkedin' | 'tiktok';
}

export interface PolicyScanResult {
  severity: PolicySeverity;
  issues: PolicyIssue[];
  /** Set to true iff at least one issue has severity 'block'. */
  blocked: boolean;
  scanned_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const FIELDS = ['headline', 'primary_text', 'description', 'cta'] as const;
type ScannableField = (typeof FIELDS)[number];

function eachField(input: PolicyScanInput): Array<[ScannableField, string]> {
  return FIELDS
    .map((f) => [f, (input[f] ?? '').toString()] as [ScannableField, string])
    .filter(([, v]) => v.length > 0);
}

/** Match a /regex/i against any of the scannable text fields. */
function matchField(
  input: PolicyScanInput,
  pattern: RegExp
): { field: ScannableField; match: string } | null {
  for (const [field, value] of eachField(input)) {
    const m = value.match(pattern);
    if (m) return { field, match: m[0] };
  }
  return null;
}

function combinedText(input: PolicyScanInput): string {
  return eachField(input).map(([, v]) => v).join(' \u2022 ');
}

// ── Rules ──────────────────────────────────────────────────────────────────

interface Rule {
  code: string;
  run(input: PolicyScanInput): PolicyIssue[];
}

const RULES: Rule[] = [
  // ─── Health claims ────────────────────────────────────────────────────
  {
    code: 'health.guaranteed_weight_loss',
    run(input) {
      // Numbered "lose X pounds" promises are auto-flagged.
      const m = matchField(
        input,
        /\b(lose|drop|shed)\s+\d{1,3}\s*(lbs?|pounds|kgs?|kilos)\b/i
      );
      if (!m) return [];
      return [
        {
          code: 'health.guaranteed_weight_loss',
          severity: 'block',
          message: `Meta will reject quantified weight-loss claims like "${m.match}". Reframe as a benefit (e.g. "Build a sustainable routine") rather than a guaranteed outcome.`,
          field: m.field,
          match: m.match,
        },
      ];
    },
  },
  {
    code: 'health.miracle_cure',
    run(input) {
      const m = matchField(
        input,
        /\b(miracle|guaranteed|instant|overnight|cure)\s+(cure|results|fix|relief)\b/i
      );
      if (!m) return [];
      return [
        {
          code: 'health.miracle_cure',
          severity: 'block',
          message: `"${m.match}" is treated as an unsubstantiated health/medical claim. Replace with evidence-backed language (e.g. "supported by clinical research").`,
          field: m.field,
          match: m.match,
        },
      ];
    },
  },

  // ─── Personal attributes ──────────────────────────────────────────────
  {
    code: 'personal.you_assertion',
    run(input) {
      // Meta's #1 reason for ad rejection: implying personal attributes
      // about the viewer. "Are you depressed?" / "Single moms in <city>".
      const patterns: Array<{ rx: RegExp; about: string }> = [
        { rx: /\bare you\s+(depressed|anxious|overweight|fat|broke|poor|lonely)\b/i, about: 'mental/financial state' },
        { rx: /\bsingle (mom|moms|dad|dads|parent|parents)\b/i, about: 'family status' },
        { rx: /\bgay|lesbian|trans(gender)?|bisexual\b/i, about: 'sexual orientation' },
        { rx: /\bdiabetic|cancer patient|hiv\+?\b/i, about: 'medical condition' },
      ];
      const issues: PolicyIssue[] = [];
      for (const { rx, about } of patterns) {
        const m = matchField(input, rx);
        if (!m) continue;
        issues.push({
          code: 'personal.you_assertion',
          severity: 'block',
          message: `Meta prohibits ads that imply or assert personal attributes about the viewer (here: ${about}). Rephrase as a third-person value prop: "A new way to…" rather than "Are you…".`,
          field: m.field,
          match: m.match,
        });
      }
      return issues;
    },
  },

  // ─── Unrealistic income / wealth ──────────────────────────────────────
  {
    code: 'income.unrealistic',
    run(input) {
      const m = matchField(
        input,
        /\b(make|earn)\s+\$?\d{2,7}[k]?\s*(\/?\s*(day|week|hour|hr))\b/i
      );
      if (!m) return [];
      return [
        {
          code: 'income.unrealistic',
          severity: 'block',
          message: `Quantified income promises like "${m.match}" violate Meta's standards on unrealistic earnings. Reframe as a market-size statement or testimonial without a guarantee.`,
          field: m.field,
          match: m.match,
        },
      ];
    },
  },
  {
    code: 'income.get_rich_quick',
    run(input) {
      const m = matchField(input, /\b(get rich quick|passive income guaranteed|financial freedom in \d+\s*days?)\b/i);
      if (!m) return [];
      return [
        {
          code: 'income.get_rich_quick',
          severity: 'block',
          message: `"${m.match}" pattern-matches a get-rich-quick scheme. Show the mechanism ("Generate qualified leads on autopilot") instead of the outcome guarantee.`,
          field: m.field,
          match: m.match,
        },
      ];
    },
  },

  // ─── Punctuation / formatting spam ────────────────────────────────────
  {
    code: 'spam.excessive_punctuation',
    run(input) {
      const m = matchField(input, /[!?]{3,}|\.{4,}/);
      if (!m) return [];
      return [
        {
          code: 'spam.excessive_punctuation',
          severity: 'warn',
          message: `Excessive punctuation ("${m.match}") raises low-quality ad scores. Trim to a single exclamation or question mark.`,
          field: m.field,
          match: m.match,
        },
      ];
    },
  },
  {
    code: 'spam.all_caps_run',
    run(input) {
      // Three or more consecutive ALL-CAPS words (≥ 3 chars each) gets flagged.
      const m = matchField(input, /\b[A-Z]{3,}\b(?:\s+\b[A-Z]{3,}\b){2,}/);
      if (!m) return [];
      return [
        {
          code: 'spam.all_caps_run',
          severity: 'warn',
          message: `Long ALL-CAPS runs ("${m.match}") trigger Meta's low-quality classifier. Use Title Case or single-word emphasis instead.`,
          field: m.field,
          match: m.match,
        },
      ];
    },
  },

  // ─── Restricted categories ────────────────────────────────────────────
  {
    code: 'restricted.weapons',
    run(input) {
      const m = matchField(input, /\b(gun|rifle|firearm|ammo|ammunition|silencer|suppressor)\b/i);
      if (!m) return [];
      return [
        {
          code: 'restricted.weapons',
          severity: 'block',
          message: `Weapons-related terms ("${m.match}") require special advertiser certification we have not obtained. Remove or rephrase.`,
          field: m.field,
          match: m.match,
        },
      ];
    },
  },
  {
    code: 'restricted.crypto',
    run(input) {
      const m = matchField(
        input,
        /\b(crypto trading|altcoin|airdrop|defi yield|10x your portfolio|pump|presale)\b/i
      );
      if (!m) return [];
      return [
        {
          code: 'restricted.crypto',
          severity: 'block',
          message: `Cryptocurrency promotion ("${m.match}") requires Meta's Financial Products & Services advertiser approval. We do not currently hold this.`,
          field: m.field,
          match: m.match,
        },
      ];
    },
  },
  {
    code: 'restricted.adult',
    run(input) {
      const m = matchField(input, /\b(adult dating|porn|nude|nsfw|escort)\b/i);
      if (!m) return [];
      return [
        {
          code: 'restricted.adult',
          severity: 'block',
          message: `Adult content terms ("${m.match}") are prohibited on Meta. Remove from copy.`,
          field: m.field,
          match: m.match,
        },
      ];
    },
  },

  // ─── Required fields ──────────────────────────────────────────────────
  {
    code: 'required.headline_missing',
    run(input) {
      if (input.platform && input.platform !== 'meta') return [];
      const v = (input.headline ?? '').trim();
      if (v.length > 0) return [];
      return [
        {
          code: 'required.headline_missing',
          severity: 'block',
          message: 'Headline is required for Meta ads. Aim for 25–40 characters.',
          field: 'headline',
        },
      ];
    },
  },
  {
    code: 'required.primary_text_missing',
    run(input) {
      if (input.platform && input.platform !== 'meta') return [];
      const v = (input.primary_text ?? '').trim();
      if (v.length > 0) return [];
      return [
        {
          code: 'required.primary_text_missing',
          severity: 'block',
          message: 'Primary text is required for Meta ads. Aim for 90–125 characters.',
          field: 'primary_text',
        },
      ];
    },
  },
  {
    code: 'required.cta_missing',
    run(input) {
      const v = (input.cta ?? '').trim();
      if (v.length > 0) return [];
      return [
        {
          code: 'required.cta_missing',
          severity: 'block',
          message: 'CTA is required. Choose one of LEARN_MORE, SIGN_UP, SHOP_NOW, GET_OFFER, SUBSCRIBE.',
          field: 'cta',
        },
      ];
    },
  },
  {
    code: 'required.image_or_video',
    run(input) {
      const hasImage = !!(input.image_url ?? '').trim();
      const hasVideo = !!(input.video_url ?? '').trim();
      if (hasImage || hasVideo) return [];
      return [
        {
          code: 'required.image_or_video',
          severity: 'block',
          message: 'An image or video asset is required before deployment.',
          field: 'image_url',
        },
      ];
    },
  },

  // ─── Length warnings (Meta truncates aggressively) ────────────────────
  {
    code: 'length.headline_too_long',
    run(input) {
      const v = (input.headline ?? '').trim();
      if (v.length <= 40) return [];
      return [
        {
          code: 'length.headline_too_long',
          severity: 'warn',
          message: `Headline is ${v.length} chars; Meta truncates above 40. Tighten to keep the punchline visible on Feed.`,
          field: 'headline',
        },
      ];
    },
  },
  {
    code: 'length.primary_text_too_long',
    run(input) {
      const v = (input.primary_text ?? '').trim();
      if (v.length <= 125) return [];
      return [
        {
          code: 'length.primary_text_too_long',
          severity: 'warn',
          message: `Primary text is ${v.length} chars; Feed shows ~125 before "See more". Lead with the value prop in the first 100 chars.`,
          field: 'primary_text',
        },
      ];
    },
  },
];

// ── Entrypoint ─────────────────────────────────────────────────────────────

export function scanCreative(input: PolicyScanInput): PolicyScanResult {
  // Sanity: skip empty payloads — they get caught by required.* rules.
  if (!input || combinedText(input).length === 0 && !input.image_url && !input.video_url) {
    return {
      severity: 'block',
      issues: [
        {
          code: 'required.empty',
          severity: 'block',
          message: 'Creative has no copy or asset. Fill in headline, primary text, and CTA before scanning.',
        },
      ],
      blocked: true,
      scanned_at: new Date().toISOString(),
    };
  }

  const issues: PolicyIssue[] = [];
  for (const rule of RULES) {
    try {
      issues.push(...rule.run(input));
    } catch (err) {
      // A buggy rule should never crash the scan — log and continue.
      console.warn(`[policy.scan] rule "${rule.code}" threw:`, err);
    }
  }

  const severity: PolicySeverity =
    issues.some((i) => i.severity === 'block')
      ? 'block'
      : issues.some((i) => i.severity === 'warn')
        ? 'warn'
        : 'clean';

  return {
    severity,
    issues,
    blocked: severity === 'block',
    scanned_at: new Date().toISOString(),
  };
}
