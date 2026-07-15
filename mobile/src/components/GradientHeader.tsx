import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, headerGradient, typography } from '@/theme';

export interface HeaderAction {
  icon: keyof typeof FontAwesome5.glyphMap;
  accessibilityLabel: string;
  onPress?: () => void;
}

interface GradientHeaderProps {
  title: string;
  /** Short tagline under the title — fills otherwise-empty headers (e.g. Search, Bazaar, Profile). */
  subtitle?: string;
  /** Circular icon-only back button on the left, calling navigation.goBack(). */
  showBack?: boolean;
  /** Decorative brand icon before the title (e.g. Home) — ignored when showBack is set. */
  leadingIcon?: keyof typeof FontAwesome5.glyphMap;
  /** Right-side icon buttons — e.g. Home's notifications/messages/menu. */
  actions?: HeaderAction[];
}

/** Brand header used on every top-level screen — see docs/localization.md for why title is passed pre-translated. */
export function GradientHeader({ title, subtitle, showBack, leadingIcon, actions }: GradientHeaderProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const hasLeading = Boolean(showBack || leadingIcon);

  return (
    <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + 14 }]}>
        <View style={styles.row}>
          {showBack ? (
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityLabel="Back"
              hitSlop={8}
              style={styles.iconButton}
            >
              <FontAwesome5 name="arrow-left" size={18} color={colors.white} />
            </Pressable>
          ) : leadingIcon ? (
            <View style={styles.iconButton}>
              <FontAwesome5 name={leadingIcon} size={18} color={colors.white} />
            </View>
          ) : null}

          <View style={[styles.titleGroup, hasLeading && styles.titleGroupWithLeading]}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          {actions && actions.length > 0 ? (
            <View style={styles.actions}>
              {actions.map((action) => (
                <Pressable
                  key={action.accessibilityLabel}
                  onPress={action.onPress}
                  accessibilityLabel={action.accessibilityLabel}
                  hitSlop={8}
                  style={styles.iconButton}
                >
                  <FontAwesome5 name={action.icon} size={17} color={colors.white} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.accent} />
    </LinearGradient>
  );
}

const ICON_BUTTON_SIZE = 40;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  content: {
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleGroup: {
    flex: 1,
  },
  titleGroupWithLeading: {
    marginLeft: 12,
  },
  title: {
    ...typography.heading,
    fontFamily: fonts.semiBold,
    color: colors.white,
    lineHeight: 24,
  },
  subtitle: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.82)',
    lineHeight: 14,
    marginTop: 0,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    borderRadius: ICON_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accent: {
    height: 3,
    marginHorizontal: -16,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
});
