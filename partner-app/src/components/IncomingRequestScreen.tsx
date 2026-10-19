import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingIndicator } from './LoadingIndicator';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

const ACCEPT_GRADIENT = ['#16A34A', '#22C55E'] as const;
const DISABLED_GRADIENT = ['#9CA3AF', '#B6BCC6'] as const;

export interface IncomingAction {
  label: string;
  icon: IconName;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Greyed right down (e.g. Decline while Accept is working). */
  dimmed?: boolean;
}

interface IncomingRequestScreenProps {
  visible: boolean;
  onRequestClose: () => void;
  /** Small caps label at the top, e.g. "NEW JOB REQUEST". */
  kicker: string;
  icon: IconName;
  /** 'loading' while the request is fetched, 'gone' when it was taken / withdrawn. */
  state: 'loading' | 'gone' | 'ready';
  goneTitle: string;
  goneMessage: string;
  /** The big figure on the gradient, e.g. "1.2 km" or "6 items". */
  headline?: string;
  headlineCaption?: string;
  personName?: string;
  personLine?: string | null;
  chips?: { icon: IconName; label: string }[];
  /** Extra rows inside the details card. */
  details?: ReactNode;
  decline: IncomingAction;
  accept: IncomingAction;
  /** When the request stops waiting (ms since epoch) — shows a countdown with a draining bar. */
  expiresAt?: number;
  /** How long it waits in total, for the bar's length. */
  windowMs?: number;
  /** Label for the countdown, e.g. "Respond within". */
  countdownLabel?: string;
}

function formatLeft(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function initialsOf(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.length === 1 ? parts[0][0].toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * The full-screen "something new came in" takeover (a Quick Book job, a shop order), like a
 * ride-hailing driver's request screen: a blue gradient top with a softly pulsing icon and the
 * one number that matters most, a card with who it is and what they need, and two big buttons.
 * Comes alive: a dashed ring turns around the pulsing icon, the card springs up into place, a
 * countdown shows how long is left to respond, and Accept breathes gently.
 */
export function IncomingRequestScreen({
  visible,
  onRequestClose,
  kicker,
  icon,
  state,
  goneTitle,
  goneMessage,
  headline,
  headlineCaption,
  personName,
  personLine,
  chips = [],
  details,
  decline,
  accept,
  expiresAt,
  windowMs,
  countdownLabel,
}: IncomingRequestScreenProps) {
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!visible) return;
    const loops = [
      Animated.loop(
        Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ),
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(
        Animated.sequence([
          Animated.timing(breathe, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(breathe, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    ];
    loops.forEach((loop) => loop.start());
    enter.setValue(0);
    Animated.spring(enter, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }).start();
    return () => {
      loops.forEach((loop) => loop.stop());
      pulse.setValue(0);
      spin.setValue(0);
      breathe.setValue(0);
    };
  }, [visible, pulse, spin, enter, breathe]);

  // A one-second clock for the countdown, only while it's on screen.
  useEffect(() => {
    if (!visible || !expiresAt) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [visible, expiresAt]);
  const leftMs = expiresAt ? expiresAt - now : 0;
  const leftShare = expiresAt && windowMs ? Math.max(0, Math.min(1, leftMs / windowMs)) : 0;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const acceptScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const cardStyle = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }],
  };

  const ring = (delay: number) => {
    const progress = Animated.modulo(Animated.add(pulse, delay), 1);
    return {
      opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
      transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 2.3] }) }],
    };
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onRequestClose} statusBarTranslucent>
      {visible ? <StatusBar style="light" /> : null}
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView bounces={false} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, { paddingTop: insets.top + 18 }]}
          >
            <View style={[styles.blob, styles.blobOne]} />
            <View style={[styles.blob, styles.blobTwo]} />
            <View style={styles.kicker}>
              <View style={styles.kickerDot} />
              <Text style={styles.kickerText}>{kicker}</Text>
            </View>

            <View style={styles.pulseWrap}>
              <Animated.View style={[styles.pulseRing, ring(0)]} />
              <Animated.View style={[styles.pulseRing, ring(0.5)]} />
              <Animated.View style={[styles.dashRing, { transform: [{ rotate }] }]}>
                <View style={styles.dashDot} />
              </Animated.View>
              <View style={styles.iconCircle}>
                <FontAwesome6 name={icon} size={30} color="#0055D3" solid />
              </View>
            </View>

            {state === 'ready' && headline ? (
              <>
                <Text style={styles.headline} numberOfLines={1} adjustsFontSizeToFit>
                  {headline}
                </Text>
                {headlineCaption ? <Text style={styles.headlineCaption}>{headlineCaption}</Text> : null}
              </>
            ) : null}

            {state === 'ready' && expiresAt ? (
              <View style={styles.countdown}>
                <View style={styles.countdownRow}>
                  <FontAwesome6 name="stopwatch" size={12} color="#FFFFFF" solid />
                  <Text style={styles.countdownText}>
                    {countdownLabel} <Text style={styles.countdownTime}>{formatLeft(leftMs)}</Text>
                  </Text>
                </View>
                <View style={styles.countdownTrack}>
                  <View style={[styles.countdownFill, { width: `${leftShare * 100}%` }]} />
                </View>
              </View>
            ) : null}
          </LinearGradient>

          <Animated.View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, cardStyle]}>
            {state === 'loading' ? (
              <View style={styles.cardCenter}>
                <LoadingIndicator color={colors.primary} />
              </View>
            ) : state === 'gone' ? (
              <View style={styles.cardCenter}>
                <View style={[styles.goneIcon, { backgroundColor: `${colors.textMuted}1A` }]}>
                  <FontAwesome6 name="circle-info" size={26} color={colors.textMuted} solid />
                </View>
                <Text style={[styles.goneTitle, { color: colors.text }]}>{goneTitle}</Text>
                <Text style={[styles.goneMessage, { color: colors.textMuted }]}>{goneMessage}</Text>
              </View>
            ) : (
              <>
                <View style={styles.personRow}>
                  <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                    <Text style={styles.avatarText}>{initialsOf(personName)}</Text>
                  </LinearGradient>
                  <View style={styles.personText}>
                    <Text style={[styles.personName, { color: colors.text }]} numberOfLines={1}>
                      {personName}
                    </Text>
                    {personLine ? (
                      <View style={styles.personLineRow}>
                        <FontAwesome6 name="location-dot" size={11} color={colors.textMuted} solid />
                        <Text style={[styles.personLine, { color: colors.textMuted }]} numberOfLines={1}>
                          {personLine}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                {chips.length > 0 ? (
                  <View style={styles.chipRow}>
                    {chips.map((chip) => (
                      <View
                        key={chip.label}
                        style={[styles.chip, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}33` }]}
                      >
                        <FontAwesome6 name={chip.icon} size={12} color={colors.primary} solid />
                        <Text style={[styles.chipText, { color: colors.primary }]} numberOfLines={1}>
                          {chip.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {details}
              </>
            )}
          </Animated.View>
        </ScrollView>

        <View style={[styles.actionRow, { paddingBottom: insets.bottom + 18, borderTopColor: colors.border }]}>
          <Pressable
            style={({ pressed }) => [
              styles.declineButton,
              {
                borderColor: `${brandColors.error}59`,
                backgroundColor: `${brandColors.error}0D`,
                opacity: decline.dimmed ? 0.35 : pressed ? 0.75 : 1,
              },
            ]}
            onPress={decline.onPress}
            disabled={decline.disabled}
            accessibilityRole="button"
            accessibilityLabel={decline.label}
          >
            {decline.loading ? (
              <LoadingIndicator color={brandColors.error} size={20} dotSize={4} />
            ) : (
              <>
                <FontAwesome6 name={decline.icon} size={16} color={brandColors.error} solid />
                <Text style={[styles.declineText, { color: brandColors.error }]}>{decline.label}</Text>
              </>
            )}
          </Pressable>
          <Animated.View style={[styles.acceptWrap, { transform: [{ scale: accept.disabled ? 1 : acceptScale }] }]}>
            <Pressable
              style={({ pressed }) => [styles.acceptPress, { opacity: pressed ? 0.85 : 1 }]}
              onPress={accept.onPress}
              disabled={accept.disabled}
              accessibilityRole="button"
              accessibilityLabel={accept.label}
            >
              {/* Can't be pressed (e.g. the job is gone): a solid grey button, never a see-through one. */}
              <LinearGradient
                colors={accept.disabled && !accept.loading ? DISABLED_GRADIENT : ACCEPT_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.acceptButton}
              >
                {accept.loading ? (
                  <LoadingIndicator size={22} dotSize={4.5} />
                ) : (
                  <>
                    <FontAwesome6 name={accept.icon} size={17} color="#FFFFFF" solid />
                    <Text style={styles.acceptText}>{accept.label}</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 20 },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 56,
    overflow: 'hidden',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.09)' },
  blobOne: { width: 240, height: 240, top: -90, right: -80 },
  blobTwo: { width: 150, height: 150, bottom: -60, left: -50 },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 30,
    paddingHorizontal: 13,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  kickerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  kickerText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 12, letterSpacing: 1, includeFontPadding: false },
  pulseWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  pulseRing: { position: 'absolute', width: 74, height: 74, borderRadius: 37, backgroundColor: '#FFFFFF' },
  iconCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  headline: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 40, lineHeight: 50, marginTop: 6 },
  headlineCaption: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.medium, fontSize: 14 },
  card: {
    marginTop: -34,
    marginHorizontal: 18,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#0B2A5B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  cardCenter: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  goneIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  goneTitle: { ...typography.subheading, fontFamily: fonts.semiBold, textAlign: 'center' },
  goneMessage: { ...typography.body, textAlign: 'center', lineHeight: 20 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 20 },
  personText: { flex: 1 },
  personName: { fontFamily: fonts.semiBold, fontSize: 19 },
  personLineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  personLine: { ...typography.caption, fontSize: 13, flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 36,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: '100%',
  },
  chipText: { fontFamily: fonts.semiBold, fontSize: 13.5, includeFontPadding: false, flexShrink: 1 },
  actionRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  declineButton: {
    flex: 1,
    height: 58,
    borderRadius: 18,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  declineText: { ...typography.subheading, fontFamily: fonts.semiBold, fontSize: 16 },
  // A soft green glow on iOS only: Android's elevation shadow shows through the button as a
  // dark block whenever it's see-through (fading in, or greyed out), so it has none there.
  acceptWrap: {
    flex: 1.4,
    borderRadius: 18,
    ...Platform.select({
      ios: { shadowColor: '#16A34A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12 },
      default: {},
    }),
  },
  acceptPress: { borderRadius: 18, overflow: 'hidden' },
  dashRing: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.55)',
  },
  dashDot: { position: 'absolute', top: -5, left: 51, width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ADE80' },
  countdown: { alignSelf: 'stretch', marginTop: 16, gap: 8 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  countdownText: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.medium, fontSize: 13 },
  countdownTime: { color: '#FFFFFF', fontFamily: fonts.semiBold },
  countdownTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
    marginHorizontal: 30,
  },
  countdownFill: { height: 5, borderRadius: 3, backgroundColor: '#4ADE80' },
  acceptButton: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  acceptText: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', fontSize: 17 },
});
