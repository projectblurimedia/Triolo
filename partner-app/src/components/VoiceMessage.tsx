import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { formatVoiceLength } from '@/utils/voice';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

const BARS = 26;

/** The same uri always draws the same wave (it's decoration, not the real sound). */
export function waveHeights(seed: string, count = BARS): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Array.from({ length: count }, (_, index) => {
    hash = (hash * 1103515245 + 12345) | 0;
    const random = ((hash >>> 16) & 0x7fff) / 0x7fff;
    // A gentle swell in the middle, like speech.
    const swell = Math.sin((index / (count - 1)) * Math.PI);
    return 0.25 + 0.75 * Math.min(1, random * 0.7 + swell * 0.45);
  });
}

/*
 * (Copied between user-app and partner-app — keep in sync.)
 */

/**
 * A voice message of a list: play / pause, a wave that fills as it plays, and the time — shown
 * wherever the list is (the list editor, sending it, the order). `onDelete` adds a remove button.
 */
export function VoiceMessage({
  uri,
  seconds,
  onDelete,
  style,
}: {
  uri: string;
  seconds?: number | null;
  onDelete?: () => void;
  style?: object;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const heights = useMemo(() => waveHeights(uri), [uri]);

  // Back to the start once it ends, ready to play again.
  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  const duration = status.duration > 0 ? status.duration : (seconds ?? 0);
  const progress = duration > 0 ? Math.min(1, status.currentTime / duration) : 0;
  const loading = status.playing && status.isBuffering;

  const toggle = () => {
    if (status.playing) player.pause();
    else {
      if (duration > 0 && status.currentTime >= duration - 0.2) player.seekTo(0);
      player.play();
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: `${colors.primary}0D`, borderColor: `${colors.primary}33` }, style]}>
      <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={t(status.playing ? 'voice.pause' : 'voice.play')} hitSlop={6}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.play}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <FontAwesome6 name={status.playing ? 'pause' : 'play'} size={16} color="#FFFFFF" solid style={status.playing ? null : styles.playNudge} />
          )}
        </LinearGradient>
      </Pressable>
      <View style={styles.middle}>
        <View style={styles.labelRow}>
          <FontAwesome6 name="microphone" size={11} color={colors.primary} solid />
          <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
            {t('voice.title')}
          </Text>
        </View>
        <View style={styles.wave}>
          {heights.map((height, index) => (
            <View
              key={index}
              style={[
                styles.bar,
                { height: 4 + height * 18, backgroundColor: index / heights.length < progress ? colors.primary : `${colors.primary}40` },
              ]}
            />
          ))}
        </View>
      </View>
      <Text style={[styles.time, { color: colors.textMuted }]}>
        {status.playing || status.currentTime > 0 ? formatVoiceLength(status.currentTime) : formatVoiceLength(duration)}
      </Text>
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('voice.delete')} style={styles.delete}>
          <FontAwesome6 name="trash" size={14} color={colors.error} solid />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  play: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  playNudge: { marginLeft: 3 },
  middle: { flex: 1, gap: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13 },
  // Thin, evenly spaced bars (wide ones looked like stripes).
  wave: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 22, overflow: 'hidden' },
  bar: { width: 3, borderRadius: 1.5 },
  time: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12.5, minWidth: 34, textAlign: 'right' },
  delete: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
