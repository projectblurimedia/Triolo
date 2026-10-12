import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { RadarPulse } from './RadarPulse';
import { ToastHost } from './ToastHost';
import { Button } from './Button';
import { SKILL_CATEGORIES } from './WorkerProfileModal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { bookingsService } from '@/services/bookingsService';
import { showToast } from '@/state/toastStore';

interface QuickBookModalProps {
  visible: boolean;
  onClose: () => void;
}

// Deliberately wide for now, per explicit instruction ("50km range cause testing purpose")
// — a real production default would likely be much smaller. The backend's own
// createQuickBookingSchema caps radiusKm at 50 too, so this is already at that ceiling.
const QUICK_BOOK_RADIUS_KM = 50;
// Fast enough that "first accept wins" reads as close to real-time to the requester without
// hammering the serverless function — same order of magnitude as partner-app's own
// useNotifications() polling interval.
const STATUS_POLL_MS = 3000;
const LAST_KNOWN_MAX_AGE_MS = 2 * 60 * 1000;
const LAST_KNOWN_MAX_ACCURACY_M = 500;

type Stage =
  | { kind: 'selecting' }
  | { kind: 'broadcasting'; bookingRequestId: string }
  | { kind: 'accepted'; workerName: string; skillCategories: string[] };

/**
 * Services menu's "Quick Book" — pick one or more skills, tap "Book Nearby", and every
 * verified worker within QUICK_BOOK_RADIUS_KM who has *all* of those skills (not just one)
 * gets a big, high-priority push (see backend's modules/bookings). Whoever accepts first
 * wins; this screen just polls GET /bookings/:id (STATUS_POLL_MS) while broadcasting and
 * flips to a success state the moment `status` becomes 'accepted'. No "My Bookings" history
 * yet (that's still the separate, not-yet-built drawer item) — closing this modal mid-search
 * abandons tracking that specific request, though the broadcast itself keeps running
 * server-side; a worker can still accept it, just with nothing here watching for it anymore.
 */
export function QuickBookModal({ visible, onClose }: QuickBookModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const accentColor = colors.primary;
  const [stage, setStage] = useState<Stage>({ kind: 'selecting' });
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setStage({ kind: 'selecting' });
    setSelectedSkills([]);
  }, [visible]);

  const bookingRequestId = stage.kind === 'broadcasting' ? stage.bookingRequestId : null;
  const { data: status } = useQuery({
    queryKey: ['quickBookStatus', bookingRequestId],
    queryFn: () => bookingsService.getStatus(bookingRequestId as string),
    enabled: bookingRequestId !== null,
    refetchInterval: STATUS_POLL_MS,
  });

  useEffect(() => {
    if (status?.status === 'accepted' && stage.kind === 'broadcasting') {
      setStage({
        kind: 'accepted',
        workerName: status.acceptedWorkerFullName ?? '',
        skillCategories: status.acceptedWorkerSkillCategories ?? [],
      });
    }
  }, [status, stage.kind]);

  const toggleSkill = (key: string) => {
    setSelectedSkills((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const handleClose = () => {
    onClose();
  };

  const handleBookNearby = async () => {
    if (selectedSkills.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        showToast({ variant: 'error', title: t('quickBook.locationDeniedTitle'), message: t('quickBook.locationDeniedMessage') });
        return;
      }
      // A fresh GPS fix can take several seconds and was most of the wait before workers got
      // notified. A recent last-known fix (≤2 min old, ≤500m accuracy) is plenty for a
      // 50km broadcast radius, so use it when available and only wait for a fresh fix
      // (balanced accuracy, not high) when there isn't one.
      const position =
        (await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS, requiredAccuracy: LAST_KNOWN_MAX_ACCURACY_M })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const result = await bookingsService.createQuickBooking({
        skillCategories: selectedSkills,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        radiusKm: QUICK_BOOK_RADIUS_KM,
      });
      if (result.matchedWorkerCount === 0) {
        showToast({ variant: 'info', title: t('quickBook.noWorkersTitle'), message: t('quickBook.noWorkersMessage') });
        return;
      }
      setStage({ kind: 'broadcasting', bookingRequestId: result.bookingRequestId });
    } catch {
      showToast({ variant: 'error', title: t('common.errorTitle'), message: t('errors.generic') });
    } finally {
      setSubmitting(false);
    }
  };

  // The radar's centre shows what's being searched for: the chosen skill's own icon (bolt
  // for an electrician, faucet for a plumber…), or a general tools icon for several skills.
  const radarIcon =
    selectedSkills.length === 1
      ? (SKILL_CATEGORIES.find((skill) => skill.key === selectedSkills[0])?.icon ?? 'screwdriver-wrench')
      : 'screwdriver-wrench';

  const skillLabelList = (keys: string[]) => keys.map((key) => t(`workerProfile.skills.${key}`)).join(', ');

  const renderBody = () => {
    // Shown from the moment "Book Nearby" is tapped (`submitting` — GPS fix + creating the
    // request) through the whole broadcast, so the radar starts immediately instead of
    // after a plain button spinner.
    if (submitting || stage.kind === 'broadcasting') {
      return (
        <View style={styles.centerBody}>
          <RadarPulse icon={radarIcon} />
          <Text style={[styles.stateTitle, styles.radarTitle, { color: colors.text }]}>{t('quickBook.searchingTitle')}</Text>
          <Text style={[styles.stateMessage, { color: colors.textMuted }]}>{t('quickBook.searchingMessage')}</Text>
          <View style={[styles.skillSummaryRow]}>
            {selectedSkills.map((key) => (
              <View key={key} style={[styles.summaryChip, { backgroundColor: `${accentColor}16` }]}>
                <Text style={[styles.summaryChipText, { color: accentColor }]}>{t(`workerProfile.skills.${key}`)}</Text>
              </View>
            ))}
          </View>
          <Pressable style={styles.cancelLink} onPress={handleClose}>
            <Text style={[styles.cancelLinkText, { color: colors.textMuted }]}>{t('quickBook.cancelSearch')}</Text>
          </Pressable>
        </View>
      );
    }

    if (stage.kind === 'accepted') {
      return (
        <View style={styles.centerBody}>
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.successIcon}>
            <FontAwesome6 name="circle-check" size={30} color="#FFFFFF" solid />
          </LinearGradient>
          <Text style={[styles.stateTitle, { color: colors.text }]}>
            {t('quickBook.acceptedTitle', { name: stage.workerName || t('common.appName') })}
          </Text>
          <Text style={[styles.stateMessage, { color: colors.textMuted }]}>
            {t('quickBook.acceptedMessage', { skills: skillLabelList(stage.skillCategories) })}
          </Text>
          <View style={styles.doneButtonWrap}>
            <Button label={t('common.done')} onPress={handleClose} />
          </View>
        </View>
      );
    }

    const orderedSkills = [...SKILL_CATEGORIES].sort(
      (a, b) => Number(selectedSkills.includes(b.key)) - Number(selectedSkills.includes(a.key)),
    );

    return (
      <>
        <ScrollView contentContainerStyle={styles.selectBody} keyboardShouldPersistTaps="handled">
          <Text style={[styles.skillsLabel, { color: colors.text }]}>{t('quickBook.skillsLabel')}</Text>
          <View style={styles.chipRow}>
            {orderedSkills.map((skill) => {
              const isActive = selectedSkills.includes(skill.key);
              return (
                <Pressable key={skill.key} onPress={() => toggleSkill(skill.key)}>
                  {isActive ? (
                    <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
                      <FontAwesome6 name={skill.icon} size={13} color="#FFFFFF" solid />
                      <Text style={[styles.chipLabel, { color: '#FFFFFF' }]}>{t(`workerProfile.skills.${skill.key}`)}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.chip, styles.chipInactive, { borderColor: colors.border }]}>
                      <FontAwesome6 name={skill.icon} size={13} color={colors.textMuted} solid />
                      <Text style={[styles.chipLabel, { color: colors.text }]}>{t(`workerProfile.skills.${skill.key}`)}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <View style={[styles.bookButtonWrap, { borderTopColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
          <Button
            label={t('quickBook.bookNearby')}
            onPress={handleBookNearby}
            loading={submitting}
            disabled={selectedSkills.length === 0}
          />
        </View>
      </>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 14 }]}
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={handleClose} accessibilityLabel={t('common.cancel')} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.titleGroup}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {t('quickBook.title')}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {t('quickBook.subtitle')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {renderBody()}
        {/* The app-root ToastHost sits under this native Modal — render one here so
            location / no-workers / error toasts are actually visible. */}
        <ToastHost />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  titleGroup: { marginLeft: 14, flex: 1 },
  headerTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', lineHeight: 20 },
  headerSubtitle: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)', lineHeight: 14, marginTop: 2 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectBody: { padding: 20, paddingBottom: 32 },
  skillsLabel: { ...typography.body, fontFamily: fonts.semiBold, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipInactive: { borderWidth: 1 },
  chipLabel: { ...typography.body, fontFamily: fonts.medium, fontSize: 13 },
  bookButtonWrap: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
  centerBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  stateTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginTop: 16, marginBottom: 8, textAlign: 'center' },
  radarTitle: { marginTop: 28 },
  stateMessage: { ...typography.body, textAlign: 'center', lineHeight: 20 },
  skillSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 18 },
  summaryChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  summaryChipText: { ...typography.caption, fontFamily: fonts.medium },
  cancelLink: { marginTop: 28, padding: 8 },
  cancelLinkText: { ...typography.body, fontFamily: fonts.medium },
  doneButtonWrap: { width: '100%', marginTop: 28 },
});
