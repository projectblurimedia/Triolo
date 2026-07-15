import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, headerGradient, typography } from '@/theme';

export interface HeaderAction {
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  onPress?: () => void;
}

interface GradientHeaderProps {
  title: string;
  /** Right-side icon buttons — e.g. Home's notifications/messages/menu. Omit for a plain title header. */
  actions?: HeaderAction[];
}

/** Brand header used on every top-level screen — see docs/localization.md for why title is passed pre-translated. */
export function GradientHeader({ title, actions }: GradientHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={headerGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingTop: insets.top + 14 }]}
    >
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        {actions && actions.length > 0 ? (
          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable
                key={action.accessibilityLabel}
                onPress={action.onPress}
                accessibilityLabel={action.accessibilityLabel}
                hitSlop={8}
                style={styles.actionButton}
              >
                <Ionicons name={action.icon} size={22} color={colors.white} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.heading,
    color: colors.white,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    padding: 2,
  },
});
