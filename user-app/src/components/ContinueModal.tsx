import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ContinueSteps } from './ContinueSteps';
import { useActivityCounts } from '@/hooks/useActivityCounts';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

/** Home menu → Continue where you left off: every booking and order still going, one tap away. */
export function ContinueModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const activity = useActivityCounts();
  const count = activity.services + activity.bazaar;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel={t('common.close')} hitSlop={8}>
            <FontAwesome6 name="chevron-left" size={16} color="#FFFFFF" solid />
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.headerTitle}>{t('continueSteps.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('continueSteps.menuHint')}</Text>
          </View>
        </LinearGradient>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
          {count > 0 ? (
            // Every card one by one — this screen is the full list already.
            <ContinueSteps expanded />
          ) : (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}14` }]}>
                <FontAwesome6 name="mug-hot" size={24} color={colors.primary} solid />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('continueSteps.emptyTitle')}</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('continueSteps.emptyText')}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 16 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 18 },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  body: { padding: 16 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 16, gap: 10 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...typography.subheading, fontFamily: fonts.semiBold, textAlign: 'center' },
  emptyText: { ...typography.body, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
