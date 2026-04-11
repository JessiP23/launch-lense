// Zustand store for LaunchLense global state
import { create } from 'zustand';
import type { HealthSnapshot } from './healthgate';

interface AppState {
  // Current org
  orgId: string | null;
  setOrgId: (id: string) => void;

  // Active ad account
  activeAccountId: string | null;
  setActiveAccountId: (id: string | null) => void;

  // Healthgate
  healthSnapshot: HealthSnapshot | null;
  setHealthSnapshot: (s: HealthSnapshot | null) => void;
  canLaunch: boolean;

  // Command palette
  cmdkOpen: boolean;
  setCmdkOpen: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  orgId: null,
  setOrgId: (id) => set({ orgId: id }),

  activeAccountId: null,
  setActiveAccountId: (id) => set({ activeAccountId: id }),

  healthSnapshot: null,
  setHealthSnapshot: (s) =>
    set({ healthSnapshot: s, canLaunch: s ? s.status !== 'red' : false }),
  canLaunch: false,

  cmdkOpen: false,
  setCmdkOpen: (v) => set({ cmdkOpen: v }),
}));
