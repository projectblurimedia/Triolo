import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ScreenContainer } from '@/components/ScreenContainer';
import { PullToRefresh } from '@/components/PullToRefresh';
import { ProfileGrowth } from '@/components/ProfileGrowth';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { GoldCard, GoldShine, GOLD_BUTTON, GOLD_DEEP, GOLD_GRADIENT, GOLD_INK, GOLD_INK_SOFT } from '@/components/GoldCard';
import { useBoostInfo, useMyBadges, useMySubscription } from '@/hooks/useSubscription';
import { BadgeKind, PartnerPlan, planForKind, SUBSCRIPTION_MONTHS } from '@/services/subscriptionsService';
import { openSubscribe } from '@/state/subscribeStore';
import { formatDay } from '@/utils/formatDate';
import { fonts, typography, useThemeColors } from '@/theme';
import { FullText } from '@/components/FullText';

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

/** What each plan gives — services, shop and job posts each have their own. */
export const PLAN_PERKS: Record<PartnerPlan, { icon: IconName; key: string }[]> = {
  service: [
    { icon: 'bolt', key: 'plans.perks.service.first' },
    { icon: 'infinity', key: 'plans.perks.service.noLimit' },
    { icon: 'arrow-up-wide-short', key: 'plans.perks.service.top' },
    { icon: 'address-book', key: 'plans.perks.service.viewers' },
  ],
  shop: [
    { icon: 'infinity', key: 'plans.perks.shop.noLimit' },
    { icon: 'arrow-up-wide-short', key: 'plans.perks.shop.top' },
    { icon: 'address-book', key: 'plans.perks.shop.viewers' },
  ],
  job_post: [
    { icon: 'briefcase', key: 'plans.perks.job_post.freePosts' },
    { icon: 'address-book', key: 'plans.perks.job_post.viewers' },
    { icon: 'arrow-up-wide-short', key: 'plans.perks.job_post.top' },
  ],
  // Everything above, in one plan.
  all: [
    { icon: 'layer-group', key: 'plans.perks.all.everything' },
    { icon: 'bolt', key: 'plans.perks.service.first' },
    { icon: 'infinity', key: 'plans.perks.all.noLimit' },
    { icon: 'wallet', key: 'plans.perks.all.noFees' },
    { icon: 'address-book', key: 'plans.perks.all.viewers' },
    { icon: 'ban', key: 'plans.perks.noAds' },
  ],
};

export const PLAN_ICON: Record<PartnerPlan, IconName> = { service: 'screwdriver-wrench', shop: 'store', job_post: 'briefcase', all: 'layer-group' };
const KIND_ORDER: BadgeKind[] = ['service', 'business', 'job_post'];
const KIND_FOR_PLAN: Record<Exclude<PartnerPlan, 'all'>, BadgeKind> = { service: 'service', shop: 'business', job_post: 'job_post' };

/**
 * Plans tab (route "Grow"): one row of plans — Service, Shop, Job Post (only the sides the
 * partner has) and All in One (with more than one side). The chosen plan shows in a gold card,
 * then what it gives, its prices, what costs money without it, and that side's Trusted by
 * Triolo badge and Boost. Waits for everything before drawing, so nothing pops in late.
 */
export function GrowScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const queryClient = useQueryClient();
  const subscription = useMySubscription();
  const badges = useMyBadges();
  const profiles = badges.data?.profiles ?? [];
  const boostInfo = useBoostInfo(profiles.length > 0);
  const [refreshing, setRefreshing] = useState(false);
  const [pickedPlan, setPickedPlan] = useState<PartnerPlan | null>(null);
  const [pickedPostId, setPickedPostId] = useState<string | null>(null);

  const loading = subscription.isLoading || badges.isLoading || (profiles.length > 0 && boostInfo.isLoading);
  const sub = subscription.data;
  const kinds = KIND_ORDER.filter((value) => profiles.some((profile) => profile.kind === value));
  // The plans to choose from: each side the partner has, then All in One (two sides or more).
  const plans: PartnerPlan[] = [...kinds.map((value) => planForKind(value)), ...(kinds.length > 1 ? (['all'] as const) : [])];
  const plan: PartnerPlan | null = pickedPlan && plans.includes(pickedPlan) ? pickedPlan : (plans[0] ?? null);
  // The side whose badge and boost show (All in One: every side).
  const kind: BadgeKind | null = plan && plan !== 'all' ? KIND_FOR_PLAN[plan] : null;
  // Several job posts / shops: one at a time, picked by its work (Teacher, Cook…) or shop name.
  const posts = profiles.filter((profile) => profile.kind === kind && (kind === 'job_post' || kind === 'business'));
  const post = posts.find((profile) => profile.profileId === pickedPostId) ?? posts[0] ?? null;
  const postPicker =
    posts.length > 1 ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.postPickerRow} contentContainerStyle={styles.postPicker}>
        {posts.map((profile) => {
          const active = profile.profileId === post?.profileId;
          return (
            <Pressable
              key={profile.profileId}
              onPress={() => setPickedPostId(profile.profileId)}
              style={[
                styles.postChip,
                active ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.surface, borderColor: `${colors.primary}33` },
              ]}
            >
              <FontAwesome6 name={kind === 'business' ? 'store' : 'briefcase'} size={11} color={active ? '#FFFFFF' : colors.primary} solid />
              <FullText style={[styles.postChipText, { color: active ? '#FFFFFF' : colors.text }]} numberOfLines={1}>
                {profile.name}
              </FullText>
            </Pressable>
          );
        })}
      </ScrollView>
    ) : null;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['subscription'] }),
      queryClient.invalidateQueries({ queryKey: ['boosts'] }),
    ]).finally(() => setRefreshing(false));
  };

  // One chip per plan; only when there's more than one to choose from.
  const planChips =
    plans.length > 1 ? (
      <View style={[styles.planChoice, { borderColor: `${GOLD_DEEP}40` }]}>
        {plans.map((value) => {
          const active = plan === value;
          return (
            <Pressable key={value} onPress={() => setPickedPlan(value)} style={[styles.planChoiceOption, active ? { backgroundColor: GOLD_DEEP } : null]}>
              <FontAwesome6 name={PLAN_ICON[value]} size={11} color={active ? '#FFFFFF' : GOLD_DEEP} solid />
              <FullText style={[styles.planChoiceText, { color: active ? '#FFFFFF' : GOLD_DEEP }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {t(`plans.names.${value}`)}
              </FullText>
            </Pressable>
          );
        })}
      </View>
    ) : null;

  const cardHead = (icon: IconName, title: string, tone: string) => (
    <View style={styles.cardHead}>
      <View style={[styles.cardHeadIcon, { backgroundColor: `${tone}1F` }]}>
        <FontAwesome6 name={icon} size={13} color={tone} solid />
      </View>
      <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );

  const headStart = sub?.headStartSeconds ?? 30;
  const fees = sub?.fees ?? {};
  const limits = sub?.limits ?? { quickBook: null, quickOrder: null };

  /** Without this plan: the month's free Quick Book / Quick Order accepts and the small fees. */
  const withoutPlan = (plan: PartnerPlan): { icon: IconName; text: string }[] => {
    const lines: { icon: IconName; text: string }[] = [];
    const sides: ('service' | 'shop' | 'job_post')[] = plan === 'all' ? ['service', 'shop', 'job_post'] : [plan];
    for (const side of sides) {
      if (side === 'job_post') {
        if (fees.job_post > 0) lines.push({ icon: 'briefcase', text: t('plans.noPlan.jobPostFee', { amount: fees.job_post }) });
        if (fees.job_post_viewer > 0) lines.push({ icon: 'user-lock', text: t('plans.noPlan.jobPostViewer', { amount: fees.job_post_viewer }) });
        continue;
      }
      // Every accept counts; after the free ones each pays the fee (no limit: all free).
      const limit = side === 'service' ? limits.quickBook : limits.quickOrder;
      if (limit != null) {
        if (limit > 0) lines.push({ icon: 'hourglass-half', text: t(`plans.noPlan.limit.${side}`, { count: limit }) });
        if (fees.accept > 0) lines.push({ icon: 'handshake', text: t(limit > 0 ? 'plans.noPlan.after' : 'plans.noPlan.every', { amount: fees.accept }) });
      }
      if (fees.profile_viewer > 0 && (plan !== 'all' || side === 'service')) {
        lines.push({ icon: 'user-lock', text: t('plans.noPlan.profileViewer', { amount: fees.profile_viewer }) });
      }
    }
    return lines;
  };

  const renderPlan = (plan: PartnerPlan) => {
    if (!sub?.enabled) return null;
    const state = sub.plans?.[plan];
    const prices = state?.prices ?? sub.prices;
    const active = state?.active ?? null;
    const pending = state?.pending ?? null;
    const best = Math.max(...SUBSCRIPTION_MONTHS);
    const daysLeft = active ? Math.max(1, Math.ceil((new Date(active.endsAt).getTime() - Date.now()) / 86400000)) : 0;
    return (
      <>
        {/* The plan itself: gold, with its name, a line about it and one button. */}
        <GoldCard style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.crown}>
              <FontAwesome6 name="crown" size={18} color="#8A5300" solid />
            </View>
            <View style={styles.flex}>
              <Text style={styles.heroKicker}>{t(active ? 'plans.yourPlan' : 'plans.upgrade')}</Text>
              <Text style={styles.heroTitle}>{t(`plans.names.${plan}`)}</Text>
            </View>
            {active ? (
              <View style={styles.activePill}>
                <FontAwesome6 name="circle-check" size={11} color="#FFFFFF" solid />
                <Text style={styles.activePillText}>{t('plans.active')}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.heroText}>{active ? t('subscribe.activeUntil', { date: formatDay(active.endsAt) }) : t(`plans.hero.${plan}`)}</Text>
          <View style={styles.heroFoot}>
            <View style={styles.heroStat}>
              <FontAwesome6 name={active ? 'hourglass-half' : 'gift'} size={11} color={GOLD_INK} solid />
              <FullText style={styles.heroStatText} numberOfLines={1}>
                {active
                  ? t('plans.daysLeft', { count: daysLeft })
                  : t('plans.extra', { count: PLAN_PERKS[plan].length, amount: Math.round(prices['12'] / 12) })}
              </FullText>
            </View>
            {active ? null : (
              <Pressable onPress={() => openSubscribe(plan)} style={({ pressed }) => [styles.heroButton, { opacity: pressed ? 0.9 : 1 }]}>
                <Text style={styles.heroButtonText}>{t('subscribe.get')}</Text>
                <FontAwesome6 name="arrow-right" size={11} color="#FFE29A" solid />
              </Pressable>
            )}
          </View>
        </GoldCard>

        {/* What it gives, as tiles. */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: `${GOLD_DEEP}40` }]}>
          {cardHead('star', t('plans.whatYouGet'), GOLD_DEEP)}
          <View style={styles.perks}>
            {PLAN_PERKS[plan]
              // No head start set: that perk isn't offered.
              .filter((perk) => headStart > 0 || perk.key !== 'plans.perks.service.first')
              .map((perk) => (
              <View key={perk.key} style={[styles.perk, { backgroundColor: `${GOLD_DEEP}0F`, borderColor: `${GOLD_DEEP}2E` }]}>
                <LinearGradient colors={GOLD_BUTTON} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.perkIcon}>
                  <FontAwesome6 name={perk.icon} size={12} color="#FFFFFF" solid />
                </LinearGradient>
                <Text style={[styles.perkText, { color: colors.text }]}>{t(perk.key, { seconds: headStart })}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* The prices (only while there's no plan running). */}
        {active ? null : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {cardHead('tags', t('subscribe.choosePlan'), colors.primary)}
            <View style={styles.prices}>
              {SUBSCRIPTION_MONTHS.map((months) => {
                const amount = prices[String(months) as keyof typeof prices];
                const isBest = months === best;
                return (
                  <View key={months} style={styles.priceCol}>
                    <Pressable onPress={() => openSubscribe(plan)} style={({ pressed }) => [styles.priceWrap, isBest ? styles.priceWrapBest : null, { opacity: pressed ? 0.88 : 1 }]}>
                      {isBest ? (
                        <LinearGradient colors={GOLD_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.price, styles.priceBest]}>
                          <GoldShine />
                          <Text style={[styles.priceMonths, { color: GOLD_INK }]}>{t('subscribe.months', { count: months })}</Text>
                          <Text style={[styles.priceAmount, { color: GOLD_INK }]}>₹{amount}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={[styles.price, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1.5 }]}>
                          <Text style={[styles.priceMonths, { color: colors.textMuted }]}>{t('subscribe.months', { count: months })}</Text>
                          <Text style={[styles.priceAmount, { color: colors.text }]}>₹{amount}</Text>
                        </View>
                      )}
                    </Pressable>
                    {isBest ? (
                      <View style={styles.bestRibbon}>
                        <FontAwesome6 name="star" size={8} color="#FFFFFF" solid />
                        <Text style={styles.bestRibbonText}>{t('subscribe.best')}</Text>
                      </View>
                    ) : null}
                    <Text style={[styles.pricePer, { color: isBest ? GOLD_DEEP : colors.textMuted }]}>
                      {t('subscribe.perMonth', { amount: Math.round(amount / months) })}
                    </Text>
                  </View>
                );
              })}
            </View>
            {pending ? (
              <View style={[styles.pending, { backgroundColor: `${GOLD_DEEP}14`, borderColor: `${GOLD_DEEP}40` }]}>
                <FontAwesome6 name="clock" size={12} color={GOLD_DEEP} solid />
                <Text style={[styles.pendingText, { color: colors.text }]}>
                  {t('subscribe.pending', { count: pending.months, amount: pending.amount })}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {/* What it's like without the plan: the month's free accepts and the small fees. */}
        {!active && withoutPlan(plan).length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {cardHead('circle-info', t('plans.withoutPlan'), colors.primary)}
            {withoutPlan(plan).map((line) => (
              <View key={line.text} style={styles.noPlanRow}>
                <View style={[styles.noteIcon, { backgroundColor: `${colors.primary}14` }]}>
                  <FontAwesome6 name={line.icon} size={12} color={colors.primary} solid />
                </View>
                <Text style={[styles.noteText, { color: colors.text }]}>{line.text}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </>
    );
  };

  return (
    <ScreenContainer edges={['left', 'right']}>
      <PullToRefresh refreshing={refreshing} onRefresh={onRefresh}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          {loading ? (
            <View style={styles.loading}>
              <LoadingIndicator size={36} dotSize={5} color={colors.primary} />
            </View>
          ) : !plan ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}14` }]}>
                <FontAwesome6 name="crown" size={22} color={colors.primary} solid />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('grow.emptyTitle')}</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('grow.emptyMessage')}</Text>
            </View>
          ) : (
            <>
              {sub?.enabled ? planChips : null}
              {renderPlan(plan)}
              {/* The badge and the boost: two cards of their own (All in One: every side's). */}
              {postPicker}
              <ProfileGrowth
                boostInfo={boostInfo.data ?? null}
                kinds={kind ? [kind] : kinds}
                profileIds={kind && posts.length > 1 && post ? [post.profileId] : undefined}
                split
              />
            </>
          )}
        </ScrollView>
      </PullToRefresh>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  planChoice: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 4, gap: 4, marginBottom: 12 },
  planChoiceOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 36, borderRadius: 10, paddingHorizontal: 4 },
  noPlanRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // No font padding, so the name sits in the middle of the chip (Poppins draws high on Android).
  planChoiceText: { fontFamily: fonts.semiBold, fontSize: 12.5, lineHeight: 16, includeFontPadding: false, textAlignVertical: 'center' },
  flex: { flex: 1 },
  body: { paddingBottom: 120 },
  loading: { paddingVertical: 80, alignItems: 'center' },
  modeSwitch: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 3, gap: 4, marginBottom: 14 },
  modeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 11 },
  modeText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  postPicker: { gap: 8 },
  postPickerRow: { flexGrow: 0, marginBottom: 12 },
  postChip: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 36, borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 14, maxWidth: 220 },
  postChipText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 17, flexShrink: 1 },
  hero: { padding: 16, marginBottom: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  crown: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroKicker: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: GOLD_INK_SOFT },
  heroTitle: { ...typography.heading, fontFamily: fonts.semiBold, fontSize: 21, lineHeight: 27, color: GOLD_INK },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, borderRadius: 13, paddingHorizontal: 10, backgroundColor: '#15803D' },
  activePillText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11.5, color: '#FFFFFF' },
  heroText: { ...typography.body, fontSize: 13.5, lineHeight: 19, color: GOLD_INK, marginTop: 10 },
  heroFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  heroStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  heroStatText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12, color: GOLD_INK, flex: 1 },
  heroButton: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 36, borderRadius: 18, paddingHorizontal: 16, backgroundColor: GOLD_INK },
  heroButtonText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13, color: '#FFE29A' },
  card: { borderRadius: 20, borderWidth: 1.5, padding: 14, gap: 12, marginBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  cardHeadIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15 },
  perks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  perk: { width: '48%', flexGrow: 1, borderRadius: 14, borderWidth: 1, padding: 10, gap: 8 },
  perkIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  perkText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17 },
  prices: { flexDirection: 'row', gap: 7, paddingTop: 8 },
  priceCol: { flex: 1, alignItems: 'center', gap: 6 },
  priceWrap: { alignSelf: 'stretch', borderRadius: 14, overflow: 'hidden' },
  // The best value stands out: gold, a gold rim, and a little taller.
  priceWrapBest: { borderWidth: 2, borderColor: GOLD_DEEP, marginTop: -6 },
  price: { alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 12, gap: 2 },
  priceBest: { paddingVertical: 15, borderRadius: 12 },
  bestRibbon: {
    position: 'absolute',
    top: -16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 8,
    backgroundColor: '#15803D',
  },
  bestRibbonText: { fontFamily: fonts.semiBold, fontSize: 9.5, lineHeight: 12, letterSpacing: 0.4, color: '#FFFFFF', textTransform: 'uppercase' },
  bestTag: {
    position: 'absolute',
    top: 3,
    color: '#FFFFFF',
    fontFamily: fonts.semiBold,
    fontSize: 8.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  priceMonths: { ...typography.caption, fontSize: 10.5 },
  priceAmount: { fontFamily: fonts.semiBold, fontSize: 16, lineHeight: 21 },
  pricePer: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10.5 },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 10 },
  pendingText: { ...typography.caption, fontSize: 12, lineHeight: 16, flex: 1 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 12 },
  noteIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  noteText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, flex: 1 },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { ...typography.subheading, fontFamily: fonts.semiBold },
  emptyText: { ...typography.body, textAlign: 'center', paddingHorizontal: 24 },
});
