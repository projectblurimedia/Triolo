import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { fonts, typography, useThemeColors } from '@/theme';

interface VerificationBadgeProps {
  status: string;
}

/** Small status pill shared by WorkerProfileCard/BusinessProfileCard — the same three verification_status values from the backend, colored/labeled consistently wherever a profile's trust state is shown. */
export function VerificationBadge({ status }: VerificationBadgeProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  const config =
    status === 'verified'
      ? { color: colors.success, icon: 'circle-check' as const, labelKey: 'verification.verified' }
      : status === 'rejected'
        ? { color: colors.error, icon: 'circle-xmark' as const, labelKey: 'verification.rejected' }
        : { color: colors.warning, icon: 'circle-exclamation' as const, labelKey: 'verification.pending' };

  return (
    <View style={[styles.badge, { backgroundColor: `${config.color}1a` }]}>
      <FontAwesome6 name={config.icon} size={10} color={config.color} solid />
      <Text style={[styles.text, { color: config.color }]}>{t(config.labelKey)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 3,
  },
  text: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10 },
});
