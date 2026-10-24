import { create } from 'zustand';
import { PassKind, subscriptionsService } from '@/services/subscriptionsService';
import { showToast } from '@/state/toastStore';
import i18n from '@/localization/i18n';

interface PayRequest {
  kind: PassKind;
  /** staff_contact: the job post whose number it unlocks. */
  targetId: string | null;
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
export async function payIfNeeded(kind: PassKind, targetId: string | null = null): Promise<boolean> {
  try {
    const mine = await subscriptionsService.getMine();
    if (!mine.enabled || mine.active) return true;
    // A phone number is paid per person, so a spare pass never covers it.
    const perPerson = (kind as string) === 'staff_contact';
    if (!perPerson && (mine.passes?.[kind] ?? 0) > 0) {
      // Paid before for one that didn't go ahead: say so, so it doesn't look free by mistake.
      showToast({ variant: 'info', title: i18n.t('payGate.paidEarlierTitle'), message: i18n.t(`payGate.paidEarlierMessage.${kind}`) });
      return true;
    }
    const amount = mine.fees?.[kind] ?? 0;
    if (amount <= 0 && !perPerson) return true;
    return await new Promise<boolean>((resolve) => usePayGateStore.getState().open({ kind, targetId, amount, resolve }));
  } catch {
    // Can't tell (offline): let the server decide; it answers PAYMENT_REQUIRED if needed.
    return true;
  }
}
