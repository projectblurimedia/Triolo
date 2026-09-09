import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LoadingIndicator } from './LoadingIndicator';
import { fonts, headerGradient, typography } from '@/theme';

const RING_SIZE = 96;

interface UpdateOverlayProps {
  /** 0..1 — snap to 1 once the download is actually done, driving the "complete" state below. */
  progress: number;
}

/**
 * Full-screen overlay shown while an EAS OTA update downloads (see App.tsx's own
 * `expo-updates` wiring) — same "distinct full-screen moment" convention as
 * LogoutOverlay (the orbiting-dots motif at a larger scale), extended with a progress
 * bar/percentage since a download, unlike logout, has real duration a user benefits
 * from seeing tick forward. `expo-updates` doesn't expose real byte-level progress
 * through its JS API, so the caller (App.tsx) drives `progress` with a simulated ramp
 * during download and snaps it to 1 once the update is actually ready to apply.
 * Direct port of user-app's own copy of this component — same "no shared package"
 * convention as everything else duplicated across the two apps.
 */
export function UpdateOverlay({ progress }: UpdateOverlayProps) {
  const { t } = useTranslation();
  const isComplete = progress >= 1;

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.center}>
        <View style={styles.ring}>
          <View style={styles.orbit}>
            <LoadingIndicator size={RING_SIZE} dotSize={10} color="rgba(255, 255, 255, 0.85)" duration={1800} />
          </View>
          <View style={styles.mark}>
            <FontAwesome6 name={isComplete ? 'check' : 'cloud-arrow-down'} size={26} color="#FFFFFF" solid />
          </View>
        </View>

        <Text style={styles.title}>{t(isComplete ? 'common.updateCompleteTitle' : 'common.updatingAppTitle')}</Text>
        <Text style={styles.message}>{t(isComplete ? 'common.updateCompleteMessage' : 'common.updatingAppMessage')}</Text>

        {!isComplete ? (
          <>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  ring: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  orbit: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', marginBottom: 8, textAlign: 'center' },
  message: {
    ...typography.body,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginBottom: 20,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#FFFFFF' },
  progressText: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)', marginTop: 8 },
});
