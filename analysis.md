# LaunchLense Product and Engineering Analysis

## Executive Summary

LaunchLense is evolving from a Meta-focused validation tool into an agentic launch validation canvas. The current product combines market research, account readiness checks, creative generation, landing page preparation, campaign simulation or launch, verdict reporting, and post-sprint outreach in one workflow.

The strongest direction is the canvas-based workflow. It makes the product feel like an operating system for validating startup ideas rather than a form-based campaign builder. The main product risk is complexity: the user experience must keep the workflow visually clear, explain what each agent is doing, and avoid exposing implementation friction like OAuth setup, blocked states, or raw CSV semantics without strong guidance.

## Product Positioning

LaunchLense promises faster startup validation by replacing slow MVP cycles with fast demand tests. The product is strongest when positioned as:

- A validation sprint system for founders, venture studios, and growth operators.
- A risk reducer before spending real ad budget.
- A single place to generate evidence, creative, landing pages, verdicts, and follow-up outreach.

The canvas supports this positioning well because it visually communicates an agentic pipeline:

1. Accounts
2. Genome
3. Healthgate
4. Angles
5. Creative
6. Landing
7. Campaign
8. Verdict
9. Report
10. Spreadsheet
11. Outreach
12. Slack

This sequence is understandable and demo-friendly. The key product requirement is to keep every node informative enough to prove work is happening, without overwhelming the user.

## Current UI Analysis

### Canvas

The canvas is the primary workspace. It uses React Flow with custom nodes and custom pipeline edges. The node-based interface is appropriate because the product is inherently sequential and agent-driven.

Current strengths:

- The workflow is visually understandable.
- Node statuses communicate queued, running, done, blocked, and review states.
- Success and failure badges on nodes create a clear sense of progress.
- Dynamic channel lanes allow Meta, Google, LinkedIn, and TikTok to appear only when active.
- The panel-on-node-click interaction keeps detail views close to the workflow.

Current weaknesses:

- Horizontal and vertical spacing need careful tuning because too much compression makes the workflow feel crowded, while too much spacing makes the pipeline feel disconnected.
- Utility nodes such as Benchmarks and Settings should stay secondary and not compete visually with the main workflow.
- The canvas should avoid visible implementation artifacts such as connector handle dots.
- Panel transitions should stay simple. When switching nodes, the panel should update content without replaying a vertical or remount animation.

Recommended UI direction:

- Keep the main workflow horizontally separated enough to read each stage.
- Keep channel-specific lanes vertically compact but not overlapping.
- Preserve simple line connectors without arrowheads, moving dots, or visible handles.
- Treat the side panel as a persistent inspector rather than a modal that re-enters on every click.

### Nodes

The nodes are the product's strongest visual metaphor. Each node should answer three questions:

- What agent or stage is this?
- What is its status?
- What useful output did it produce?

Recommended node-specific expectations:

- Accounts: connected platform count and readiness.
- Genome: composite score, signal, live research sources, observed signals, and run log.
- Healthgate: per-channel score, pass/warn/block state, top blocking issues.
- Angles: selected angle count, archetypes, emotional levers.
- Creative: channel-specific copy and lightweight visual preview.
- Landing: page mode, headline, CTA, deployment status.
- Campaign: spend, CTR, monitoring or launch status.
- Verdict: GO, ITERATE, or NO-GO with confidence.
- Report: readiness and report access.
- Spreadsheet: contact count, source, processing summary, and sent email preview after outreach.
- Outreach: sent count, failures, first failure reason, Gmail sender.
- Slack: posted state and target channel.

### Side Panel

The side panel is the detail inspector for each node. Its role is to provide detailed control and logs without forcing the canvas itself to become dense.

Current strengths:

- It supports rich node-specific configuration.
- Spreadsheet and Outreach panels now support contact review, email editing, preview, and sending.
- Genome logs and source visibility make the agent feel more transparent.

Current risks:

- The panel is large and contains many inline styles, which makes long-term maintenance harder.
- The Spreadsheet panel is feature-rich and could become heavy if it renders many contacts or full HTML previews at large scale.
- Repeated panel remounts or animation changes can make the canvas feel laggy.

Recommended direction:

- Keep the panel mounted while switching node content.
- Prefer lightweight text previews for persisted sent emails.
- Use virtualization if contact lists grow beyond a few hundred rows.
- Extract repeated panel UI primitives only when they reduce real duplication.

## Feature Analysis

### GenomeAgent

Purpose:

- Quickly evaluates the startup idea using live or estimated market signals.
- Produces a signal, composite score, market category, ICP, problem statement, wedge, risks, and sources.

Strengths:

- Gives the workflow a strong first step.
- Makes the product feel research-driven instead of just campaign-driven.
- Live search sources and logs improve trust.

Risk:

- If Genome returns STOP too early, users may feel the workflow is broken. This is especially risky in demos.

Recommendation:

- Keep STOP visible as a serious signal, but allow explicit user override for demo and founder judgment.
- Explain the reason for STOP directly inside the Genome node and panel.

### Healthgate

Purpose:

- Checks whether ad channels are ready before spending money.
- Prevents bad account state from creating misleading validation results.

Strengths:

- Strong product differentiation.
- Makes LaunchLense feel safer and more professional.
- Multi-channel health checks align with the long-term roadmap.

Risk:

- Mock or demo health data must be clearly separated from real account data.

Recommendation:

- Show whether checks are live, mocked, or estimated.
- Keep per-channel blocking issues visible.

### Angle and Creative Generation

Purpose:

- Converts the validated idea into testable messaging.
- Produces channel-specific creative previews.

Strengths:

- Gives the workflow visible output quickly.
- Supports multiple channels and formats.
- Makes demos feel tangible.

Risk:

- Large inline creative images can overload persistence and APIs.

Recommendation:

- Continue storing only lightweight creative state.
- Move large assets to object storage if persistent creative images are needed.

### Landing Page

Purpose:

- Generates or edits a destination page for validation traffic.

Strengths:

- Supports builder and code modes.
- Connects campaign validation to a real destination.

Risk:

- Landing page generation and deployment can become a large feature surface.

Recommendation:

- Keep the canvas node focused on status and preview.
- Keep advanced editing in the panel or a dedicated editor route.

### Campaign and Verdict

Purpose:

- Launches or simulates campaign activity.
- Produces a final validation verdict and report.

Strengths:

- Closes the core validation loop.
- Verdict and report make the product outcome concrete.

Risk:

- Real ad platform API constraints and app review status can block a fully live experience.

Recommendation:

- Make live vs demo campaign state explicit.
- Keep verdict reasoning grounded in campaign metrics, not generic LLM output.

### SpreadsheetAgent

Purpose:

- Prepares post-sprint contacts from CSV or Google Sheets.
- Normalizes contact rows and enables outreach review.

Strengths:

- Extends LaunchLense beyond validation into activation.
- Google Sheets integration maps well to real founder workflows.
- Contact review and editing reduces risk before sending.

Risk:

- Users may not understand expected columns unless the UI explains them clearly.
- Large contact lists can create rendering and session storage pressure.

Recommendation:

- Keep the current CSV explanation.
- Continue supporting live Google Sheets pulls.
- Add pagination or virtualization for large contact lists.
- Keep the sent email preview lightweight inside the Spreadsheet node.

### OutreachAgent

Purpose:

- Sends personalized Gmail outreach after contacts are prepared.

Strengths:

- Provides a clear activation step after the validation sprint.
- Uses the connected Gmail sender for authenticity.
- Per-contact send logs and failure reasons improve trust.

Risk:

- Gmail API failures can be opaque unless surfaced directly.
- Sending limits and OAuth verification can affect production reliability.

Recommendation:

- Keep first failure reason visible.
- Keep server-side rate limiting.
- Consider dry-run mode for previews and production-safe demos.

### SlackAgent

Purpose:

- Posts a summary to a chosen Slack channel.

Strengths:

- Good team workflow feature.
- Useful for studios and agencies that validate many ideas.

Risk:

- Needs clean Slack OAuth or bot-token setup before it feels production-ready.

Recommendation:

- Show whether Slack is truly connected or manually marked ready.

## Infrastructure Analysis

### Application Framework

The app uses Next.js App Router with React 19 and TypeScript. This is a strong fit for the product because the UI is interactive and the backend is mostly API-route driven.

Important constraint:

- This project uses Next.js 16. Before changing route behavior, dynamic route handling, or framework APIs, consult the local Next.js docs in `node_modules/next/dist/docs`.

### Data Layer

Supabase stores sprint state, events, integrations, and agent outputs. The sprint record acts as the workflow state machine source of truth.

Strengths:

- JSON fields allow fast iteration on agent outputs.
- `sprint_events` provides auditability and agent logs.
- Server routes can update state incrementally.

Risks:

- Large JSON payloads can cause API or database failures.
- Too much state in one sprint record can become difficult to manage.

Recommendations:

- Keep large assets out of sprint JSON.
- Continue using event rows for logs.
- Consider separate tables for large outreach batches if scale increases.

### API Layer

The product uses Next.js API routes for sprint orchestration and integrations.

Important routes:

- `POST /api/sprint` creates a sprint.
- `GET /api/sprint` lists sprints.
- `GET /api/sprint/[sprint_id]` loads sprint detail.
- `POST /api/sprint/[sprint_id]/genome` runs GenomeAgent.
- `POST /api/sprint/[sprint_id]/healthgate` runs Healthgate.
- `POST /api/sprint/[sprint_id]/angles` runs AngleAgent.
- `POST /api/sprint/[sprint_id]/post-sprint/prepare-sheet` runs SpreadsheetAgent.
- `POST /api/sprint/[sprint_id]/post-sprint/send-outreach` runs OutreachAgent.

Recommendations:

- Keep every API error JSON-shaped so the client never fails on empty responses.
- Persist enough failure context for users to understand what happened.
- Avoid silently simulating real sends unless the UI marks simulation mode clearly.

### OAuth and External APIs

Integrations include Google OAuth, Gmail API, Google Sheets API, Meta APIs, Serper or live search signals, and Slack.

Strengths:

- User-scoped Google connection creates a practical real-world workflow.
- Gmail sending and Sheets reading are high-value post-sprint features.

Risks:

- Google verification and sensitive scopes can block production access.
- OAuth token scope is currently org/sprint oriented, not necessarily per-user.
- Meta app review can block production campaign creation.

Recommendations:

- Finish Google OAuth publishing and test-user setup.
- Decide whether Gmail tokens are org-scoped or user-scoped.
- Keep setup state visible in the UI, not hidden in documentation.

## Performance Analysis

Primary performance risks:

- Large contact lists rendered as full DOM.
- Large HTML email previews rendered repeatedly.
- Large base64 creative images persisted or sent through PATCH.
- Frequent React Flow node updates from measured dimensions.
- Panel remount animations when clicking between nodes.

Current mitigations:

- Oversized inline creative images are stripped before persistence.
- Panel switching is simpler and avoids unnecessary entry animation.
- Sent email preview uses lightweight stored text.
- Node layout merges avoid unnecessary updates.

Recommended next improvements:

- Virtualize contact rows when count exceeds 100.
- Memoize expensive preview computations.
- Move repeated inline styles into shared primitives only where it reduces code.
- Keep edge animations minimal.

## UX Priorities

Highest-priority UX improvements:

1. Make every node show the right output at the right time.
2. Keep layout readable across one, two, three, and four active channels.
3. Avoid visual artifacts such as connector handle circles.
4. Explain blocked states clearly and provide a deliberate continue/override path.
5. Keep Spreadsheet and Outreach safe, editable, and transparent.

## Risk Register

| Area | Risk | Impact | Recommended Mitigation |
| --- | --- | --- | --- |
| OAuth | Google app not verified | Users cannot connect Gmail/Sheets | Publish consent screen, configure test users, verify sensitive scopes |
| Campaigns | Meta app review incomplete | Real campaign launch blocked | Show live/demo state clearly |
| Data | Large JSON payloads | API/database failures | Store large assets externally |
| UI | Canvas overcrowding | Workflow becomes hard to read | Dynamic spacing by node size and channel count |
| Outreach | Gmail failures unclear | Users do not trust sends | Persist per-contact error reasons |
| Contacts | Large lists | Browser lag | Add pagination or virtualization |
| Product | Too many agent details | Users feel overwhelmed | Keep summaries in nodes, details in panels |

## Recommended Roadmap

### Immediate

- Keep connector handles hidden.
- Tune workflow spacing visually across different channel counts.
- Ensure new sprint creation always starts the visible workflow.
- Keep sent email preview visible in Spreadsheet after Outreach sends.

### Near Term

- Add contact list pagination or virtualization.
- Add clearer live/demo labels for external integrations.
- Add more explicit blocked-state recovery UX.
- Consolidate repeated panel UI patterns.

### Mid Term

- Move persistent creative assets to object storage.
- Add per-user Google token scoping if multi-user orgs are important.
- Add production Slack OAuth flow.
- Add better workflow run orchestration server-side so long-running steps do not depend on a single client session.

### Long Term

- Expand from Meta-first validation into full multi-channel validation.
- Add cross-channel budget recommendations.
- Add workspace-level reporting across multiple validation sprints.
- Add an AI analyst layer that can answer questions from campaign, landing, and outreach data.

## Final Assessment

LaunchLense has a strong product shape: an agentic validation canvas that turns a startup idea into research, channel readiness, creative, landing, campaign evidence, verdict, report, and outreach. The UI direction is compelling, but it must stay disciplined. The best version of the product is not a dense automation dashboard; it is a clean workflow where each agent produces visible evidence and the user always understands what happened, why it happened, and what to do next.
