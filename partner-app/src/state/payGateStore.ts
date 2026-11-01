import { create } from 'zustand';
import { PartnerPlan, PassKind, subscriptionsService } from '@/services/subscriptionsService';
import { showToast } from '@/state/toastStore';
import i18n from '@/localization/i18n';

interface PayRequest {
  kind: PassKind;
  /** job_post_viewer / profile_viewer: the person it unlocks. */
  targetId: string | null;
  /** accept: the side whose plan would have made it free (services or shop). */
  plan?: PartnerPlan;
  amount: number;
  resolve: (paid: boolean) => void;
}

interface PayGateState {
  request: PayRequest | null;
  open: (request: PayRequest) => void;
  finish: (paid: boolean) => void;
}

/**
 * (Copied from user-app — keep in sync.)
 * The "pay once" step: someone without a plan (while plans are on) pays a fixed fee, set by
 * the admin, for one booking / order / phone number (customers) or one accept / job post
 * (partners). The root-mounted PayGateSheet shows it.
 */
export const usePayGateStore = create<PayGateState>((set, get) => ({
  request: null,
  open: (request) => {
    get().request?.resolve(false);
    set({ request });
  },
  finish: (paid) => {
    get().request?.resolve(paid);
    set({ request: null });
  },
}));

/**
 * Call at the final step of an action that may need paying for. Resolves true when it can go
 * ahead — a plan, plans off, a pass already paid (or a number already unlocked), or paid now in
 * the sheet — and false when the person backs out.
 */
export async function payIfNeeded(kind: PassKind, targetId: string | null = null, plan?: PartnerPlan): Promise<boolean> {
  try {
    const mine = await subscriptionsService.getMine();
    // The plan that makes it free: job posts' own plan, else the side it's for (or All in One).
    const side: PartnerPlan | undefined = kind === 'job_post' || kind === 'job_post_viewer' ? 'job_post' : plan;
    const onPlan = side && mine.plans ? !!mine.plans[side]?.active : !!mine.active;
    if (!mine.enabled || onPlan) return true;
    // Seeing a viewer is paid per person, so a spare pass never covers it.
    const perPerson = kind === 'job_post_viewer' || kind === 'profile_viewer';
    if (!perPerson && (mine.passes?.[kind] ?? 0) > 0) {
      // Paid before for one that didn't go ahead: say so, so it doesn't look free by mistake.
      showToast({ variant: 'info', title: i18n.t('payGate.paidEarlierTitle'), message: i18n.t(`payGate.paidEarlierMessage.${kind}`) });
      return true;
    }
    const amount = mine.fees?.[kind] ?? 0;
    if (amount <= 0 && !perPerson) return true;
    return await new Promise<boolean>((resolve) => usePayGateStore.getState().open({ kind, targetId, plan: side, amount, resolve }));
  } catch {
    // Can't tell (offline): let the server decide; it answers PAYMENT_REQUIRED if needed.
    return true;
  }
}
