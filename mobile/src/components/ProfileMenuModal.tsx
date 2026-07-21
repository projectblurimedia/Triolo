import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FontAwesome6 } from '@expo/vector-icons';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import { Button } from './Button';
import { fonts, typography, useThemeColors } from '@/theme';
import { useLogout, useUpdateAccountLanguage } from '@/hooks/useAuthMutations';

const CLOSE_BUTTON_SIZE = 36;

interface ProfileMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Bottom-sheet triggered from Profile's header menu icon — holds language, theme, and logout. */
export function ProfileMenuModal({ visible, onClose }: ProfileMenuModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const logout = useLogout();
  const updateLanguage = useUpdateAccountLanguage();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.text }]}>{t('profile.menuTitle')}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel={t('common.cancel')}
              style={[styles.closeButton, { backgroundColor: colors.background, borderColor: colors.border }]}
            >
              <FontAwesome6 name="xmark" size={16} color={colors.textMuted} solid />
            </Pressable>
          </View>

          <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIcon, { backgroundColor: `${colors.primary}20` }]}>
                <FontAwesome6 name="language" size={16} color={colors.primary} solid />
              </View>
              <Text style={[styles.label, { color: colors.text }]}>{t('settings.language')}</Text>
            </View>
            {/* Persists locally immediately; also synced to the account so it follows the user to a new device. */}
            <LanguageSwitcher onChange={(language) => updateLanguage.mutate(language)} />
          </View>

          <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIcon, { backgroundColor: `${colors.primary}20` }]}>
                <FontAwesome6 name="palette" size={16} color={colors.primary} solid />
              </View>
              <Text style={[styles.label, { color: colors.text }]}>{t('settings.theme')}</Text>
            </View>
            <ThemeSwitcher />
          </View>

          <Button
            label={t('common.logout')}
            onPress={() => {
              onClose();
              logout.mutate();
            }}
            loading={logout.isPending}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128, 128, 128, 0.4)',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { ...typography.subheading, fontFamily: fonts.semiBold },
  closeButton: {
    width: CLOSE_BUTTON_SIZE,
    height: CLOSE_BUTTON_SIZE,
    borderRadius: CLOSE_BUTTON_SIZE / 2,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    marginBottom: 16,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { ...typography.body, fontFamily: fonts.semiBold },
});
