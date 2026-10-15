import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useMyJobs } from '@/hooks/useJobs';
import { useShopOrders } from '@/hooks/useShopOrders';
import { ACTIVE_JOB_STATUSES } from '@/services/jobsService';
import { ACTIVE_SHOP_STATUSES, NEW_ORDER_STATUSES } from '@/services/shopOrdersService';
import { openJob } from '@/state/jobFocusStore';
import { openShopOrder } from '@/state/shopOrderFocusStore';
import { navigateToBookings } from '@/navigation/navigationRef';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

const PROBLEM_GRADIENT = ['#7C3AED', '#A78BFA'] as const;
const ORDER_GRADIENT = ['#0EA5E9', '#38BDF8'] as const;
const MAX_ROWS = 3;

interface Step {
  key: string;
  kind: 'job' | 'problem' | 'order';
  name: string;
  stepTitle: string;
  hint: string;
  createdAt: string;
  urgent: boolean;
  onPress: () => void;
}

/** A small pulsing dot — "this is live, waiting on you". */
function LiveDot({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.dotWrap}>
      <Animated.View
        style={[
          styles.dotRing,
          {
            backgroundColor: color,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
          },
        ]}
      />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

/**
 * Home's "Continue where you left off": every job or shop order that is mid-way (accepted,
 * on the way, waiting for a PIN, packing, out for delivery…) in one place at the top of Home,
 * each one tap from its step screen — no digging through Bookings → Active after the app was
 * closed or minimised. Renders nothing when nothing is in progress.
 */
export function ContinueSteps({ isShop }: { isShop: boolean }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const jobs = useMyJobs();
  const orders = useShopOrders(isShop);

  const skills = (keys: string[]) => keys.map((key) => t(`workerProfile.skills.${key}`)).join(', ');

  const steps: Step[] = [
    ...(jobs.data ?? [])
      .filter((job) => ACTIVE_JOB_STATUSES.includes(job.status))
      .map<Step>((job) => ({
        key: `job-${job.id}`,
        kind: job.problemPostId ? 'problem' : 'job',
        name: job.customerFullName,
        stepTitle: `${t(`job.status.${job.status}.title`)} · ${skills(job.skillCategories)}`,
        hint: t(`job.status.${job.status}.message`, { name: job.customerFullName }),
        createdAt: job.createdAt,
        // Waiting on the customer, not on you.
        urgent: job.status !== 'work_done',
        onPress: () => openJob(job.id),
      })),
    ...(isShop ? (orders.data ?? []) : [])
      .filter((order) => NEW_ORDER_STATUSES.includes(order.status) || ACTIVE_SHOP_STATUSES.includes(order.status))
      .map<Step>((order) => ({
        key: `order-${order.id}`,
        kind: 'order',
        name: order.customerFullName,
        stepTitle: `${t(`shopOrders.status.${order.status}.title`)} · ${t('continueSteps.itemCount', { count: order.items.length })}`,
        hint: t(`shopOrders.status.${order.status}.message`, { name: order.customerFullName }),
        createdAt: order.createdAt,
        urgent: order.status !== 'packed',
        onPress: () => openShopOrder(order.id),
      })),
  ].sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.createdAt.localeCompare(a.createdAt));

  if (steps.length === 0) return null;
  const shown = steps.slice(0, MAX_ROWS);
  const onlyOrders = steps.every((step) => step.kind === 'order');

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <LiveDot color={brandColors.pending} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('continueSteps.title')}</Text>
        {steps.length > MAX_ROWS ? (
          <Pressable onPress={() => navigateToBookings(onlyOrders ? 'orders' : 'jobs')} hitSlop={8}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>{t('continueSteps.seeAll', { count: steps.length })}</Text>
          </Pressable>
        ) : null}
      </View>

      {shown.map((step) => {
        const gradient = step.kind === 'order' ? ORDER_GRADIENT : step.kind === 'problem' ? PROBLEM_GRADIENT : headerGradient;
        const icon = step.kind === 'order' ? 'store' : step.kind === 'problem' ? 'clipboard-list' : 'bolt';
        return (
          <Pressable
            key={step.key}
            onPress={step.onPress}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: `${brandColors.pending}0A`,
                borderColor: `${brandColors.pending}99`,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
              <FontAwesome6 name={icon} size={17} color="#FFFFFF" solid />
            </LinearGradient>
            <View style={styles.text}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {step.name}
                </Text>
                <View style={[styles.pendingTag, { backgroundColor: `${brandColors.pending}1A` }]}>
                  <Text style={[styles.pendingText, { color: brandColors.pending }]}>{t('continueSteps.pending')}</Text>
                </View>
              </View>
              <Text style={[styles.step, { color: gradient[0] }]} numberOfLines={1}>
                {step.stepTitle}
              </Text>
              <Text style={[styles.hint, { color: colors.textMuted }]} numberOfLines={2}>
                {step.hint}
              </Text>
            </View>
            <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.go}>
              <Text style={styles.goText}>{t('continueSteps.continue')}</Text>
              <FontAwesome6 name="chevron-right" size={10} color="#FFFFFF" solid />
            </LinearGradient>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectionTitle: { ...typography.subheading, fontFamily: fonts.semiBold, flex: 1 },
  seeAll: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  dotWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  dotRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 10,
  },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 1 },
  name: { ...typography.body, fontFamily: fonts.semiBold, flexShrink: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pendingTag: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  pendingText: { fontFamily: fonts.semiBold, fontSize: 10 },
  step: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  hint: { ...typography.caption, fontSize: 11, lineHeight: 15 },
  go: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 8 },
  goText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 12 },
});
