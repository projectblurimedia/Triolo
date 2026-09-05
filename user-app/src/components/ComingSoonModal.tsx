import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, typography, useThemeColors } from '@/theme';

interface ComingSoonModalProps {
  visible: boolean;
  onClose: () => void;
  gradient: readonly [string, string];
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  title: string;
  subtitle: string;
  comingSoonTitle: string;
  message: string;
}

/**
 * Full-screen "coming soon" placeholder — same chrome as `NearbySearchModal` (gradient
 * header, left `chevron-left` back button) minus the search bar, so tapping any not-yet-
 * built drawer item (Quick Book, Post a Problem, My Bookings, ...) opens a real screen
 * instead of a transient toast, matching the experience "Nearby Workers"/"Nearby Shops"
 * already have. `gradient`/`icon` are per-item so each drawer entry keeps its own color
 * identity through to this screen instead of flattening back to one shared look.
 */
export function ComingSoonModal({
  visible,
  onClose,
  gradient,
  icon,
  title,
  subtitle,
  comingSoonTitle,
  message,
}: ComingSoonModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 14 }]}
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel={t('common.cancel')} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.titleGroup}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={[styles.emptyIcon, { backgroundColor: `${gradient[0]}1A` }]}>
            <FontAwesome6 name={icon} size={22} color={gradient[0]} solid />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{comingSoonTitle}</Text>
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{message}</Text>
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
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { ...typography.subheading, fontFamily: fonts.semiBold, marginBottom: 8, textAlign: 'center' },
  emptyMessage: { ...typography.body, textAlign: 'center', lineHeight: 20 },
});
