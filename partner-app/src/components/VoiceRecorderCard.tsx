import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { VoiceMessage } from './VoiceMessage';
import { MAX_VOICE_SECONDS as MAX_LIST_VOICE_SECONDS, RecordedVoice as PrepareListVoice } from '@/utils/voice';
import { showToast } from '@/state/toastStore';
import { formatVoiceLength } from '@/utils/voice';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

/*
 * (Copied between user-app and partner-app — keep in sync; here it records the bill's voice message.)
 */

/**
 * The list editor's voice message: record what you want in your own words (up to three
 * minutes), listen back, delete or record again. It goes to the shop with the list.
 */
export function VoiceRecorderCard({
  voice,
  onChange,
  onBeforeRecord,
  startSignal,
  compact = false,
  onRecordingChange,
}: {
  voice: PrepareListVoice | null;
  onChange: (voice: PrepareListVoice | null) => void;
  /** Called before recording starts (e.g. to stop speech-to-text, which uses the same mic). */
  onBeforeRecord?: () => void;
  /** A new number starts recording (from a button elsewhere). */
  startSignal?: number;
  /** No heading, and nothing at all until there's a recording (the editor has its own card to start one). */
  compact?: boolean;
  /** Told when a recording starts and ends (the screen can hide its other options meanwhile). */
  onRecordingChange?: (recording: boolean) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [starting, setStarting] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const stopping = useRef(false);

  const recording = state.isRecording;
  useEffect(() => {
    onRecordingChange?.(recording);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);
  const elapsed = Math.floor(state.durationMillis / 1000);

  useEffect(() => {
    if (!recording) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  const stop = async (keep: boolean) => {
    if (stopping.current) return;
    stopping.current = true;
    try {
      const seconds = Math.round(recorder.currentTime || state.durationMillis / 1000);
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => undefined);
      const uri = recorder.uri;
      if (!keep || !uri) return;
      if (seconds < 1) {
        showToast({ variant: 'info', title: t('voice.tooShortTitle'), message: t('voice.tooShortMessage') });
        return;
      }
      onChange({ uri, seconds: Math.min(seconds, MAX_LIST_VOICE_SECONDS) });
    } catch {
      showToast({ variant: 'error', title: t('voice.failedTitle'), message: t('voice.failedMessage') });
    } finally {
      stopping.current = false;
    }
  };

  // The longest a message can be: it stops and keeps itself.
  useEffect(() => {
    if (recording && elapsed >= MAX_LIST_VOICE_SECONDS) void stop(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, elapsed]);

  // Nothing to clean up on leaving: the recorder hook releases the recorder itself (which ends an
  // unfinished recording). Touching it here, after that release, threw and blanked the app.

  // Another part of the screen (the editor's Record card) can start a recording.
  const lastSignal = useRef(startSignal);
  useEffect(() => {
    if (startSignal === undefined || startSignal === lastSignal.current) return;
    lastSignal.current = startSignal;
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSignal]);

  const start = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        showToast({ variant: 'error', title: t('prepareList.micPermissionTitle'), message: t('prepareList.micPermissionMessage') });
        return;
      }
      onBeforeRecord?.();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      showToast({ variant: 'error', title: t('voice.failedTitle'), message: t('voice.failedMessage') });
    } finally {
      setStarting(false);
    }
  };

  const ring = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
  };

  if (compact && !recording && !voice) return null;

  return (
    <View style={[styles.card, compact && styles.compact, { borderColor: `${colors.primary}26` }, !compact && { backgroundColor: colors.surface }]}>
      {compact ? null : (
      <View style={styles.head}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
          <FontAwesome6 name="microphone" size={15} color="#FFFFFF" solid />
        </LinearGradient>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: colors.text }]}>{t('voice.recordTitle')}</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('voice.recordHint')}</Text>
        </View>
      </View>
      )}

      {recording ? (
        <View style={[styles.recordingRow, { backgroundColor: `${brandColors.error}10`, borderColor: `${brandColors.error}40` }]}>
          <View style={styles.dotWrap}>
            <Animated.View style={[styles.dotRing, { backgroundColor: brandColors.error }, ring]} />
            <View style={[styles.dot, { backgroundColor: brandColors.error }]} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.recordingText, { color: colors.text }]}>{t('voice.recording')}</Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {formatVoiceLength(elapsed)} / {formatVoiceLength(MAX_LIST_VOICE_SECONDS)}
            </Text>
          </View>
          <Pressable onPress={() => void stop(false)} hitSlop={8} style={[styles.smallButton, { borderColor: colors.border }]}>
            <FontAwesome6 name="xmark" size={14} color={colors.textMuted} solid />
          </Pressable>
          <Pressable onPress={() => void stop(true)} accessibilityRole="button" accessibilityLabel={t('voice.stop')}>
            <View style={[styles.stop, { backgroundColor: brandColors.error }]}>
              <View style={styles.stopSquare} />
            </View>
          </Pressable>
        </View>
      ) : voice ? (
        <>
          <VoiceMessage uri={voice.uri} seconds={voice.seconds} onDelete={() => onChange(null)} />
          <Pressable onPress={start} style={styles.again} hitSlop={6}>
            <FontAwesome6 name="rotate-right" size={12} color={colors.primary} solid />
            <Text style={[styles.againText, { color: colors.primary }]}>{t('voice.recordAgain')}</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={start}
          disabled={starting}
          style={({ pressed }) => [
            styles.recordButton,
            { borderColor: `${brandColors.error}55`, backgroundColor: `${brandColors.error}0D`, opacity: pressed || starting ? 0.8 : 1 },
          ]}
        >
          <View style={[styles.recordDot, { backgroundColor: brandColors.error }]}>
            <FontAwesome6 name="microphone" size={14} color="#FFFFFF" solid />
          </View>
          <Text style={[styles.recordText, { color: colors.text }]}>{t('voice.tapToRecord')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 12, marginTop: 12 },
  compact: { padding: 0, borderWidth: 0, backgroundColor: 'transparent', marginTop: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  title: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  hint: { ...typography.caption, fontSize: 12, lineHeight: 17 },
  recordButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 16, borderWidth: 1 },
  recordDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  recordText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  dotWrap: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  dotRing: { position: 'absolute', width: 22, height: 22, borderRadius: 11 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  recordingText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  smallButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stop: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  stopSquare: { width: 16, height: 16, borderRadius: 3, backgroundColor: '#FFFFFF' },
  again: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6, paddingVertical: 2 },
  againText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13 },
});
