import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { previousStepAt, stepTimeText } from '@/utils/stepTime';
import { colors as brandColors, fonts, typography, useThemeColors } from '@/theme';

export interface TimelineStep {
  key: string;
  label: string;
  /** When it happened; null while it hasn't. */
  at: string | null;
  done: boolean;
}

/**
 * A job's or an order's steps with the time of each — the same list the customer app shows,
 * worded for the partner. The first step not done yet is "now" (unless the whole thing ended).
 * The first time carries its date; a later one repeats the date only on another day.
 */
export function StepTimeline({ title, steps, ended = false }: { title: string; steps: TimelineStep[]; ended?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const currentIndex = ended ? -1 : steps.findIndex((step) => !step.done);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{title}</Text>
      {steps.map((step, index) => {
        const current = index === currentIndex;
        return (
          <View key={step.key} style={styles.stepRow}>
            <View style={styles.stepRail}>
              <View
                style={[
                  styles.stepDot,
                  step.done
                    ? { backgroundColor: brandColors.success }
                    : current
                      ? { backgroundColor: `${colors.primary}1F`, borderWidth: 2, borderColor: colors.primary }
                      : { backgroundColor: colors.border },
                ]}
              >
                {step.done ? <FontAwesome6 name="check" size={9} color="#FFFFFF" solid /> : null}
              </View>
              {index < steps.length - 1 ? (
                <View style={[styles.stepLine, { backgroundColor: steps[index + 1].done ? brandColors.success : colors.border }]} />
              ) : null}
            </View>
            <View style={styles.stepBody}>
              <Text style={[styles.stepText, { color: current ? colors.primary : step.done ? colors.text : colors.textMuted }]}>{step.label}</Text>
              {step.at ? (
                <Text style={[styles.stepTime, { color: colors.textMuted }]}>{stepTimeText(step.at, previousStepAt(steps, index))}</Text>
              ) : current ? (
                <Text style={[styles.stepTime, { color: colors.primary }]}>{t('timeline.now')}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16 },
  cardLabel: { ...typography.caption, fontFamily: fonts.semiBold, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepRail: { alignItems: 'center', width: 20 },
  stepDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 2, height: 22 },
  stepBody: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  stepText: { ...typography.body, fontSize: 14, lineHeight: 20, flex: 1 },
  stepTime: { ...typography.caption, fontSize: 11, lineHeight: 20 },
});
