import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

export type NearbySearchMode = 'worker' | 'business';

interface NearbySearchModalProps {
  visible: boolean;
  onClose: () => void;
  mode: NearbySearchMode;
}

/**
 * Opened from Home's menu ("Nearby Workers" / "Nearby Shops") — full-screen search UI,
 * same chrome pattern as WorkerProfileModal/BusinessProfileModal (gradient header, left
 * back button). Always the constant brand-blue `headerGradient`, for both modes — per
 * explicit instruction, this screen never uses `SHOP_GRADIENT` (the orange Business
 * capability color used elsewhere, e.g. BusinessProfileCard/Modal), even for the shops
 * mode; do not reintroduce it here without being asked. The Worker/Business discovery
 * module (radius search over the lat/lng already captured on each profile) isn't built
 * yet (see .cloud/project-context.md, Pending Modules item 4) — the search box is real
 * and typeable, but results are a coming-soon placeholder for now, same honesty as
 * Services/Bazaar's own placeholders. Swap the body for a real result list once that
 * module's API exists; the search input's `query` state is already wired and ready to
 * drive that call.
 */
export function NearbySearchModal({ visible, onClose, mode }: NearbySearchModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const isWorker = mode === 'worker';

  const handleClose = () => {
    setQuery('');
    onClose();
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
                {t(isWorker ? 'nearbySearch.workersTitle' : 'nearbySearch.shopsTitle')}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {t(isWorker ? 'nearbySearch.workersSubtitle' : 'nearbySearch.shopsSubtitle')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FontAwesome6 name="magnifying-glass" size={15} color={colors.textMuted} solid />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t(isWorker ? 'nearbySearch.searchWorkersPlaceholder' : 'nearbySearch.searchShopsPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            returnKeyType="search"
          />
        </View>

        <View style={styles.body}>
          <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}1A` }]}>
            <FontAwesome6 name="location-dot" size={22} color={colors.primary} solid />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('nearbySearch.comingSoonTitle')}</Text>
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>
            {t(isWorker ? 'nearbySearch.comingSoonWorkersMessage' : 'nearbySearch.comingSoonShopsMessage')}
          </Text>
        </View>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 16,
  },
  searchInput: { flex: 1, ...typography.body, padding: 0 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginBottom: 8, textAlign: 'center' },
  emptyMessage: { ...typography.body, textAlign: 'center', lineHeight: 20 },
});
