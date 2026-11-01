import { jobsService } from '@/services/jobsService';
import { shopOrdersService } from '@/services/shopOrdersService';
import { payIfNeeded } from '@/state/payGateStore';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import i18n from '@/localization/i18n';
import { jobQueryKey } from '@/hooks/useJobs';
import { shopOrderQueryKey } from '@/hooks/useShopOrders';
import { queryClient } from '@/state/queryClient';

type Need = 'ad' | 'pay' | null;

/**
 * Right after a job or an order was accepted: what the server says it still needs. Nothing (a
 * Quick Book / Quick Order, or on the plan for that side), or — for one booked with this
 * partner personally — the one-time fee: paid, it opens; backed out of, it goes back to the
 * customer's waiting list. Resolves true when it's open (its screen can be shown).
 */
export async function completeAccept(kind: 'job' | 'order', id: string): Promise<boolean> {
  let need: Need;
  // What was fetched goes straight into the cache, so the job / order screen opens with it
  // at once instead of loading it again.
  const keep = (data: unknown) => queryClient.setQueryData(kind === 'job' ? jobQueryKey(id) : shopOrderQueryKey(id), data);
  try {
    const fetched = kind === 'job' ? await jobsService.get(id) : await shopOrdersService.get(id);
    keep(fetched);
    need = fetched.unlockNeeded ?? null;
  } catch {
    // Can't tell (offline): open it; the server keeps the customer's details hidden if needed.
    return true;
  }
  if (!need) return true;
  const unlock = async (via: 'ad' | 'pay') => keep(await (kind === 'job' ? jobsService.unlock(id, via) : shopOrdersService.unlock(id, via)));
  const giveBack = () => (kind === 'job' ? jobsService.release(id) : shopOrdersService.release(id)).catch(() => undefined);
  try {
    if (need === 'ad') {
      // Accepted on an older version, when an ad was asked for: there are no such ads now.
      await unlock('ad');
      return true;
    }
    const paid = await payIfNeeded('accept', null, kind === 'order' ? 'shop' : 'service');
    if (!paid) {
      await giveBack();
      showToast({ variant: 'info', title: i18n.t('afterAccept.givenBackTitle'), message: i18n.t('afterAccept.givenBackMessage') });
      return false;
    }
    await unlock('pay');
    return true;
  } catch (error) {
    showToast({ variant: 'error', title: i18n.t('common.errorTitle'), message: getLocalizedErrorMessage(error, i18n.t.bind(i18n)) });
    return false;
  }
}

/**
 * Thrown by an accept whose ad / payment didn't go through: it was given back (and a toast
 * already said so) — callers treat it as nothing to report and don't open anything.
 */
export class GivenBackError extends Error {
  constructor() {
    super('Given back');
    this.name = 'GivenBackError';
  }
}
