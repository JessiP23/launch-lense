// Zustand store for LaunchLense global state
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { HealthSnapshot } from './healthgate';

export type PlatformId = 'meta' | 'google' | 'tiktok' | 'linkedin';

export interface ConnectedPlatform {
  platform: PlatformId;
  accountId: string;       // internal DB id or platform-native id
  accountName: string;     // display name e.g. "My Business Account"
  connectedAt: string;     // ISO timestamp
}

interface AppState {
  // Current org
  orgId: string | null;
  setOrgId: (id: string) => void;

  // Active Meta ad account (legacy — kept for backward compat)
  activeAccountId: string | null;
  setActiveAccountId: (id: string | null) => void;

  // Per-platform connections (persisted)
  connectedPlatforms: ConnectedPlatform[];
  connectPlatform: (p: ConnectedPlatform) => void;
  disconnectPlatform: (platform: PlatformId) => void;
  getConnection: (platform: PlatformId) => ConnectedPlatform | null;

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
    (set, get) => ({
      orgId: null,
      setOrgId: (id) => set({ orgId: id }),

      activeAccountId: null,
      setActiveAccountId: (id) => set({ activeAccountId: id }),

      connectedPlatforms: [],
      connectPlatform: (p) =>
        set((state) => ({
          connectedPlatforms: [
            ...state.connectedPlatforms.filter((c) => c.platform !== p.platform),
            p,
          ],
          // Also update legacy activeAccountId when Meta is connected
          ...(p.platform === 'meta' ? { activeAccountId: p.accountId } : {}),
        })),
      disconnectPlatform: (platform) =>
        set((state) => ({
          connectedPlatforms: state.connectedPlatforms.filter((c) => c.platform !== platform),
          ...(platform === 'meta' ? { activeAccountId: null } : {}),
        })),
      getConnection: (platform) =>
        get().connectedPlatforms.find((c) => c.platform === platform) ?? null,

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
      partialize: (state) => ({
        orgId: state.orgId,
        activeAccountId: state.activeAccountId,
        connectedPlatforms: state.connectedPlatforms,
        healthSnapshot: state.healthSnapshot,
        canLaunch: state.canLaunch,
      }),
    }
  )
);
