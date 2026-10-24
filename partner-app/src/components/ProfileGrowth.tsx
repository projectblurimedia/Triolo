import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { BoostModal } from './BoostModal';
import { GoldCard, GOLD_INK, GOLD_INK_SOFT } from './GoldCard';
import { LoadingIndicator } from './LoadingIndicator';
import { BADGES_QUERY_KEY, useBoostInfo, useMyBadges, useMySubscription } from '@/hooks/useSubscription';
import { usePaymentReturn } from '@/hooks/usePaymentReturn';
import { BadgeKind, MyProfileBadge, subscriptionsService } from '@/services/subscriptionsService';
import { openSubscribe } from '@/state/subscribeStore';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { formatDay } from '@/utils/formatDate';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

const TRUST_GRADIENT = ['#047857', '#10B981'] as const;
const KIND_ICON: Record<BadgeKind, React.ComponentProps<typeof FontAwesome6>['name']> = {
  service: 'screwdriver-wrench',
  business: 'store',
  job_post: 'briefcase',
};

/**
 * Profile's "Grow your profiles": the gold Partner Plus card (when the admin has plans on),
 * then a card per profile — services, shop, job post — each with two big tiles: its own
 * "Trusted by Triolo" badge (bought separately) and Boost (shown to customers as an ad).
 */
export function ProfileGrowth() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const queryClient = useQueryClient();
  const subscription = useMySubscription();
  const badges = useMyBadges();
  const profiles = badges.data?.profiles ?? [];
  const boostInfo = useBoostInfo(profiles.length > 0);
  const [boosting, setBoosting] = useState<{ kind: BadgeKind; name: string } | null>(null);
  const [busy, setBusy] = useState<BadgeKind | null>(null);
  // The badge whose payment is being checked by hand (its button spins).
  const [checking, setChecking] = useState<string | null>(null);
  const { watch } = usePaymentReturn();

  const sub = subscription.data;
  if (!sub?.enabled && profiles.length === 0) return null;
  const boostFrom = boostInfo.data ? Math.min(...Object.values(boostInfo.data.prices)) : null;

  const checkBadge = async (badgeId: string, quiet: boolean) => {
    if (!quiet) setChecking(badgeId);
    try {
      const result = await subscriptionsService.badgeCheck(badgeId);
      queryClient.setQueryData(BADGES_QUERY_KEY, result);
      if (result.paid) {
        showToast({ variant: 'success', title: t('badge.paidTitle'), message: t('badge.paidMessage') });
      } else if (!quiet) {
        showToast({ variant: 'info', title: t('subscribe.notPaidTitle'), message: t('subscribe.notPaidMessage') });
      }
    } catch (error) {
      if (!quiet) showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) });
    } finally {
      if (!quiet) setChecking(null);
    }
  };

  const buyBadge = async (profile: MyProfileBadge) => {
    setBusy(profile.kind);
    try {
      const pending = profile.status === 'pending' && profile.badgeId && profile.paymentUrl;
      const { id, paymentUrl } = pending
        ? { id: profile.badgeId!, paymentUrl: profile.paymentUrl! }
        : await subscriptionsService.badgeCheckout(profile.kind);
      queryClient.invalidateQueries({ queryKey: BADGES_QUERY_KEY });
      watch(() => checkBadge(id, true));
      await Linking.openURL(paymentUrl);
    } catch (error) {
      showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) });
    } finally {
      setBusy(null);
    }
  };

  const badgeTile = (profile: MyProfileBadge) => {
    const badgesOn = !!badges.data?.enabled;
    const active = profile.status === 'active';
    if (!badgesOn && !active) return null;
    const canBuy = profile.eligible && !active;
    const caption = active
      ? t('badge.activeCaption')
      : !profile.eligible
        ? t(`badge.notEligible.${profile.kind}`)
        : profile.status === 'pending'
          ? t('badge.finishPayment')
          : t('badge.price', { amount: badges.data?.price ?? 0 });
    return (
      <Pressable
        onPress={() => canBuy && buyBadge(profile)}
        disabled={!canBuy || busy !== null}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.tile,
          {
            backgroundColor: active ? `${brandColors.success}14` : colors.background,
            borderColor: active ? `${brandColors.success}66` : colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <LinearGradient colors={TRUST_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tileIcon}>
          {busy === profile.kind ? (
            <LoadingIndicator size={18} />
          ) : (
            <FontAwesome6 name={active ? 'circle-check' : 'shield-halved'} size={18} color="#FFFFFF" solid />
          )}
        </LinearGradient>
        <Text style={[styles.tileTitle, { color: colors.text }]} numberOfLines={1}>
          {active ? t('badge.trusted') : t('badge.tileTitle')}
        </Text>
        <Text style={[styles.tileCaption, { color: active ? brandColors.success : colors.textMuted }]} numberOfLines={3}>
          {caption}
        </Text>
        {canBuy ? (
          <View style={[styles.tileCta, { backgroundColor: brandColors.success }]}>
            <Text style={styles.tileCtaText}>{profile.status === 'removed' ? t('badge.buyAgainShort') : t('badge.getShort')}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const boostTile = (profile: MyProfileBadge) => (
    <Pressable
      onPress={() => setBoosting({ kind: profile.kind, name: profile.name })}
      disabled={!profile.eligible}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: colors.background, borderColor: colors.border, opacity: !profile.eligible ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tileIcon}>
        <FontAwesome6 name="rocket" size={18} color="#FFFFFF" solid />
      </LinearGradient>
      <Text style={[styles.tileTitle, { color: colors.text }]} numberOfLines={1}>
        {t('growth.boost')}
      </Text>
      <Text style={[styles.tileCaption, { color: colors.textMuted }]} numberOfLines={3}>
        {boostFrom !== null ? t('growth.boostFrom', { amount: boostFrom }) : t('growth.boostCaption')}
      </Text>
      {profile.eligible ? (
        <View style={[styles.tileCta, { backgroundColor: colors.primary }]}>
          <Text style={styles.tileCtaText}>{t('growth.boostCta')}</Text>
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <>
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('growth.title')}</Text>

      {sub?.enabled ? (
        <Pressable onPress={openSubscribe} accessibilityRole="button" style={({ pressed }) => [styles.plusWrap, { opacity: pressed ? 0.9 : 1 }]}>
          <GoldCard style={styles.plusCard}>
            <View style={styles.plusRow}>
              <View style={styles.crown}>
                <FontAwesome6 name="crown" size={18} color="#8A5300" solid />
              </View>
              <View style={styles.flex}>
                <View style={styles.plusTitleRow}>
                  <Text style={styles.plusTitle}>{t('subscribe.cardBrand')}</Text>
                  {sub.active ? (
                    <View style={styles.activePill}>
                      <FontAwesome6 name="check" size={9} color="#FFFFFF" solid />
                      <Text style={styles.activeText}>{t('subscribe.activeShort')}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.plusText} numberOfLines={2}>
                  {sub.active ? t('subscribe.activeUntil', { date: formatDay(sub.active.endsAt) }) : t('subscribe.cardText')}
                </Text>
              </View>
              <View style={styles.plusCta}>
                <Text style={styles.plusCtaText}>{sub.active ? t('subscribe.manage') : t('subscribe.get')}</Text>
              </View>
            </View>
          </GoldCard>
        </Pressable>
      ) : null}

      {profiles.map((profile) => (
        <View key={profile.kind} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardHead}>
            <View style={styles.kindIcon}>
              <FontAwesome6 name={KIND_ICON[profile.kind]} size={15} color="#FFFFFF" solid />
            </View>
            <View style={styles.flex}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {profile.name}
              </Text>
              <Text style={styles.cardKind}>{t(`growth.kind.${profile.kind}`)}</Text>
            </View>
            {profile.status === 'active' ? (
              <View style={styles.trustedChip}>
                <FontAwesome6 name="circle-check" size={11} color="#FFFFFF" solid />
                <Text style={styles.trustedChipText}>{t('badge.trusted')}</Text>
              </View>
            ) : null}
          </LinearGradient>

          {profile.status === 'removed' && profile.removedReason ? (
            <View style={[styles.notice, { backgroundColor: `${brandColors.error}12`, borderColor: `${brandColors.error}40` }]}>
              <FontAwesome6 name="triangle-exclamation" size={13} color={brandColors.error} solid />
              <Text style={[styles.noticeText, { color: colors.text }]}>{t('badge.removed', { reason: profile.removedReason })}</Text>
            </View>
          ) : null}

          <View style={styles.tiles}>
            {badgeTile(profile)}
            {boostTile(profile)}
          </View>

          {profile.status === 'pending' && profile.badgeId ? (
            <Pressable
              onPress={() => checkBadge(profile.badgeId!, false)}
              disabled={checking !== null}
              accessibilityRole="button"
              style={({ pressed }) => [styles.checkButton, { borderColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            >
              {checking === profile.badgeId ? (
                <LoadingIndicator size={18} color={colors.primary} />
              ) : (
                <Text style={[styles.link, { color: colors.primary }]}>{t('subscribe.checkPaid')}</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ))}

      <BoostModal profile={boosting} onClose={() => setBoosting(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sectionLabel: {
    ...typography.caption,
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 22,
    marginBottom: 12,
  },
  plusWrap: { marginBottom: 14 },
  plusCard: { padding: 16 },
  plusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  crown: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  plusTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: GOLD_INK, lineHeight: 22 },
  plusText: { ...typography.caption, color: GOLD_INK_SOFT, marginTop: 2, lineHeight: 16 },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#15803D',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  activeText: { ...typography.caption, fontSize: 10, color: '#FFFFFF', fontFamily: fonts.semiBold },
  plusCta: { backgroundColor: GOLD_INK, borderRadius: 14, paddingHorizontal: 12, height: 30, justifyContent: 'center' },
  plusCtaText: { ...typography.caption, color: '#FFE29A', fontFamily: fonts.semiBold },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#0B2A5B',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  kindIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  cardKind: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)', marginTop: 1 },
  trustedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  trustedChipText: { ...typography.caption, fontSize: 11, color: '#FFFFFF', fontFamily: fonts.semiBold },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  noticeText: { ...typography.caption, flex: 1, lineHeight: 17 },
  tiles: { flexDirection: 'row', gap: 10, padding: 12 },
  tile: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 12, alignItems: 'flex-start', gap: 6 },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  tileTitle: { ...typography.body, fontFamily: fonts.semiBold },
  tileCaption: { ...typography.caption, lineHeight: 16, flexGrow: 1 },
  tileCta: { marginTop: 4, borderRadius: 12, paddingHorizontal: 12, height: 30, justifyContent: 'center', alignSelf: 'stretch', alignItems: 'center' },
  tileCtaText: { ...typography.caption, color: '#FFFFFF', fontFamily: fonts.semiBold },
  checkButton: {
    height: 40,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: { ...typography.caption, fontFamily: fonts.semiBold },
});
