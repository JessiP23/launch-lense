// Zustand store for LaunchLense global state
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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

  // Command palette (transient — not persisted)
  cmdkOpen: boolean;
  setCmdkOpen: (v: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: 'launchlense-store',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            }
      ),
      // Only persist account-related state, not transient UI state
      partialize: (state) => ({
        orgId: state.orgId,
        activeAccountId: state.activeAccountId,
        healthSnapshot: state.healthSnapshot,
        canLaunch: state.canLaunch,
      }),
    }
  )
);
