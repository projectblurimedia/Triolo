import { create } from 'zustand';
import type { PartnerPlan } from '@/services/subscriptionsService';

interface SubscribeState {
  /** The root-mounted SubscribeModal is open. */
  visible: boolean;
  /** Which plan it shows: services, shop or job posts. */
  plan: PartnerPlan;
  open: (plan?: PartnerPlan) => void;
  close: () => void;
}

/** Opens a partner plan's screen from anywhere (Plans tab, a notification, job post views). */
export const useSubscribeStore = create<SubscribeState>((set) => ({
  visible: false,
  plan: 'service',
  open: (plan) => set((state) => ({ visible: true, plan: plan ?? state.plan })),
  close: () => set({ visible: false }),
}));

export const openSubscribe = (plan?: PartnerPlan) => useSubscribeStore.getState().open(plan);
