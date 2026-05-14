'use client';

import type { ReactNode } from 'react';

const C = {
  ink: '#111110',
  muted: '#8C8880',
  border: '#E8E4DC',
  surface: '#FFFFFF',
  faint: '#F3F0EB',
};

interface PanelShellProps {
  /** Display title (e.g. "Campaign · meta"). */
  title: string;
  /** Optional eyebrow / category text shown above the title. */
  eyebrow?: string;
  /** Right-side header slot — status pill, live pulse, channel badge. */
  headerRight?: ReactNode;
  /** Short subtitle directly under the title. */
  subtitle?: ReactNode;
  /** Sticky bottom action bar (Run / Continue / Pay). */
  footer?: ReactNode;
  /** When true, wraps the body in a fixed-height scroll region. */
  scrollableBody?: boolean;
  children: ReactNode;
}

/**
 * Canonical chrome for canvas detail panels. Replaces the ad-hoc per-panel
 * headers in node-panel.tsx so every panel (CampaignPanel, AnglesPanel, …)
 * gets identical spacing, dividers, and footer alignment.
 *
 * Visual-only — never gates content. Existing panels can adopt this
 * incrementally without touching their state hooks.
 */
export function PanelShell({
  title,
  eyebrow,
  headerRight,
  subtitle,
  footer,
  scrollableBody = false,
  children,
}: PanelShellProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        height: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          paddingBottom: 14,
          borderBottom: `1px solid ${C.border}`,
          marginBottom: 16,
        }}
      >
        <div style={{ minWidth: 0 }}>
          {eyebrow ? (
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: C.muted,
                marginBottom: 4,
              }}
            >
              {eyebrow}
            </div>
          ) : null}
          <h2
            style={{
              margin: 0,
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: '-0.02em',
              color: C.ink,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </h2>
          {subtitle ? (
            <div
              style={{
                marginTop: 4,
                fontSize: 12.5,
                lineHeight: 1.55,
                color: C.muted,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        {headerRight ? <div style={{ flexShrink: 0 }}>{headerRight}</div> : null}
      </div>

      {/* Body */}
      <div
        style={
          scrollableBody
            ? { flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2 }
            : undefined
        }
      >
        {children}
      </div>

      {/* Footer */}
      {footer ? (
        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export const PANEL_TOKENS = C;
