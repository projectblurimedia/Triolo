import React, { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { BoostModal } from './BoostModal';
import { LoadingIndicator } from './LoadingIndicator';
import { BADGES_QUERY_KEY, useMyBadges, useMyBoosts } from '@/hooks/useSubscription';
import { GlassBackdrop } from './Glass';
import { GOLD_INK, GOLD_INK_SOFT } from './GoldCard';
import { formatDay } from '@/utils/formatDate';
import { usePaymentReturn } from '@/hooks/usePaymentReturn';
import { BadgeKind, Boost, BoostInfo, MyProfileBadge, subscriptionsService } from '@/services/subscriptionsService';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

const TRUST_GRADIENT = ['#047857', '#10B981'] as const;
const KIND_ICON: Record<BadgeKind, React.ComponentProps<typeof FontAwesome6>['name']> = {
  service: 'screwdriver-wrench',
  business: 'store',
  job_post: 'briefcase',
};

/**
 * The Plans tab's "Your profiles": one slim card per profile — services, shop, job post — with
 * its "Trusted by Triolo" badge (bought separately; shows Active / price / why not yet) and
 * Boost (shown to customers as an ad) side by side as two buttons.
 */
export function ProfileGrowth({
  boostInfo,
  kinds,
  profileIds,
  hideHeading = false,
  gold = false,
  split = false,
}: {
  /** Drawn inside the gold plan card: gold-toned, no white panels. */
  gold?: boolean;
  /** The Plans tab: the badge and the boost each in a card of their own. */
  split?: boolean;
  boostInfo: BoostInfo | null;
  /** Only these kinds of profile (the Plans tab shows each kind in its own section). */
  kinds?: BadgeKind[];
  /** Only these profiles (Plans: the one job post picked). */
  profileIds?: string[];
  hideHeading?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const queryClient = useQueryClient();
  const badges = useMyBadges();
  const profiles = (badges.data?.profiles ?? []).filter(
    (profile) => (!kinds || kinds.includes(profile.kind)) && (!profileIds || profileIds.includes(profile.profileId)),
  );
  const [boosting, setBoosting] = useState<{ kind: BadgeKind; name: string; profileId: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // The boost whose numbers are open.
  const [details, setDetails] = useState<Boost | null>(null);
  const boosts = useMyBoosts(true);
  // The badge whose payment is being checked by hand (its button spins).
  const [checking, setChecking] = useState<string | null>(null);
  const { watch } = usePaymentReturn();

  if (profiles.length === 0) return null;
  const boostFrom = boostInfo ? Math.min(...Object.values(boostInfo.prices)) : null;
  const badgesOn = !!badges.data?.enabled;
  // On the gold card everything is gold-ink on a soft brown tint, in light and dark mode alike.
  const ink = gold ? GOLD_INK : colors.text;
  const inkSoft = gold ? GOLD_INK_SOFT : colors.textMuted;
  const tint = 'rgba(61, 37, 0, 0.08)';
  const rim = 'rgba(61, 37, 0, 0.2)';

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
    setBusy(profile.profileId);
    try {
      const pending = profile.status === 'pending' && profile.badgeId && profile.paymentUrl;
      const { id, paymentUrl } = pending
        ? { id: profile.badgeId!, paymentUrl: profile.paymentUrl! }
        : await subscriptionsService.badgeCheckout(profile.kind, profile.profileId);
      queryClient.invalidateQueries({ queryKey: BADGES_QUERY_KEY });
      watch(() => checkBadge(id, true));
      await Linking.openURL(paymentUrl);
    } catch (error) {
      showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) });
    } finally {
      setBusy(null);
    }
  };

  const badgeButton = (profile: MyProfileBadge) => {
    const active = profile.status === 'active';
    if (!badgesOn && !active) return null;
    const canBuy = profile.eligible && !active;
    const label = active
      ? t('badge.trusted')
      : !profile.eligible
        ? t('plans.badgeNotYet')
        : profile.status === 'pending'
          ? t('plans.badgeFinish')
          : t('plans.badgePrice', { amount: badges.data?.price ?? 0 });
    return (
      <Pressable
        onPress={() => {
          if (canBuy) {
            buyBadge(profile);
            return;
          }
          // Nothing to buy: say why rather than doing nothing.
          showToast(
            active
              ? { variant: 'success', title: t('growth.alreadyTrustedTitle'), message: t('growth.alreadyTrustedMessage') }
              : { variant: 'info', title: t('plans.badgeNotYet'), message: t(`badge.notEligible.${profile.kind}`) },
          );
        }}
        disabled={busy !== null}
        accessibilityRole="button"
        accessibilityHint={!profile.eligible ? t(`badge.notEligible.${profile.kind}`) : undefined}
        style={({ pressed }) => [
          split ? styles.actionRow : styles.action,
          {
            backgroundColor: gold ? tint : active ? `${brandColors.success}14` : `${brandColors.success}0A`,
            borderColor: gold ? rim : `${brandColors.success}${canBuy || active ? '66' : '2E'}`,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <LinearGradient colors={TRUST_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionIcon}>
          {busy === profile.profileId ? (
            <LoadingIndicator size={14} />
          ) : (
            <FontAwesome6 name={active ? 'circle-check' : 'shield-halved'} size={15} color="#FFFFFF" solid />
          )}
        </LinearGradient>
        <View style={styles.flex}>
          <Text style={[styles.actionTitle, { color: ink }]} numberOfLines={1}>
            {t('badge.tileTitle')}
          </Text>
          <Text style={[styles.actionText, { color: gold ? '#166534' : brandColors.success }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </Pressable>
    );
  };

  /** The profile's boost that is on or on its way (paid, being checked, running). */
  const currentBoost = (profile: MyProfileBadge) =>
    (boosts.data ?? []).find(
      (boost) =>
        boost.actionType === profile.kind &&
        ['in_review', 'scheduled', 'running'].includes(boost.status) &&
        (!boost.promoted || boost.promoted.id === profile.profileId),
    ) ?? null;

  const boostButton = (profile: MyProfileBadge) => {
    const current = currentBoost(profile);
    if (current) {
      return (
        <Pressable
          onPress={() => setDetails(current)}
          accessibilityRole="button"
          style={({ pressed }) => [
            split ? styles.actionRow : styles.action,
            { backgroundColor: gold ? tint : `${colors.primary}14`, borderColor: gold ? rim : colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionIcon}>
            <FontAwesome6 name="rocket" size={15} color="#FFFFFF" solid />
          </LinearGradient>
          <View style={styles.flex}>
            <Text style={[styles.actionTitle, { color: ink }]} numberOfLines={1}>
              {t('plans.boosting')}
            </Text>
            <Text style={[styles.actionText, { color: gold ? '#0B3A8A' : colors.primary }]} numberOfLines={1}>
              {current.status === 'running' ? t('boost.views', { count: current.impressions }) : t(`boost.status.${current.status}`)}
            </Text>
          </View>
        </Pressable>
      );
    }
    return (
    <Pressable
      onPress={() => setBoosting({ kind: profile.kind, name: profile.name, profileId: profile.profileId })}
      disabled={!profile.eligible}
      accessibilityRole="button"
      style={({ pressed }) => [
        split ? styles.actionRow : styles.action,
        {
          backgroundColor: gold ? tint : `${colors.primary}0A`,
          borderColor: gold ? rim : `${colors.primary}${profile.eligible ? '66' : '2E'}`,
          opacity: !profile.eligible ? 0.55 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionIcon}>
        <FontAwesome6 name="rocket" size={15} color="#FFFFFF" solid />
      </LinearGradient>
      <View style={styles.flex}>
        <Text style={[styles.actionTitle, { color: ink }]} numberOfLines={1}>
          {t('growth.boost')}
        </Text>
        <Text style={[styles.actionText, { color: gold ? '#0B3A8A' : colors.primary }]} numberOfLines={1}>
          {boostFrom !== null ? t('plans.boostFrom', { amount: boostFrom }) : t('growth.boostCta')}
        </Text>
      </View>
    </Pressable>
    );
  };

  // The Plans tab: the badge card (green) and the boost card (blue), each saying what it does.
  const renderSplit = (profile: MyProfileBadge, index: number) => (
    <React.Fragment key={profile.profileId}>
      <View style={[styles.splitCard, { backgroundColor: colors.surface, borderColor: `${brandColors.success}66` }]}>
        <LinearGradient colors={TRUST_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.band}>
          <FontAwesome6 name="shield-halved" size={70} color="rgba(255,255,255,0.13)" solid style={styles.bandMark} />
          <View style={styles.bandIcon}>
            <FontAwesome6 name="shield-halved" size={17} color="#FFFFFF" solid />
          </View>
          <View style={styles.flex}>
            <Text style={styles.bandTitle}>{t('badge.tileTitle')}</Text>
            <Text style={styles.bandFor} numberOfLines={1}>
              {profile.name}
            </Text>
          </View>
        </LinearGradient>
        <Text style={[styles.splitText, { color: colors.textMuted }]}>{t('growth.trustDesc')}</Text>
        <View style={styles.points}>
          {(['a', 'b', 'c'] as const).map((point) => (
            <View key={point} style={[styles.point, { backgroundColor: `${brandColors.success}14`, borderColor: `${brandColors.success}33` }]}>
              <FontAwesome6 name="check" size={9} color={brandColors.success} solid />
              <Text style={[styles.pointText, { color: colors.text }]} numberOfLines={1}>
                {t(`growth.trustPoints.${point === 'c' ? `c_${profile.kind}` : point}`)}
              </Text>
            </View>
          ))}
        </View>
        {profile.status === 'removed' && profile.removedReason ? (
          <View style={[styles.notice, { backgroundColor: `${brandColors.error}12`, borderColor: `${brandColors.error}40` }]}>
            <FontAwesome6 name="triangle-exclamation" size={12} color={brandColors.error} solid />
            <Text style={[styles.noticeText, { color: colors.text }]}>{t('badge.removed', { reason: profile.removedReason })}</Text>
          </View>
        ) : null}
        {badgeButton(profile) ?? (
          <Text style={[styles.splitText, { color: colors.textMuted }]}>{t('growth.badgeOff')}</Text>
        )}
        {profile.status === 'pending' && profile.badgeId ? (
          <Pressable onPress={() => checkBadge(profile.badgeId!, false)} disabled={checking !== null} hitSlop={6} style={styles.checkLink}>
            {checking === profile.badgeId ? (
              <LoadingIndicator size={16} color={colors.primary} />
            ) : (
              <Text style={[styles.link, { color: colors.primary }]}>{t('subscribe.checkPaid')}</Text>
            )}
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.splitCard, { backgroundColor: colors.surface, borderColor: `${colors.primary}66` }]}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.band}>
          <FontAwesome6 name="rocket" size={70} color="rgba(255,255,255,0.13)" solid style={styles.bandMark} />
          <View style={styles.bandIcon}>
            <FontAwesome6 name="rocket" size={17} color="#FFFFFF" solid />
          </View>
          <View style={styles.flex}>
            <Text style={styles.bandTitle}>{t('growth.boost')}</Text>
            <Text style={styles.bandFor} numberOfLines={1}>
              {profile.name}
            </Text>
          </View>
        </LinearGradient>
        <Text style={[styles.splitText, { color: colors.textMuted }]}>{t('growth.boostDesc')}</Text>
        <View style={styles.points}>
          {(['a', 'b', 'c'] as const).map((point) => (
            <View key={point} style={[styles.point, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}33` }]}>
              <FontAwesome6 name="check" size={9} color={colors.primary} solid />
              <Text style={[styles.pointText, { color: colors.text }]} numberOfLines={1}>
                {t(`growth.boostPoints.${point}`)}
              </Text>
            </View>
          ))}
        </View>
        {boostButton(profile)}
      </View>
    </React.Fragment>
  );

  return (
    <>
      {split ? null : hideHeading ? (
        <View style={styles.headGap} />
      ) : (
        <View style={styles.headRow}>
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headIcon}>
            <FontAwesome6 name="id-card" size={12} color="#FFFFFF" solid />
          </LinearGradient>
          <Text style={[styles.headTitle, { color: colors.text }]}>{t('plans.profilesTitle')}</Text>
          <View style={[styles.headRule, { backgroundColor: `${colors.primary}1F` }]} />
        </View>
      )}

      {profiles.map((profile, index) => split ? renderSplit(profile, index) : (
        <View
          key={profile.profileId}
          style={[styles.card, gold ? { backgroundColor: tint, borderColor: rim } : { backgroundColor: colors.surface, borderColor: `${colors.primary}2E` }]}
        >
          <View style={styles.cardHead}>
            <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.kindIcon}>
              <FontAwesome6 name={KIND_ICON[profile.kind]} size={14} color="#FFFFFF" solid />
            </LinearGradient>
            <View style={styles.flex}>
              <Text style={[styles.cardTitle, { color: ink }]} numberOfLines={1}>
                {profile.name}
              </Text>
              <Text style={[styles.cardKind, { color: inkSoft }]}>{t(`growth.kind.${profile.kind}`)}</Text>
            </View>
          </View>

          {profile.status === 'removed' && profile.removedReason ? (
            <View style={[styles.notice, { backgroundColor: `${brandColors.error}12`, borderColor: `${brandColors.error}40` }]}>
              <FontAwesome6 name="triangle-exclamation" size={12} color={brandColors.error} solid />
              <Text style={[styles.noticeText, { color: colors.text }]}>{t('badge.removed', { reason: profile.removedReason })}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            {badgeButton(profile)}
            {boostButton(profile)}
          </View>

          {profile.status === 'pending' && profile.badgeId ? (
            <Pressable onPress={() => checkBadge(profile.badgeId!, false)} disabled={checking !== null} hitSlop={6} style={styles.checkLink}>
              {checking === profile.badgeId ? (
                <LoadingIndicator size={16} color={colors.primary} />
              ) : (
                <Text style={[styles.link, { color: colors.primary }]}>{t('subscribe.checkPaid')}</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ))}

      <BoostModal profile={boosting} onClose={() => setBoosting(null)} />

      {/* A boost's numbers: views, taps, the tap rate, its days and status — as on the ads site. */}
      <Modal visible={details !== null} transparent animationType="fade" onRequestClose={() => setDetails(null)} statusBarTranslucent>
        <GlassBackdrop onPress={() => setDetails(null)} style={styles.detailsOverlay}>
          {details ? (
            <View style={[styles.detailsSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.detailsHead}>
                <FontAwesome6 name="rocket" size={16} color="#FFFFFF" solid />
                <View style={styles.flex}>
                  <Text style={styles.detailsTitle}>{t('plans.boostDetailsTitle')}</Text>
                  <Text style={styles.detailsSub} numberOfLines={1}>
                    {details.promoted?.name ?? ''} · {t(`boost.status.${details.status}`)}
                  </Text>
                </View>
              </LinearGradient>
              <View style={styles.detailsStats}>
                {[
                  { icon: 'eye' as const, value: String(details.impressions), label: t('plans.boostViews') },
                  { icon: 'hand-pointer' as const, value: String(details.clicks), label: t('plans.boostClicks') },
                  {
                    icon: 'percent' as const,
                    value: details.impressions > 0 ? `${((details.clicks / details.impressions) * 100).toFixed(1)}%` : '–',
                    label: t('plans.boostRate'),
                  },
                ].map((stat) => (
                  <View key={stat.label} style={[styles.detailsStat, { backgroundColor: colors.background, borderColor: `${colors.primary}1F` }]}>
                    <FontAwesome6 name={stat.icon} size={13} color={colors.primary} solid />
                    <Text style={[styles.detailsValue, { color: colors.text }]}>{stat.value}</Text>
                    <Text style={[styles.detailsLabel, { color: colors.textMuted }]}>{stat.label}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.detailsRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.detailsKey, { color: colors.textMuted }]}>{t('plans.boostDates')}</Text>
                <Text style={[styles.detailsVal, { color: colors.text }]}>
                  {formatDay(details.startDate)} – {formatDay(details.endDate)}
                </Text>
              </View>
              <View style={[styles.detailsRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.detailsKey, { color: colors.textMuted }]}>{t('plans.boostPlan')}</Text>
                <Text style={[styles.detailsVal, { color: colors.text }]}>
                  {t('boost.days', { count: details.planDays })} · ₹{details.amount}
                </Text>
              </View>
              <Pressable onPress={() => setDetails(null)} style={[styles.detailsClose, { borderColor: colors.primary }]}>
                <Text style={[styles.detailsCloseText, { color: colors.primary }]}>{t('common.close')}</Text>
              </Pressable>
            </View>
          ) : null}
        </GlassBackdrop>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headGap: { height: 10 },
  flex: { flex: 1 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 10 },
  headIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  headTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 16 },
  headRule: { flex: 1, height: 1 },
  card: { borderWidth: 1.5, borderRadius: 20, padding: 12, gap: 12, marginBottom: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kindIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14.5 },
  cardKind: { ...typography.caption, fontSize: 11.5 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 8 },
  noticeText: { ...typography.caption, flex: 1, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 10 },
  splitCard: { borderWidth: 1.5, borderRadius: 22, padding: 14, gap: 11, marginBottom: 12, overflow: 'hidden' },
  band: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: -14, marginTop: -14, paddingHorizontal: 14, paddingVertical: 14, overflow: 'hidden' },
  bandMark: { position: 'absolute', right: -6, bottom: -18 },
  bandIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 16.5, color: '#FFFFFF', lineHeight: 22 },
  bandFor: { ...typography.caption, fontSize: 12, color: 'rgba(255,255,255,0.88)' },
  points: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, borderRadius: 13, borderWidth: 1, paddingHorizontal: 9 },
  pointText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11 },
  splitMark: { position: 'absolute', right: -10, top: -8 },
  splitLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 8 },
  splitNumber: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  splitNumberText: { fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 14, color: '#FFFFFF' },
  splitLabelText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14, flex: 1 },
  splitHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  splitIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  splitTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 16.5 },
  splitFor: { ...typography.caption, fontSize: 12 },
  splitText: { ...typography.caption, fontSize: 12.5, lineHeight: 18 },
  // The action inside a split card: one wide row.
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 12, minHeight: 54 },
  // Two tiles side by side: a big icon on top, the name and its state under it.
  action: { flex: 1, gap: 10, borderWidth: 1.5, borderRadius: 16, padding: 12, minHeight: 98 },
  actionIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 13.5, lineHeight: 18 },
  actionText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11.5, lineHeight: 15, marginTop: 1 },
  checkLink: { alignSelf: 'center', paddingVertical: 2 },
  link: { ...typography.caption, fontFamily: fonts.semiBold },
  detailsOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  detailsSheet: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  detailsHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  detailsTitle: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  detailsSub: { ...typography.caption, color: 'rgba(255,255,255,0.85)' },
  detailsStats: { flexDirection: 'row', gap: 8, padding: 12 },
  detailsStat: { flex: 1, alignItems: 'center', gap: 3, borderRadius: 14, borderWidth: 1, paddingVertical: 10 },
  detailsValue: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 22 },
  detailsLabel: { ...typography.caption, fontSize: 11 },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10 },
  detailsKey: { ...typography.caption, fontSize: 12.5 },
  detailsVal: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12.5 },
  detailsClose: { margin: 12, height: 42, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  detailsCloseText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
});
