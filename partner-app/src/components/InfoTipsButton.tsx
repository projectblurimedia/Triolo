import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { GlassBackdrop, GlassCard } from './Glass';
import { fonts, typography, useThemeColors } from '@/theme';

export interface InfoTip {
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  text: string;
}

interface InfoTipsButtonProps {
  title: string;
  tips: InfoTip[];
}

/**
 * A small "Info" pill at the top right of a form. The explanations that used to sit between the
 * fields (what the form is for, why a photo helps, how delivery is charged…) live in the card it
 * opens, so the form itself stays clean.
 */
export function InfoTipsButton({ title, tips }: InfoTipsButtonProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.pill, { borderColor: `${colors.primary}40`, backgroundColor: `${colors.primary}10` }]}
        hitSlop={8}
        accessibilityLabel={title}
      >
        <FontAwesome6 name="circle-info" size={13} color={colors.primary} solid />
        <Text style={[styles.pillText, { color: colors.primary }]}>{t('infoTips.button')}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <GlassBackdrop onPress={() => setOpen(false)} style={styles.center}>
          <GlassCard style={styles.card}>
            <View style={styles.head}>
              <View style={[styles.headIcon, { backgroundColor: `${colors.primary}1A` }]}>
                <FontAwesome6 name="lightbulb" size={16} color={colors.primary} solid />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            </View>
            {tips.map((tip) => (
              <View key={tip.text} style={styles.tip}>
                <View style={[styles.tipIcon, { backgroundColor: `${colors.primary}12` }]}>
                  <FontAwesome6 name={tip.icon} size={12} color={colors.primary} solid />
                </View>
                <Text style={[styles.tipText, { color: colors.text }]}>{tip.text}</Text>
              </View>
            ))}
            <View style={styles.action}>
              <Button label={t('infoTips.gotIt')} onPress={() => setOpen(false)} />
            </View>
          </GlassCard>
        </GlassBackdrop>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'flex-end', marginBottom: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  pillText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12.5, includeFontPadding: false },
  center: { justifyContent: 'center', paddingHorizontal: 24 },
  card: { borderRadius: 22, padding: 20 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  headIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.subheading, fontFamily: fonts.semiBold, flex: 1 },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  tipIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tipText: { ...typography.body, fontSize: 14, lineHeight: 20, flex: 1 },
  action: { marginTop: 6 },
});
