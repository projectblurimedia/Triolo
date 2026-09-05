import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { fonts, typography, useThemeColors } from '@/theme';

interface DrawerMenuItemProps {
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  gradient: readonly [string, string];
  title: string;
  subtitle: string;
  onPress: () => void;
}

/** A single row inside a `SideMenuDrawer` body — gradient icon square, title/subtitle, chevron. Same row shape `HomeMenuModal` established for its own items. */
export function DrawerMenuItem({ icon, gradient, title, subtitle, onPress }: DrawerMenuItemProps) {
  const { colors } = useThemeColors();

  return (
    <Pressable style={[styles.item, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={onPress}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.itemIcon}>
        <FontAwesome6 name={icon} size={18} color={colors.white} solid />
      </LinearGradient>
      <View style={styles.itemText}>
        <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.itemSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <FontAwesome6 name="chevron-right" size={14} color={colors.textMuted} solid />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    paddingRight: 14,
    marginBottom: 10,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemText: { flex: 1, marginRight: 10 },
  itemTitle: { ...typography.body, fontFamily: fonts.semiBold },
  itemSubtitle: { ...typography.caption, marginTop: 2 },
});
