import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

/*
 * (Copied between user-app and partner-app — keep in sync.)
 */

export interface StackStep {
  key: string;
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  name: string;
  stepTitle: string;
  hint: string;
  action: string;
  onPress: () => void;
  /** A status pill in place of "Pending" (e.g. Completed, In progress). */
  tag?: { label: string; color: string };
}

// Cards peeking out under the front one, like a stack of iPhone notifications.
const PEEK_CARDS = 2;
const PEEK_OFFSET = 9;
const PEEK_SHRINK = 0.05;
// Lets the list screen fade out before the step's own screen opens.
const HANDOFF_MS = 250;

/** A small pulsing dot — "this is live". */
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

function StepCard({
  step,
  onPress,
  compact,
  slim,
  accent = brandColors.pending,
}: {
  step: StackStep;
  onPress: () => void;
  compact?: boolean;
  slim?: boolean;
  accent?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const tag = step.tag ?? { label: t('continueSteps.pending'), color: brandColors.pending };
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        slim ? styles.cardSlim : null,
        { backgroundColor: colors.surface, borderColor: `${accent}99`, opacity: pressed ? 0.92 : 1 },
      ]}
      accessibilityRole="button"
    >
      <View style={[StyleSheet.absoluteFill, styles.cardTint, { backgroundColor: `${accent}0A` }]} />
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.icon, slim ? styles.iconSlim : null]}>
        <FontAwesome6 name={step.icon} size={slim ? 14 : 17} color="#FFFFFF" solid />
      </LinearGradient>
      <View style={styles.text}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {step.name}
          </Text>
          <View style={[styles.pendingTag, { backgroundColor: `${tag.color}1A` }]}>
            <Text style={[styles.pendingText, { color: tag.color }]} numberOfLines={1}>
              {tag.label}
            </Text>
          </View>
        </View>
        <Text style={[styles.step, { color: headerGradient[0] }]} numberOfLines={1}>
          {step.stepTitle}
        </Text>
        {step.hint && !slim ? (
          <Text style={[styles.hint, { color: colors.textMuted }]} numberOfLines={compact ? 1 : 2}>
            {step.hint}
          </Text>
        ) : null}
      </View>
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.go, slim ? styles.goSlim : null]}>
        <Text style={[styles.goText, slim ? styles.goTextSlim : null]}>{step.action}</Text>
        <FontAwesome6 name="chevron-right" size={10} color="#FFFFFF" solid />
      </LinearGradient>
    </Pressable>
  );
}

/**
 * "Continue where you left off" shown as a stack: the newest step in front and up to two
 * smaller cards peeking out underneath (like stacked iPhone notifications), so many steps
 * never push the rest of Home down. One step opens straight away; with more, tapping the stack
 * opens a separate screen listing every one, each a tap from its own screen.
 */
export function StepStack({
  title,
  steps,
  style,
  minimized = false,
  accent = brandColors.pending,
  live = true,
  icon = 'clock-rotate-left',
  hideMore = false,
}: {
  title: string;
  steps: StackStep[];
  style?: StyleProp<ViewStyle>;
  /** A slim stack: one line per card (no hint), smaller icon, title and button. */
  minimized?: boolean;
  /** Border colour of the cards (default: the amber "waiting" colour). */
  accent?: string;
  /** A pulsing dot by the title (things under way); off for a plain history stack. */
  live?: boolean;
  /** The heading's icon when not live. */
  icon?: React.ComponentProps<typeof FontAwesome6>['name'];
  /** Leave out the "+N more — tap to see all" line (the stack itself still opens the list). */
  hideMore?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [listOpen, setListOpen] = useState(false);
  const [frontHeight, setFrontHeight] = useState(0);

  if (steps.length === 0) return null;
  const front = steps[0];
  const behind = steps.slice(1, 1 + PEEK_CARDS);
  const stacked = steps.length > 1;

  const openStep = (step: StackStep) => {
    setListOpen(false);
    setTimeout(step.onPress, HANDOFF_MS);
  };

  return (
    <View style={[styles.section, style]}>
      <View style={[styles.headerRow, minimized ? styles.headerRowSlim : null]}>
        {live ? <LiveDot color={accent} /> : <FontAwesome6 name={icon} size={13} color={accent} solid />}
        <Text style={[styles.sectionTitle, minimized ? styles.sectionTitleSlim : null, { color: colors.text }]}>{title}</Text>
        {stacked ? (
          <View style={[styles.countPill, { backgroundColor: `${colors.primary}14` }]}>
            <Text style={[styles.countText, { color: colors.primary }]}>{steps.length}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ paddingBottom: behind.length * PEEK_OFFSET }}>
        {/* The cards behind, smaller and lower, drawn first so the front card covers them. */}
        {frontHeight > 0
          ? behind
              .map((step, index) => {
                const depth = index + 1;
                return (
                  <View
                    key={step.key}
                    pointerEvents="none"
                    style={[
                      styles.peek,
                      {
                        height: frontHeight,
                        backgroundColor: colors.surface,
                        borderColor: `${accent}${depth === 1 ? '66' : '40'}`,
                        opacity: depth === 1 ? 0.9 : 0.7,
                        transform: [{ translateY: depth * PEEK_OFFSET }, { scaleX: 1 - depth * PEEK_SHRINK }],
                      },
                    ]}
                  />
                );
              })
              .reverse()
          : null}
        <View onLayout={(event) => setFrontHeight(event.nativeEvent.layout.height)}>
          <StepCard
            step={front}
            onPress={stacked ? () => setListOpen(true) : front.onPress}
            compact={stacked}
            slim={minimized}
            accent={accent}
          />
        </View>
      </View>
      {stacked && !hideMore ? (
        <Pressable onPress={() => setListOpen(true)} hitSlop={6} style={styles.moreRow}>
          <Text style={[styles.moreText, { color: colors.textMuted }]}>
            {t('continueSteps.more', { count: steps.length - 1 })}
          </Text>
        </Pressable>
      ) : null}

      <Modal visible={listOpen} transparent animationType="fade" onRequestClose={() => setListOpen(false)} statusBarTranslucent>
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
          <LinearGradient
            colors={headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.header, { paddingTop: insets.top + 14 }]}
          >
            <Pressable
              style={styles.backButton}
              onPress={() => setListOpen(false)}
              accessibilityLabel={t('common.close')}
              hitSlop={8}
            >
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {t('continueSteps.allSubtitle', { count: steps.length })}
              </Text>
            </View>
          </LinearGradient>
          <ScrollView
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            {steps.map((step) => (
              <StepCard key={step.key} step={step} onPress={() => openStep(step)} accent={accent} />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { marginTop: 18, marginBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectionTitle: { ...typography.subheading, fontFamily: fonts.semiBold, flex: 1 },
  countPill: { minWidth: 26, height: 22, borderRadius: 11, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: fonts.semiBold, fontSize: 12 },
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
    overflow: 'hidden',
  },
  cardTint: { borderRadius: 18 },
  cardSlim: { paddingVertical: 9, paddingHorizontal: 10, gap: 10, borderRadius: 16 },
  iconSlim: { width: 36, height: 36, borderRadius: 12 },
  goSlim: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 12 },
  goTextSlim: { fontSize: 11 },
  headerRowSlim: { marginBottom: 8 },
  sectionTitleSlim: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15 },
  peek: { position: 'absolute', left: 0, right: 0, top: 0, borderRadius: 18, borderWidth: 1.5 },
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
  moreRow: { alignSelf: 'center', marginTop: 8 },
  moreText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 12 },
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 16 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  headerSubtitle: { ...typography.caption, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  list: { padding: 16, gap: 12 },
});
