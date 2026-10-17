import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { clean } from '@/utils/place';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RadarPulse } from './RadarPulse';
import { ToastHost } from './ToastHost';
import { Button } from './Button';
import { SKILL_CATEGORIES } from '@/constants/categories';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { bookingsService, CustomerBooking } from '@/services/bookingsService';
import { bookingQueryKey } from '@/hooks/useBookings';
import { showToast } from '@/state/toastStore';
import { openBookingTracker } from '@/state/bookingTrackerStore';
import { ensureLocation } from '@/state/locationStore';

interface QuickBookModalProps {
  visible: boolean;
  onClose: () => void;
}

// Deliberately wide for now, per explicit instruction ("50km range cause testing purpose")
// — a real production default would likely be much smaller. The backend's own
// createQuickBookingSchema caps radiusKm at 50 too, so this is already at that ceiling.
const QUICK_BOOK_RADIUS_KM = 50;
// Lets the tracker finish fading in on top before this screen closes underneath it.
const MODAL_HANDOFF_MS = 350;
const GEOCODE_TIMEOUT_MS = 4000;

/** A readable address for the worker, from the phone's own (free) geocoder — best-effort, never blocks booking. */
async function addressFor(latitude: number, longitude: number): Promise<string | undefined> {
  try {
    const places = await Promise.race([
      Location.reverseGeocodeAsync({ latitude, longitude }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), GEOCODE_TIMEOUT_MS)),
    ]);
    const place = places?.[0];
    if (!place) return undefined;
    // No Plus Codes or pincode — just the words a worker can read (street, area, village).
    const parts = [place.name, place.street, place.district ?? place.subregion, place.city]
      .map(clean)
      .filter((part, index, all): part is string => !!part && all.indexOf(part) === index);
    return parts.join(', ').slice(0, 300) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Services menu's / Home's "Quick Book" — pick one or more skills, tap "Book Nearby", and
 * every verified worker within QUICK_BOOK_RADIUS_KM who has *all* of those skills gets a big,
 * high-priority push (see backend's modules/bookings). This screen only picks skills and sends
 * the request (radar while it does); it then hands over to the root-mounted
 * BookingTrackingModal, which follows the booking through the whole trip and can be reopened
 * any time from My Bookings or Home. A request that matched nobody is cancelled straight away
 * so it doesn't linger in history as "searching".
 */
export function QuickBookModal({ visible, onClose }: QuickBookModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!visible) return;
    setSelectedSkills([]);
    setSubmitting(false);
  }, [visible]);

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
      // Location must really be ON: Android still hands out a last-known position with location
      // switched off, which let a booking go out without it. ensureLocation() turns it on (or
      // explains why it can't) and only then returns a position.
      const coords = await ensureLocation();
      if (!coords) {
        showToast({ variant: 'error', title: t('location.requiredTitle'), message: t('location.requiredMessage') });
        setSubmitting(false);
        return;
      }
      const position = { coords };
      const locationAddress = await addressFor(position.coords.latitude, position.coords.longitude);
      const result = await bookingsService.createQuickBooking({
        skillCategories: selectedSkills,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        radiusKm: QUICK_BOOK_RADIUS_KM,
        locationAddress,
      });
      if (result.matchedWorkerCount === 0) {
        bookingsService.cancel(result.bookingRequestId).catch(() => {});
        showToast({ variant: 'info', title: t('quickBook.noWorkersTitle'), message: t('quickBook.noWorkersMessage') });
        setSubmitting(false);
        return;
      }
      // Seamless handoff: seed the tracker with the request we just created so it opens
      // straight onto the same radar (no spinner flash while its first poll runs), open it
      // on top first, and only then close this screen underneath it — opening and closing
      // two native modals in the same instant made the swap flicker on Android.
      const now = new Date().toISOString();
      const seeded: CustomerBooking = {
        id: result.bookingRequestId,
        status: 'broadcasting',
        skillCategories: selectedSkills,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        locationAddress: locationAddress ?? null,
        acceptedAt: null,
        startedAt: null,
        arrivedAt: null,
        pinVerifiedAt: null,
        workDoneAt: null,
        completedAt: null,
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
        workerRating: null,
        workerReview: null,
        problemPostId: null,
        quotationAmount: null,
        createdAt: now,
        worker: null,
        arrivalPin: null,
      };
      queryClient.setQueryData(bookingQueryKey(result.bookingRequestId), seeded);
      openBookingTracker(result.bookingRequestId);
      setTimeout(onClose, MODAL_HANDOFF_MS);
    } catch {
      showToast({ variant: 'error', title: t('common.errorTitle'), message: t('errors.generic') });
      setSubmitting(false);
    }
  };

  // The radar's centre shows what's being searched for: the chosen skill's own icon (bolt
  // for an electrician, faucet for a plumber…), or a general tools icon for several skills.
  const radarIcon =
    selectedSkills.length === 1
      ? (SKILL_CATEGORIES.find((skill) => skill.key === selectedSkills[0])?.icon ?? 'screwdriver-wrench')
      : 'screwdriver-wrench';

  const renderBody = () => {
    // Shown from the moment "Book Nearby" is tapped (GPS fix + creating the request), so the
    // radar starts immediately; the tracking screen continues it once the request is sent.
    if (submitting) {
      return (
        <View style={styles.centerBody}>
          <RadarPulse icon={radarIcon} />
          <Text style={[styles.stateTitle, styles.radarTitle, { color: colors.text }]}>{t('quickBook.searchingTitle')}</Text>
          <Text style={[styles.stateMessage, { color: colors.textMuted }]}>{t('quickBook.searchingMessage')}</Text>
          <View style={[styles.skillSummaryRow]}>
            {selectedSkills.map((key) => (
              <View key={key} style={[styles.summaryChip, { backgroundColor: `${colors.primary}16` }]}>
                <Text style={[styles.summaryChipText, { color: colors.primary }]}>{t(`workerProfile.skills.${key}`)}</Text>
              </View>
            ))}
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
  stateTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginTop: 16, marginBottom: 8, textAlign: 'center' },
  radarTitle: { marginTop: 28 },
  stateMessage: { ...typography.body, textAlign: 'center', lineHeight: 20 },
  skillSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 18 },
  summaryChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  summaryChipText: { ...typography.caption, fontFamily: fonts.medium },
});
