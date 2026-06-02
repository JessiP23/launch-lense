'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Mail, Zap, BarChart3 } from 'lucide-react';

const C = { ink: '#111110', muted: '#8C8880', border: '#E8E4DC', surface: '#FFFFFF', faint: '#F3F0EB' };

interface Sprint { id: string; name: string; status: string; }

interface Props {
  sprints:       Sprint[];
  activeSprint:  string | null;
  onSelect:      (id: string | null) => void;
  onNew:         () => void;
  onOpenPanel:   (panel: string) => void;
}

export function CanvasToolbar({ sprints, activeSprint, onSelect, onNew, onOpenPanel }: Props) {
  const { setCmdkOpen } = useAppStore();
  const [open, setOpen] = useState(false);
  const [leadsCount, setLeadsCount] = useState(0);
  const active = sprints.find((s) => s.id === activeSprint);

  useEffect(() => {
    const fetchLeadsCount = async () => {
      try {
        const res = await fetch('/api/nurture/leads');
        const data = await res.json().catch(() => null);
        if (data?.total != null) {
          setLeadsCount(data.total);
        }
      } catch (err) {
        console.error('[CanvasToolbar] Failed to fetch leads count:', err);
      }
    };
    fetchLeadsCount();
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 10,
        height: 48,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        display: 'flex', alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', letterSpacing: '-0.02em', color: C.ink }}>
          LaunchLense
        </span>
      </div>

      <div style={{ width: 1, height: 20, background: C.border, flexShrink: 0 }} />

      {/* Sprint selector */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 30, padding: '0 10px',
            background: C.faint, border: `1px solid ${C.border}`,
            borderRadius: 8, cursor: 'pointer',
            fontSize: '0.8125rem', fontWeight: 500, color: C.ink,
          }}
        >
          <span style={{ color: C.muted, fontSize: '0.75rem' }}>Sprint</span>
          <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {active ? active.name : 'Select…'}
          </span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
            <path d="M2 3.5L5 6.5L8 3.5" stroke={C.muted} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {open && (
          <div
            style={{
              position: 'absolute', top: 36, left: 0,
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              minWidth: 220, overflow: 'hidden', zIndex: 50,
            }}
          >
            {sprints.length === 0 && (
              <p style={{ padding: '10px 14px', fontSize: '0.8125rem', color: C.muted }}>No sprints yet</p>
            )}
            {sprints.map((s) => (
              <button
                key={s.id}
                onClick={() => { onSelect(s.id); setOpen(false); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '9px 14px', fontSize: '0.8125rem',
                  color: s.id === activeSprint ? C.ink : C.ink,
                  background: s.id === activeSprint ? C.faint : 'transparent',
                  border: 'none', cursor: 'pointer',
                  fontWeight: s.id === activeSprint ? 600 : 400,
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ fontSize: '0.6875rem', color: C.muted, textTransform: 'capitalize' }}>{s.status}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New Sprint */}
      <button
        onClick={onNew}
        style={{
          height: 30, padding: '0 12px',
          background: C.ink, color: '#FFF',
          border: 'none', borderRadius: 8,
          fontSize: '0.8125rem', fontWeight: 600,
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        + New Sprint
      </button>

      <div style={{ flex: 1 }} />

      {[
        { label: 'Accounts', panel: 'accounts' },
        { label: 'Integrations', panel: 'integrations' },
        { label: 'External', panel: 'external' },
        { label: 'Benchmarks', panel: 'benchmarks' },
      ].map(({ label, panel }) => (
        <button
          key={label}
          onClick={() => onOpenPanel(panel)}
          style={{
            height: 30, padding: '0 10px',
            background: 'transparent', border: `1px solid ${C.border}`,
            borderRadius: 8, fontSize: '0.8125rem', color: C.muted,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {label}
        </button>
      ))}

      {/* Autopilot Indicator */}
      <button
        onClick={() => onOpenPanel('autopilot')}
        style={{
          height: 30, padding: '0 10px',
          background: 'transparent',
          border: `1px solid ${C.border}`,
          borderRadius: 8, fontSize: '0.8125rem', color: C.muted,
          cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <Zap style={{ width: 14, height: 14 }} />
        <span>Autopilot</span>
      </button>

      {/* Signal Fabric Indicator */}
      <button
        onClick={() => onOpenPanel('signal-fabric')}
        style={{
          height: 30, padding: '0 10px',
          background: 'transparent',
          border: `1px solid ${C.border}`,
          borderRadius: 8, fontSize: '0.8125rem', color: C.muted,
          cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <BarChart3 style={{ width: 14, height: 14 }} />
        <span>Signal Fabric</span>
      </button>

      {/* Leads Indicator */}
      <button
        onClick={() => onOpenPanel('leads')}
        style={{
          height: 30, padding: '0 10px',
          background: leadsCount > 0 ? `${C.ink}08` : 'transparent',
          border: `1px solid ${leadsCount > 0 ? C.ink : C.border}`,
          borderRadius: 8, fontSize: '0.8125rem', color: leadsCount > 0 ? C.ink : C.muted,
          cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <Mail style={{ width: 14, height: 14 }} />
        <span>Leads</span>
        {leadsCount > 0 && (
          <span style={{
            background: C.ink, color: '#FFF',
            borderRadius: 99, padding: '0 6px',
            fontSize: '0.6875rem', fontWeight: 700,
            minWidth: 18, textAlign: 'center',
          }}>
            {leadsCount}
          </span>
        )}
      </button>
    </div>
  );
}
