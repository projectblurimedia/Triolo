import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors as brandColors, fonts, typography, useThemeColors } from '@/theme';

interface PaymentChoiceProps {
  paid: boolean;
  onChange: (paid: boolean) => void;
}

/**
 * At handover (with the customer's PIN): did they pay? Paid is chosen by default; Not paid is for
 * nearby customers the shop lets pay later — it shows as "Not paid" in Activity until marked paid.
 */
export function PaymentChoice({ paid, onChange }: PaymentChoiceProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const option = (value: boolean) => {
    const active = paid === value;
    const tone = value ? brandColors.success : brandColors.error;
    return (
      <Pressable
        key={String(value)}
        onPress={() => onChange(value)}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        style={[
          styles.option,
          { borderColor: active ? tone : colors.border, backgroundColor: active ? `${tone}12` : colors.background },
        ]}
      >
        <View style={[styles.radio, { borderColor: active ? tone : colors.textMuted }]}>
          {active ? <View style={[styles.dot, { backgroundColor: tone }]} /> : null}
        </View>
        <FontAwesome6 name={value ? 'circle-check' : 'clock'} size={13} color={active ? tone : colors.textMuted} solid />
        <Text style={[styles.optionText, { color: active ? tone : colors.text }]}>{t(value ? 'payment.paid' : 'payment.notPaid')}</Text>
      </Pressable>
    );
  };
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{t('payment.question')}</Text>
      <View style={styles.row}>{[true, false].map(option)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 8 },
  label: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  row: { flexDirection: 'row', gap: 10 },
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  optionText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
});
