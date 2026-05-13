// LaunchLense — Zod validation schemas
// All external API inputs are validated here before touching the DB or agents.

import { z } from 'zod';

// ── Shared primitives ─────────────────────────────────────────────────────

export const PlatformSchema = z.enum(['meta', 'google', 'linkedin', 'tiktok']);

export const SprintIdSchema = z.string().uuid('Invalid sprint ID');

export const BudgetCentsSchema = z
  .number()
  .int()
  .min(5000, 'Minimum budget is $50')
  .max(1_000_000_00, 'Maximum budget is $1,000,000');  // 1M dollars in cents

// ── Sprint ────────────────────────────────────────────────────────────────

export const SprintCreateSchema = z.object({
  idea: z
    .string()
    .min(5, 'Idea must be at least 5 characters')
    .max(500, 'Idea must be under 500 characters')
    .trim(),
  channels: z.array(PlatformSchema).min(1).max(4).optional(),
  budget_cents: BudgetCentsSchema.optional().default(50000),
  org_id: z.string().uuid().optional(),
});

export const SprintPatchSchema = z
  .object({
    angles: z.record(z.string(), z.unknown()).optional(),
    landing: z.record(z.string(), z.unknown()).optional(),
    integrations: z
      .object({
        google_sheet_id: z.string().optional().nullable(),
        google_sheet_url: z.url().optional().nullable(),
        google_sheet_name: z.string().max(200).optional().nullable(),
        google_connected_email: z.email().optional().nullable(),
        sheets_connected: z.boolean().optional(),
        gmail_connected: z.boolean().optional(),
        slack_connected: z.boolean().optional(),
        slack_channel: z.string().max(100).optional().nullable(),
        canvas_sheet: z.boolean().optional(),
        canvas_outreach: z.boolean().optional(),
        canvas_slack: z.boolean().optional(),
      })
      .optional(),
    post_sprint: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (d) => d.angles || d.landing || d.integrations || d.post_sprint,
    { message: 'At least one field must be provided' }
  );

// ── Sprint Run ────────────────────────────────────────────────────────────

export const SprintRunSchema = z.object({
  // Which stages to run; omit to run all applicable from current state
  stages: z
    .array(z.enum(['genome', 'healthgate', 'angles']))
    .optional(),
  // Channel account data for Healthgate (optional — runs mock if omitted)
  channel_data: z
    .record(PlatformSchema, z.record(z.string(), z.unknown()))
    .optional(),
});

// ── Healthgate ────────────────────────────────────────────────────────────

export const HealthgateRequestSchema = z.object({
  channel_data: z.record(PlatformSchema, z.record(z.string(), z.unknown())),
});

// ── Campaign ──────────────────────────────────────────────────────────────

export const CampaignStartSchema = z.object({
  campaign_ids: z
    .record(PlatformSchema, z.string().max(100))
    .optional(),
  budget_allocation: z
    .record(PlatformSchema, BudgetCentsSchema)
    .optional(),
});

// ── Outreach ──────────────────────────────────────────────────────────────

export const OutreachSendSchema = z.object({
  contacts: z
    .array(
      z.object({
        email: z.email(),
        firstName: z.string().max(100).optional().nullable(),
        company: z.string().max(200).optional().nullable(),
        role: z.string().max(200).optional().nullable(),
      })
    )
    .min(1)
    .max(2000, 'Maximum 2,000 contacts per send'),
  dry_run: z.boolean().optional().default(false),
  subject_override: z.string().max(200).optional(),
});

// ── LP Deploy ─────────────────────────────────────────────────────────────

export const LpDeploySchema = z.object({
  test_id: z.string().uuid().optional(),
  sprint_id: z.string().uuid().optional(),
  html: z.string().max(500_000, 'LP HTML must be under 500KB').optional(),
  gjsData: z.record(z.string(), z.unknown()).optional(),
}).refine(
  (d) => d.test_id || d.sprint_id,
  { message: 'test_id or sprint_id is required' }
);

// ── LP Track ─────────────────────────────────────────────────────────────

export const LpTrackSchema = z.object({
  test_id: z.string().uuid().optional(),
  sprint_id: z.string().uuid().optional(),
  event: z.enum([
    'page_view',
    'cta_click',
    'scroll_depth',
    'form_submit',
    'email_capture',
  ]),
  /** Browser-generated UUID shared with the in-page pixel for CAPI deduplication. */
  event_id: z.string().min(8).max(64).optional(),
  angle_id: z.enum(['angle_A', 'angle_B', 'angle_C']).optional(),
  channel: PlatformSchema.optional(),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
  utm_content: z.string().max(100).optional(),
  /** Meta click ID — never sent client-side beyond the LP. */
  fbclid: z.string().max(500).optional().nullable(),
  fbc: z.string().max(500).optional().nullable(),
  fbp: z.string().max(500).optional().nullable(),
  page_url: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  ts: z.number().int().positive().optional(),
}).refine(
  (d) => d.test_id || d.sprint_id,
  { message: 'test_id or sprint_id is required' }
);

// ── BYOK Account ─────────────────────────────────────────────────────────

export const ByokAccountSchema = z.object({
  access_token: z.string().min(10, 'Token too short').max(500),
  account_id: z
    .string()
    .regex(/^\d+$/, 'Account ID must be numeric')
    .transform((v) => v.replace(/^act_/, '')),
  platform: PlatformSchema.optional().default('meta'),
  org_id: z.string().uuid().optional(),
});

// ── Angle Generate ────────────────────────────────────────────────────────

export const AngleGenerateSchema = z.object({
  sprint_id: z.string().uuid().optional(),
  idea: z.string().min(5).max(500).trim().optional(),
  icp: z.string().max(300).optional(),
  channels: z.array(PlatformSchema).min(1).max(4).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────

/** Parse with Zod and return a 400 Response on failure. */
export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { data: z.output<T>; error: null } | { data: null; error: Response } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const messages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    return {
      data: null,
      error: Response.json(
        { error: 'Validation failed', issues: messages },
        { status: 400 }
      ),
    };
  }
  return { data: result.data as z.output<T>, error: null };
}
