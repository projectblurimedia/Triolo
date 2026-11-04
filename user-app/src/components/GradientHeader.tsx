import React from 'react';
import { NearbyMark } from './brand/NearbyMark';
import { Wordmark } from './brand/Wordmark';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, headerGradient, typography } from '@/theme';
import { FullText } from '@/components/FullText';

export interface HeaderAction {
  icon: keyof typeof FontAwesome6.glyphMap;
  accessibilityLabel: string;
  /** Optional visible text — renders as a labeled pill (icon + text) instead of a bare icon-only circle. */
  label?: string;
  onPress?: () => void;
  /** Small red badge in the icon button's corner — e.g. an unread notification count. 0/undefined hides it; caps the displayed text at "9+". */
  badgeCount?: number;
}

interface GradientHeaderProps {
  title: string;
  /** Short tagline under the title — fills otherwise-empty headers (e.g. Search, Bazaar, Profile). */
  subtitle?: string;
  /** Circular icon-only back button on the left, calling navigation.goBack(). */
  showBack?: boolean;
  /** Decorative brand icon before the title (e.g. Home) — ignored when showBack is set. */
  leadingIcon?: keyof typeof FontAwesome6.glyphMap;
  /** Right-side icon buttons — e.g. Home's notifications/messages/menu. */
  actions?: HeaderAction[];
  /** Overrides the brand-blue gradient — e.g. Bazaar's own orange, matching its Business identity everywhere else (SHOP_GRADIENT). */
  gradient?: readonly [string, string];
  /** The NearbyU brand instead of a title (Home): the mark in the leading tile, the name as the title. */
  brand?: boolean;
}

/** Brand header used on every top-level screen — see docs/localization.md for why title is passed pre-translated. */
export function GradientHeader({ title, subtitle, showBack, leadingIcon, actions, gradient = headerGradient, brand }: GradientHeaderProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const hasLeading = Boolean(showBack || leadingIcon || brand);

  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + 14 }]}>
        <View style={styles.row}>
          {showBack ? (
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityLabel="Back"
              hitSlop={8}
              style={styles.iconButton}
            >
              <FontAwesome6 name="chevron-left" size={18} color={colors.white} solid />
            </Pressable>
          ) : brand ? (
            <View style={styles.leadingIconButton}>
              <NearbyMark size={30} />
            </View>
          ) : leadingIcon ? (
            <View style={styles.leadingIconButton}>
              <FontAwesome6 name={leadingIcon} size={22} color={colors.white} solid />
            </View>
          ) : null}

          <View style={[styles.titleGroup, hasLeading && styles.titleGroupWithLeading]}>
            {brand ? (
              <Wordmark size={23} style={styles.brandName} />
            ) : (
              <FullText style={styles.title} numberOfLines={1}>
                {title}
              </FullText>
            )}
            {subtitle ? (
              <FullText style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </FullText>
            ) : null}
          </View>

          {actions && actions.length > 0 ? (
            <View style={styles.actions}>
              {actions.map((action) =>
                action.label ? (
                  <Pressable
                    key={action.accessibilityLabel}
                    onPress={action.onPress}
                    accessibilityLabel={action.accessibilityLabel}
                    hitSlop={8}
                    style={styles.labeledAction}
                  >
                    <FontAwesome6 name={action.icon} size={13} color={colors.white} solid />
                    <FullText style={styles.labeledActionText} numberOfLines={1}>
                      {action.label}
                    </FullText>
                  </Pressable>
                ) : (
                  <Pressable
                    key={action.accessibilityLabel}
                    onPress={action.onPress}
                    accessibilityLabel={action.accessibilityLabel}
                    hitSlop={8}
                    style={styles.iconButton}
                  >
                    <FontAwesome6 name={action.icon} size={17} color={colors.white} solid />
                    {action.badgeCount ? (
                      <View style={styles.badge}>
                        <FullText style={styles.badgeText} numberOfLines={1}>
                          {action.badgeCount > 9 ? '9+' : action.badgeCount}
                        </FullText>
                      </View>
                    ) : null}
                  </Pressable>
                ),
              )}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.accent} />
    </LinearGradient>
  );
}

const ICON_BUTTON_SIZE = 40;
// The leading (decorative) icon's own circle — deliberately a bit bigger than the shared
// ICON_BUTTON_SIZE used by the back button and right-side actions, since only the leading
// icon's background was asked to grow, not every icon button in the header.
const LEADING_ICON_BUTTON_SIZE = 46;

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
  brandName: { marginBottom: 2 },
  titleGroupWithLeading: {
    marginLeft: 12,
  },
  title: {
    ...typography.heading,
    fontFamily: fonts.semiBold,
    fontSize: typography.heading.fontSize - 2,
    color: colors.white,
    lineHeight: 24,
  },
  subtitle: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.82)',
    lineHeight: 14,
    marginTop: 1.5,
  },
  actions: {
    flexDirection: 'row',
    gap: 14,
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
  // Same unread badge as partner-app's GradientHeader (no shared package — keep in sync).
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: headerGradient[0],
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { fontSize: 10, fontFamily: fonts.semiBold, color: colors.white },
  leadingIconButton: {
    width: LEADING_ICON_BUTTON_SIZE,
    height: LEADING_ICON_BUTTON_SIZE,
    borderRadius: LEADING_ICON_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  labeledAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: ICON_BUTTON_SIZE,
    paddingHorizontal: 12,
    borderRadius: ICON_BUTTON_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
  },
  labeledActionText: {
    ...typography.caption,
    fontFamily: fonts.semiBold,
    color: colors.white,
  },
  accent: {
    height: 3,
    marginHorizontal: -16,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
});
