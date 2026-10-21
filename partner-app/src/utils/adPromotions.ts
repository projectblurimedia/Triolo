import { Linking } from 'react-native';
import i18n from '@/localization/i18n';
import { endAdFreeFlow, setAdPromotionHandler } from '@/components/Ads';
import { apiClient } from '@/services/apiClient';
import { showToast } from '@/state/toastStore';

/**
 * What the partner app can open from an ad that promotes a Triolo profile: only a job post's
 * Contact (it calls the person). Booking a worker or ordering from a shop happens in the
 * customer app, so those ads show no button here.
 */
export function registerAdPromotions(): void {
  setAdPromotionHandler(
    async (promoted) => {
      try {
        const post = await apiClient.get<{ mobileNumber: string }>(`/job-seekers/public/${promoted.id}`, true);
        await Linking.openURL(`tel:${post.mobileNumber}`);
        // Calling is the whole flow here.
        endAdFreeFlow();
      } catch {
        endAdFreeFlow();
        showToast({ variant: 'info', title: i18n.t('ads.profileGoneTitle'), message: i18n.t('ads.profileGoneMessage') });
      }
    },
    ['job_post'],
  );
}
