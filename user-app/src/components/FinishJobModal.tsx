import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { STAR_COLOR } from './RatingStars';
import { fonts, typography, useThemeColors } from '@/theme';

const FINISH_GRADIENT = ['#16A34A', '#22C55E'] as const;

interface FinishJobModalProps {
  visible: boolean;
  workerName: string | null;
  loading: boolean;
  onConfirm: (rating: number, review: string) => void;
  onCancel: () => void;
}

/**
 * "Mark as Finished" for a Your Problems job or a Quick Book booking — the customer confirms the work is done and
 * rates the worker 1–5 stars (required — ratings are what the Services tab's Top Rated
 * sorting runs on) with an optional short review. Same centered-card shell as ConfirmModal.
 */
export function FinishJobModal({ visible, workerName, loading, onConfirm, onCancel }: FinishJobModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');

  useEffect(() => {
    if (visible) {
      setRating(0);
      setReview('');
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={loading ? undefined : onCancel}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <LinearGradient colors={FINISH_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconCircle}>
            <FontAwesome6 name="circle-check" size={26} color="#FFFFFF" solid />
          </LinearGradient>
          <Text style={[styles.title, { color: colors.text }]}>{t('yourProblems.finishConfirmTitle')}</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>{t('yourProblems.finishConfirmMessage')}</Text>

          <Text style={[styles.rateLabel, { color: colors.text }]}>
            {workerName ? t('yourProblems.rateWorkerNamed', { name: workerName }) : t('yourProblems.rateWorker')}
          </Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => setRating(star)}
                hitSlop={6}
                accessibilityLabel={t('yourProblems.starsLabel', { count: star })}
              >
                <FontAwesome6 name="star" size={32} color={star <= rating ? STAR_COLOR : colors.border} solid />
              </Pressable>
            ))}
          </View>

          <TextInput
            style={[styles.review, { borderColor: colors.border, color: colors.text }]}
            value={review}
            onChangeText={setReview}
            maxLength={300}
            multiline
            textAlignVertical="top"
            placeholder={t('yourProblems.reviewPlaceholder')}
            placeholderTextColor={colors.textMuted}
          />

          <View style={styles.actions}>
            <Pressable style={[styles.cancelButton, { borderColor: colors.border }]} onPress={onCancel} disabled={loading}>
              <Text style={[styles.cancelText, { color: colors.text }]}>{t('common.cancel')}</Text>
            </Pressable>
            <View style={styles.confirmWrap}>
              <Button
                label={t('yourProblems.markFinished')}
                onPress={() => onConfirm(rating, review.trim())}
                loading={loading}
                disabled={rating === 0}
                gradient={FINISH_GRADIENT}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  card: { borderRadius: 20, padding: 22, alignItems: 'center' },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.subheading, fontFamily: fonts.semiBold, marginTop: 14, textAlign: 'center' },
  message: { ...typography.caption, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  rateLabel: { ...typography.body, fontFamily: fonts.medium, marginTop: 18 },
  stars: { flexDirection: 'row', gap: 10, marginTop: 10 },
  review: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 70, marginTop: 16, ...typography.body, fontSize: 13 },
  actions: { flexDirection: 'row', alignSelf: 'stretch', gap: 10, marginTop: 18, alignItems: 'center' },
  cancelButton: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelText: { ...typography.body, fontFamily: fonts.medium },
  confirmWrap: { flex: 1.4 },
});
