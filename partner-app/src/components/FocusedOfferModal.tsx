import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { headerGradient, fonts, typography, useThemeColors } from '@/theme';
import { LoadingIndicator } from './LoadingIndicator';
import { PendingOffer } from '@/services/bookingOffersService';

interface FocusedOfferModalProps {
  visible: boolean;
  offer: PendingOffer | null;
  /** `undefined` while the offers list hasn't loaded yet at all; `true` once it has loaded
   * and this specific offer genuinely isn't in it (taken, declined, or expired elsewhere). */
  notFound: boolean;
  accepting: boolean;
  onAccept: () => void;
  onClose: () => void;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(1, Math.round(meters))}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Opened when a Quick Book notification's body (not an Accept/Reject action button) is
 * tapped — deliberately shows just this one job with a single, primary Accept action, per
 * explicit request ("showing only accept button only"), rather than dropping the worker into
 * the general Bookings list to go find it themselves. Declining is still reachable from the
 * notification's own action button or the list view — this focused view's whole point is a
 * fast, single-purpose "yes, take it" path.
 */
export function FocusedOfferModal({ visible, offer, notFound, accepting, onAccept, onClose }: FocusedOfferModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <Pressable style={styles.closeButton} onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
            <FontAwesome6 name="xmark" size={16} color={colors.textMuted} solid />
          </Pressable>

          {!offer ? (
            notFound ? (
              <>
                <View style={[styles.iconCircle, { backgroundColor: `${colors.textMuted}1A` }]}>
                  <FontAwesome6 name="circle-info" size={26} color={colors.textMuted} solid />
                </View>
                <Text style={[styles.title, { color: colors.text }]}>{t('bookings.offerGoneTitle')}</Text>
                <Text style={[styles.message, { color: colors.textMuted }]}>{t('bookings.offerGoneMessage')}</Text>
              </>
            ) : (
              <View style={styles.loadingWrap}>
                <LoadingIndicator color={colors.primary} />
              </View>
            )
          ) : (
            <>
              <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconCircle}>
                <FontAwesome6 name="bolt" size={26} color="#FFFFFF" solid />
              </LinearGradient>
              <Text style={[styles.title, { color: colors.text }]}>{t('bookings.newJobTitle')}</Text>
              <View style={[styles.distancePill, { backgroundColor: `${colors.primary}16` }]}>
                <FontAwesome6 name="location-dot" size={12} color={colors.primary} solid />
                <Text style={[styles.distanceText, { color: colors.primary }]}>
                  {t('bookings.distanceAway', { distance: formatDistance(offer.distanceMeters) })}
                </Text>
              </View>
              <View style={styles.tagRow}>
                {offer.skillCategories.map((key) => (
                  <View key={key} style={[styles.tag, { backgroundColor: `${colors.primary}14` }]}>
                    <Text style={[styles.tagText, { color: colors.primary }]}>{t(`workerProfile.skills.${key}`)}</Text>
                  </View>
                ))}
              </View>

              <Pressable style={styles.acceptButton} onPress={onAccept} disabled={accepting}>
                <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.acceptGradient}>
                  {accepting ? (
                    <LoadingIndicator size={18} dotSize={3.5} />
                  ) : (
                    <>
                      <FontAwesome6 name="check" size={14} color="#FFFFFF" solid />
                      <Text style={styles.acceptText}>{t('bookings.accept')}</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  card: { width: '100%', maxWidth: 400, borderRadius: 20, padding: 24, alignItems: 'center' },
  closeButton: { position: 'absolute', top: 14, right: 14, padding: 6 },
  loadingWrap: { paddingVertical: 30 },
  iconCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { ...typography.subheading, fontFamily: fonts.semiBold, marginBottom: 12, textAlign: 'center' },
  message: { ...typography.body, textAlign: 'center' },
  distancePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginBottom: 12 },
  distanceText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 22 },
  tag: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { ...typography.caption, fontFamily: fonts.medium },
  acceptButton: { width: '100%', borderRadius: 12, overflow: 'hidden' },
  acceptGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, gap: 8 },
  acceptText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF', fontSize: 16 },
});
