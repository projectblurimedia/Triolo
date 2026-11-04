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
import { payInApp } from '@/utils/inAppPay';
import { FullText } from '@/components/FullText';

const TRUST_GRADIENT = ['#047857', '#10B981'] as const;
// The two posters' heroes and the boost's button.
const TRUST_HERO = ['#065F46', '#059669', '#2DD4A0'] as const;
const BOOST_HERO = ['#2E3192', '#2563EB', '#22B4F0'] as const;
const BOOST_BUTTON = ['#1D4ED8', '#0EA5E9'] as const;
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
      // In the app, with the phone's UPI apps (new installs); else the payment page.
      const outcome = await payInApp({ type: 'badge', id });
      if (outcome === 'paid') {
        await checkBadge(id, false);
        return;
      }
      if (outcome === 'cancelled') return;
      watch(() => checkBadge(id, true));
      if (paymentUrl) await Linking.openURL(paymentUrl);
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
          <FullText style={[styles.actionTitle, { color: ink }]} numberOfLines={1}>
            {t('badge.tileTitle')}
          </FullText>
          <FullText style={[styles.actionText, { color: gold ? '#166534' : brandColors.success }]} numberOfLines={1}>
            {label}
          </FullText>
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
            <FullText style={[styles.actionTitle, { color: ink }]} numberOfLines={1}>
              {t('plans.boosting')}
            </FullText>
            <FullText style={[styles.actionText, { color: gold ? '#0B3A8A' : colors.primary }]} numberOfLines={1}>
              {current.status === 'running' ? t('boost.views', { count: current.impressions }) : t(`boost.status.${current.status}`)}
            </FullText>
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
        <FullText style={[styles.actionTitle, { color: ink }]} numberOfLines={1}>
          {t('growth.boost')}
        </FullText>
        <FullText style={[styles.actionText, { color: gold ? '#0B3A8A' : colors.primary }]} numberOfLines={1}>
          {boostFrom !== null ? t('plans.boostFrom', { amount: boostFrom }) : t('growth.boostCta')}
        </FullText>
      </View>
    </Pressable>
    );
  };

  // The Plans tab: the Trusted card (green) and the Boost card (blue), each a small poster —
  // a gradient hero, what it does, and one big button.
  const renderSplit = (profile: MyProfileBadge, _index: number) => {
    const active = profile.status === 'active';
    const pending = profile.status === 'pending';
    const current = currentBoost(profile);
    const badgePrice = badges.data?.price ?? 0;
    const trustCta = active
      ? t('growth.trustedActive')
      : !profile.eligible
        ? t('plans.badgeNotYet')
        : pending
          ? t('plans.badgeFinish')
          : t('growth.getTrusted', { amount: badgePrice });
    return (
      <React.Fragment key={profile.profileId}>
        {/* --- Trusted by Triolo --- */}
        <View style={[styles.poster, { backgroundColor: colors.surface, borderColor: `${brandColors.success}55` }]}>
          <LinearGradient colors={TRUST_HERO} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.posterHero}>
            <View style={[styles.bubble, styles.bubbleA]} />
            <View style={[styles.bubble, styles.bubbleB]} />
            <View style={styles.posterTop}>
              <View style={styles.sealRing}>
                <LinearGradient colors={['#34D399', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.seal}>
                  <FontAwesome6 name={active ? 'circle-check' : 'shield-halved'} size={24} color="#FFFFFF" solid />
                </LinearGradient>
              </View>
              <View style={styles.flex}>
                <Text style={styles.posterKicker}>{t(`growth.kind.${profile.kind}`)}</Text>
                <Text style={styles.posterTitle}>{t('badge.tileTitle')}</Text>
                <FullText style={styles.posterFor} numberOfLines={1}>
                  {profile.name}
                </FullText>
              </View>
              <View style={[styles.posterPill, active ? styles.posterPillOn : null]}>
                <FontAwesome6 name={active ? 'check' : 'tag'} size={10} color={active ? '#047857' : '#FFFFFF'} solid />
                <Text style={[styles.posterPillText, active ? { color: '#047857' } : null]}>
                  {active ? t('plans.active') : `₹${badgePrice}`}
                </Text>
              </View>
            </View>
            <Text style={styles.posterLead}>{t('growth.trustDesc')}</Text>
          </LinearGradient>

          {/* How customers see the profile with the seal. */}
          <View style={[styles.preview, { backgroundColor: `${brandColors.success}0D`, borderColor: `${brandColors.success}33` }]}>
            <Text style={[styles.previewLabel, { color: colors.textMuted }]}>{t('growth.trustPreview')}</Text>
            <View style={styles.previewRow}>
              <View style={styles.previewAvatarWrap}>
                <LinearGradient colors={headerGradient} style={styles.previewAvatar}>
                  <FontAwesome6 name={KIND_ICON[profile.kind]} size={13} color="#FFFFFF" solid />
                </LinearGradient>
                <View style={styles.previewSeal}>
                  <FontAwesome6 name="circle-check" size={13} color={brandColors.success} solid />
                </View>
              </View>
              <FullText style={[styles.previewName, { color: colors.text }]} numberOfLines={1}>
                {profile.name}
              </FullText>
              <View style={[styles.previewTag, { backgroundColor: `${brandColors.success}1F` }]}>
                <FontAwesome6 name="shield-halved" size={9} color={brandColors.success} solid />
                <Text style={[styles.previewTagText, { color: brandColors.success }]}>{t('growth.trustedTag')}</Text>
              </View>
            </View>
          </View>

          <View style={styles.benefits}>
            {(['a', 'b', 'c'] as const).map((point) => (
              <View key={point} style={styles.benefit}>
                <View style={[styles.benefitIcon, { backgroundColor: `${brandColors.success}1A` }]}>
                  <FontAwesome6 name="check" size={10} color={brandColors.success} solid />
                </View>
                <Text style={[styles.benefitText, { color: colors.text }]}>{t(`growth.trustPoints.${point === 'c' ? `c_${profile.kind}` : point}`)}</Text>
              </View>
            ))}
          </View>

          {profile.status === 'removed' && profile.removedReason ? (
            <View style={[styles.notice, { backgroundColor: `${brandColors.error}12`, borderColor: `${brandColors.error}40` }]}>
              <FontAwesome6 name="triangle-exclamation" size={12} color={brandColors.error} solid />
              <Text style={[styles.noticeText, { color: colors.text }]}>{t('badge.removed', { reason: profile.removedReason })}</Text>
            </View>
          ) : null}

          {!badgesOn && !active ? (
            <Text style={[styles.splitText, { color: colors.textMuted }]}>{t('growth.badgeOff')}</Text>
          ) : (
            <Pressable
              onPress={() => {
                if (profile.eligible && !active) {
                  buyBadge(profile);
                  return;
                }
                showToast(
                  active
                    ? { variant: 'success', title: t('growth.alreadyTrustedTitle'), message: t('growth.alreadyTrustedMessage') }
                    : { variant: 'info', title: t('plans.badgeNotYet'), message: t(`badge.notEligible.${profile.kind}`) },
                );
              }}
              disabled={busy !== null}
              accessibilityRole="button"
              style={({ pressed }) => [styles.ctaWrap, { opacity: pressed ? 0.9 : 1 }]}
            >
              {active ? (
                <View style={[styles.cta, { backgroundColor: `${brandColors.success}18`, borderWidth: 1.5, borderColor: `${brandColors.success}66` }]}>
                  <FontAwesome6 name="circle-check" size={14} color={brandColors.success} solid />
                  <Text style={[styles.ctaText, { color: brandColors.success }]}>{trustCta}</Text>
                </View>
              ) : (
                <LinearGradient
                  colors={profile.eligible ? TRUST_GRADIENT : ['#94A3B8', '#94A3B8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cta}
                >
                  {busy === profile.profileId ? (
                    <LoadingIndicator size={18} dotSize={3} />
                  ) : (
                    <>
                      <FontAwesome6 name="shield-halved" size={14} color="#FFFFFF" solid />
                      <Text style={styles.ctaText}>{trustCta}</Text>
                    </>
                  )}
                </LinearGradient>
              )}
            </Pressable>
          )}
          {pending && profile.badgeId ? (
            <Pressable onPress={() => checkBadge(profile.badgeId!, false)} disabled={checking !== null} hitSlop={6} style={styles.checkLink}>
              {checking === profile.badgeId ? (
                <LoadingIndicator size={16} color={colors.primary} />
              ) : (
                <Text style={[styles.link, { color: colors.primary }]}>{t('subscribe.checkPaid')}</Text>
              )}
            </Pressable>
          ) : null}
        </View>

        {/* --- Boost --- */}
        <View style={[styles.poster, { backgroundColor: colors.surface, borderColor: `${colors.primary}55` }]}>
          <LinearGradient colors={BOOST_HERO} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.posterHero}>
            <View style={[styles.bubble, styles.bubbleA]} />
            <View style={[styles.bubble, styles.bubbleB]} />
            <FontAwesome6 name="rocket" size={84} color="rgba(255,255,255,0.12)" solid style={styles.posterMark} />
            <View style={styles.posterTop}>
              <View style={styles.sealRing}>
                <LinearGradient colors={['#60A5FA', '#1D4ED8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.seal}>
                  <FontAwesome6 name="rocket" size={22} color="#FFFFFF" solid />
                </LinearGradient>
              </View>
              <View style={styles.flex}>
                <Text style={styles.posterKicker}>{t('growth.boostKicker')}</Text>
                <Text style={styles.posterTitle}>{t('growth.boost')}</Text>
                <FullText style={styles.posterFor} numberOfLines={1}>
                  {profile.name}
                </FullText>
              </View>
              {current ? (
                <View style={[styles.posterPill, styles.posterPillOn]}>
                  <View style={styles.liveDot} />
                  <Text style={[styles.posterPillText, { color: '#1D4ED8' }]}>{t(`boost.status.${current.status}`)}</Text>
                </View>
              ) : boostFrom !== null ? (
                <View style={styles.posterPill}>
                  <FontAwesome6 name="tag" size={10} color="#FFFFFF" solid />
                  <Text style={styles.posterPillText}>{t('growth.boostFromShort', { amount: boostFrom })}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.posterLead}>{t('growth.boostDesc')}</Text>
          </LinearGradient>

          {current ? (
            // Running (or on its way): its numbers, a tap from the full details.
            <Pressable onPress={() => setDetails(current)} style={[styles.boostStats, { backgroundColor: `${colors.primary}0D`, borderColor: `${colors.primary}33` }]}>
              {[
                { icon: 'eye' as const, value: current.impressions, label: t('plans.boostViews') },
                { icon: 'hand-pointer' as const, value: current.clicks, label: t('plans.boostClicks') },
              ].map((stat) => (
                <View key={stat.label} style={styles.boostStat}>
                  <FontAwesome6 name={stat.icon} size={12} color={colors.primary} solid />
                  <Text style={[styles.boostValue, { color: colors.text }]}>{stat.value.toLocaleString('en-IN')}</Text>
                  <Text style={[styles.boostLabel, { color: colors.textMuted }]}>{stat.label}</Text>
                </View>
              ))}
              <FontAwesome6 name="chevron-right" size={12} color={colors.primary} solid />
            </Pressable>
          ) : (
            <View style={styles.benefits}>
              {(['a', 'b', 'c'] as const).map((point) => (
                <View key={point} style={styles.benefit}>
                  <View style={[styles.benefitIcon, { backgroundColor: `${colors.primary}1A` }]}>
                    <FontAwesome6 name="check" size={10} color={colors.primary} solid />
                  </View>
                  <Text style={[styles.benefitText, { color: colors.text }]}>{t(`growth.boostPoints.${point}`)}</Text>
                </View>
              ))}
            </View>
          )}

          <Pressable
            onPress={() => (current ? setDetails(current) : setBoosting({ kind: profile.kind, name: profile.name, profileId: profile.profileId }))}
            disabled={!current && !profile.eligible}
            accessibilityRole="button"
            style={({ pressed }) => [styles.ctaWrap, { opacity: !current && !profile.eligible ? 0.55 : pressed ? 0.9 : 1 }]}
          >
            <LinearGradient colors={BOOST_BUTTON} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
              <FontAwesome6 name={current ? 'chart-line' : 'rocket'} size={14} color="#FFFFFF" solid />
              <Text style={styles.ctaText}>
                {current ? t('growth.boostSeeNumbers') : boostFrom !== null ? t('growth.boostNow', { amount: boostFrom }) : t('growth.boostCta')}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </React.Fragment>
    );
  };

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
              <FullText style={[styles.cardTitle, { color: ink }]} numberOfLines={1}>
                {profile.name}
              </FullText>
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
                  <FullText style={styles.detailsSub} numberOfLines={1}>
                    {details.promoted?.name ?? ''} · {t(`boost.status.${details.status}`)}
                  </FullText>
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
  poster: { borderWidth: 1.5, borderRadius: 24, padding: 14, gap: 12, marginBottom: 14, overflow: 'hidden' },
  posterHero: { marginHorizontal: -14, marginTop: -14, padding: 16, gap: 12, overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  bubbleA: { width: 180, height: 180, right: -60, top: -90 },
  bubbleB: { width: 120, height: 120, left: -40, bottom: -70 },
  posterMark: { position: 'absolute', right: -8, bottom: -14, transform: [{ rotate: '-12deg' }] },
  posterTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sealRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  seal: { flex: 1, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  posterKicker: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)' },
  posterTitle: { fontFamily: fonts.semiBold, fontSize: 19, lineHeight: 24, color: '#FFFFFF' },
  posterFor: { ...typography.caption, fontSize: 12, color: 'rgba(255,255,255,0.88)' },
  posterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  posterPillOn: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  posterPillText: { fontFamily: fonts.semiBold, fontSize: 12, color: '#FFFFFF', includeFontPadding: false },
  posterLead: { ...typography.caption, fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.92)' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  preview: { borderRadius: 16, borderWidth: 1, padding: 10, gap: 8 },
  previewLabel: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewAvatarWrap: { width: 38, height: 38 },
  previewAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  previewSeal: { position: 'absolute', right: -3, bottom: -3, width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  previewName: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14, flex: 1 },
  previewTag: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 24, borderRadius: 12, paddingHorizontal: 9 },
  previewTagText: { fontFamily: fonts.semiBold, fontSize: 11, includeFontPadding: false },
  benefits: { gap: 9 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  benefitText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, flex: 1 },
  boostStats: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  boostStat: { flex: 1, gap: 2 },
  boostValue: { fontFamily: fonts.semiBold, fontSize: 18, lineHeight: 23 },
  boostLabel: { ...typography.caption, fontSize: 11 },
  ctaWrap: { borderRadius: 26, overflow: 'hidden' },
  cta: { height: 50, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 18 },
  ctaText: { fontFamily: fonts.semiBold, fontSize: 14.5, color: '#FFFFFF', includeFontPadding: false },
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
