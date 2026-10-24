import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { WaitingTimeModal, WaitTimes, formatWait, useWaitTimes } from './WaitingTimeModal';
import { fonts, typography, useThemeColors } from '@/theme';

interface WaitCountdownProps {
  /** When the request was sent. */
  createdAt: string;
  /** Which of the customer's waiting times applies. */
  kind: keyof WaitTimes;
}

function formatLeft(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/**
 * How long a waiting request has left before it ends by itself (the customer's own Waiting
 * Time), as a live countdown with a draining bar — and Change, which opens Waiting Time right
 * here. A new time applies at once, also to this request.
 */
export function WaitCountdown({ createdAt, kind }: WaitCountdownProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { data: times } = useWaitTimes();
  const [now, setNow] = useState(Date.now());
  const [editVisible, setEditVisible] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!times) return null;
  const windowMs = times[kind] * 60_000;
  const leftMs = new Date(createdAt).getTime() + windowMs - now;
  const share = Math.max(0, Math.min(1, leftMs / windowMs));
  const almostUp = leftMs < 60_000;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: `${colors.primary}14` }]}>
          <FontAwesome6 name="hourglass-half" size={14} color={colors.primary} solid />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('waitCountdown.label')}</Text>
          <Text style={[styles.time, { color: almostUp ? colors.error : colors.text }]}>
            {leftMs > 0 ? formatLeft(leftMs) : t('waitCountdown.endingNow')}
          </Text>
        </View>
        <Pressable
          onPress={() => setEditVisible(true)}
          hitSlop={8}
          accessibilityRole="button"
          style={[styles.change, { borderColor: `${colors.primary}40`, backgroundColor: `${colors.primary}0D` }]}
        >
          <FontAwesome6 name="pen" size={11} color={colors.primary} solid />
          <Text style={[styles.changeText, { color: colors.primary }]}>{t('waitCountdown.change')}</Text>
        </Pressable>
      </View>
      <View style={[styles.track, { backgroundColor: `${colors.primary}14` }]}>
        <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: almostUp ? colors.error : colors.primary }]} />
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t('waitCountdown.hint', { time: formatWait(times[kind], t) })}
      </Text>
      <WaitingTimeModal visible={editVisible} onClose={() => setEditVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.caption, fontSize: 12 },
  time: { fontFamily: fonts.semiBold, fontSize: 20, lineHeight: 26 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12 },
  changeText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12, includeFontPadding: false },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  hint: { ...typography.caption, fontSize: 11.5, lineHeight: 16 },
});
