import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from './Button';
import { GlassBackdrop, GlassCard } from './Glass';
import { ToastHost } from './ToastHost';
import { useAdGate } from './Ads';
import { addressFor } from './QuickBookModal';
import { SKILL_CATEGORIES } from '@/constants/categories';
import { bookingsService } from '@/services/bookingsService';
import { WorkerNearbyResult } from '@/services/workersService';
import { ensureLocation } from '@/state/locationStore';
import { openBookingTracker } from '@/state/bookingTrackerStore';
import { showToast } from '@/state/toastStore';
import { askForLocation } from '@/utils/ensureLocationOn';
import { firstName } from '@/utils/firstName';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

interface BookWorkerModalProps {
  worker: WorkerNearbyResult | null;
  onClose: () => void;
  /** Called once the request is sent (the tracker opens on top), so the profile can close too. */
  onBooked: () => void;
}

/**
 * "Book This Worker" from a worker's profile: pick the work, then Send. Only this worker is
 * asked — personally, with their own notification — and once they accept it's the same trip
 * as Quick Book (live tracking, PIN, rating). Location is asked for on Send, then a local
 * business's ad (when one is running) while the button spins, then the request goes.
 */
export function BookWorkerModal({ worker, onClose, onBooked }: BookWorkerModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const preparing = useRef(false);
  const { adLoading, waitForAd } = useAdGate(!!worker);

  // The work this worker does; one kind is chosen for you.
  const skills = worker ? worker.skillCategories : [];
  useEffect(() => {
    if (!worker) return;
    setSelected(worker.skillCategories.length === 1 ? [worker.skillCategories[0]] : []);
    setSending(false);
  }, [worker]);

  if (!worker) return null;
  const name = firstName(worker.accountFullName);

  const labelOf = (key: string) =>
    key === 'other' && worker.otherSkillDescription ? worker.otherSkillDescription : t(`workerProfile.skills.${key}`);

  const toggle = (key: string) =>
    setSelected((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));

  const send = async () => {
    if (selected.length === 0 || sending || preparing.current) return;
    preparing.current = true;
    try {
      // Location first (the worker comes here), then the ad while the button spins.
      if (!(await askForLocation())) return;
      if (!(await waitForAd())) return;
    } finally {
      preparing.current = false;
    }
    setSending(true);
    try {
      const here = await ensureLocation();
      if (!here) {
        showToast({ variant: 'error', title: t('location.requiredTitle'), message: t('location.requiredMessage') });
        setSending(false);
        return;
      }
      const locationAddress = await addressFor(here.latitude, here.longitude);
      const result = await bookingsService.createDirectBooking({
        workerId: worker.id,
        skillCategories: selected,
        latitude: here.latitude,
        longitude: here.longitude,
        locationAddress,
      });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      openBookingTracker(result.bookingRequestId);
      onBooked();
    } catch (error) {
      showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) });
      setSending(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GlassBackdrop onPress={sending ? undefined : onClose} style={styles.center}>
        <GlassCard style={styles.card}>
          <View style={styles.head}>
            <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headIcon}>
              <FontAwesome6 name="user-check" size={16} color="#FFFFFF" solid />
            </LinearGradient>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.text }]}>{t('directBook.title', { name })}</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('directBook.subtitle', { name })}</Text>
            </View>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>{t('directBook.chooseWork')}</Text>
          <ScrollView style={styles.skillsScroll} contentContainerStyle={styles.skills} showsVerticalScrollIndicator={false}>
            {skills.map((key) => {
              const active = selected.includes(key);
              const icon = SKILL_CATEGORIES.find((entry) => entry.key === key)?.icon ?? 'screwdriver-wrench';
              return (
                <Pressable key={key} onPress={() => toggle(key)} disabled={sending} accessibilityState={{ selected: active }}>
                  {active ? (
                    <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
                      <FontAwesome6 name={icon as never} size={12} color="#FFFFFF" solid />
                      <Text style={[styles.chipText, { color: '#FFFFFF' }]}>{labelOf(key)}</Text>
                      <FontAwesome6 name="check" size={11} color="#FFFFFF" solid />
                    </LinearGradient>
                  ) : (
                    <View style={[styles.chip, { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }]}>
                      <FontAwesome6 name={icon as never} size={12} color={colors.textMuted} solid />
                      <Text style={[styles.chipText, { color: colors.text }]}>{labelOf(key)}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={[styles.note, { backgroundColor: `${colors.primary}0F` }]}>
            <FontAwesome6 name="bell" size={12} color={colors.primary} solid />
            <Text style={[styles.noteText, { color: colors.text }]}>{t('directBook.note', { name })}</Text>
          </View>

          <Button label={t('directBook.send')} onPress={send} loading={sending || adLoading} disabled={selected.length === 0} />
          <Pressable onPress={onClose} disabled={sending} style={styles.cancel} hitSlop={6}>
            <Text style={[styles.cancelText, { color: colors.textMuted }]}>{t('common.cancel')}</Text>
          </Pressable>
        </GlassCard>
      </GlassBackdrop>
      <ToastHost />
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { justifyContent: 'center', paddingHorizontal: 22 },
  card: { borderRadius: 24, padding: 20 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  headIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.subheading, fontFamily: fonts.semiBold },
  subtitle: { ...typography.caption, marginTop: 2 },
  label: { ...typography.body, fontFamily: fonts.semiBold, marginBottom: 10 },
  skillsScroll: { maxHeight: 180 },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, paddingHorizontal: 14, borderRadius: 19 },
  chipText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 13 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12, marginTop: 16, marginBottom: 16 },
  noteText: { ...typography.caption, flex: 1, lineHeight: 18 },
  cancel: { alignSelf: 'center', marginTop: 12, paddingVertical: 4 },
  cancelText: { ...typography.body, fontFamily: fonts.medium },
});
