import React, { PropsWithChildren, ReactNode } from 'react';
import { Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

const AVATAR = 80;
// Just the back / heart row and a little room under it; the photo overlaps the edge.
// The photo (with its 4px ring) overlaps the cover by half; this keeps it clear of the label row.
const COVER_BELOW_ROW = AVATAR / 2 + 4 + 8;

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

// The offer cards' gradients, in turn (no orange — that's the shop colour).
const TILE_GRADIENTS: [string, string][] = [
  ['#0055D3', '#3B82F6'],
  ['#0F766E', '#14B8A6'],
  ['#6D28D9', '#A78BFA'],
  ['#15803D', '#4ADE80'],
  ['#BE185D', '#F472B6'],
  ['#1D4ED8', '#60A5FA'],
];

export interface ProfileStat {
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  value: string;
  label: string;
  /** Rating gold instead of the brand blue. */
  gold?: boolean;
}

interface ProfileCoverProps {
  topInset: number;
  onBack: () => void;
  backLabel: string;
  /** Top right of the cover (the favourite heart). */
  right?: ReactNode;
  /** The round photo (already sized to the avatar), overlapping the cover. */
  avatar: ReactNode;
  name: string;
  /** One line under the name (the kinds of work / shop). */
  subtitle?: string;
  /** Pills under the name (Trusted, distance, place). */
  pills?: ReactNode;
  stats: ProfileStat[];
  /**
   * What they do / sell, as round "highlights" under the name (like story bubbles): a caption
   * and a sideways row of gradient circles with the icon, the name below each.
   */
  highlights?: { title: string; items: { label: string; icon: IconName }[] };
  /** Shown between the stats card and the highlights (a shop's delivery). */
  beforeHighlights?: ReactNode;
  /** What this page is ("Worker", "Shop", "Looking for work"), centred on the cover. */
  kicker: { icon: IconName; label: string };
  contentContainerStyle?: StyleProp<ViewStyle>;
}

const GOLD = '#F5B301';

/**
 * (A copy of the customer app's ProfileCover — keep the two in sync.)
 *
 * A worker's or shop's profile page: a blue cover with soft light shapes, the round photo
 * overlapping it, the name and a line of what they do, pills (Trusted, distance, place), a
 * stats card, then the sections. The cover scrolls away with the page.
 */
export function ProfileCover({
  topInset,
  onBack,
  backLabel,
  right,
  avatar,
  name,
  subtitle,
  pills,
  stats,
  kicker,
  highlights,
  beforeHighlights,
  contentContainerStyle,
  children,
}: PropsWithChildren<ProfileCoverProps>) {
  const { colors } = useThemeColors();
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={contentContainerStyle}>
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.cover, { paddingTop: topInset + 8, height: topInset + 8 + 42 + COVER_BELOW_ROW }]}>
        <View style={[styles.shape, styles.shapeOne]} />
        <View style={[styles.shape, styles.shapeTwo]} />
        <View style={[styles.shape, styles.shapeThree]} />
        {/* A large faint icon of what they are, so the cover isn't a plain band. */}
        <FontAwesome6 name={kicker.icon} size={84} color="rgba(255,255,255,0.10)" solid style={styles.watermark} />
        <View style={styles.coverRow}>
          <Pressable onPress={onBack} hitSlop={8} accessibilityLabel={backLabel} style={styles.back}>
            <FontAwesome6 name="chevron-left" size={17} color="#FFFFFF" solid />
          </Pressable>
          <View style={styles.kicker}>
            <FontAwesome6 name={kicker.icon} size={11} color="#FFFFFF" solid />
            <Text style={styles.kickerText} numberOfLines={1}>
              {kicker.label}
            </Text>
          </View>
          {right ?? <View style={styles.backSpacer} />}
        </View>
      </LinearGradient>

      <View style={styles.identity}>
        <View style={[styles.avatarRing, { backgroundColor: colors.background, shadowColor: colors.primary }]}>{avatar}</View>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
          {name}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {pills ? <View style={styles.pills}>{pills}</View> : null}
      </View>

      <View style={styles.body}>
        <View style={[styles.stats, { backgroundColor: colors.surface, borderColor: `${colors.primary}1F` }]}>
          {stats.map((stat, index) => (
            <View
              key={stat.label}
              style={[styles.stat, index > 0 ? { borderLeftWidth: 1, borderLeftColor: `${colors.primary}14` } : null]}
            >
              <View style={[styles.statIcon, { backgroundColor: stat.gold ? `${GOLD}22` : `${colors.primary}14` }]}>
                <FontAwesome6 name={stat.icon} size={13} color={stat.gold ? GOLD : colors.primary} solid />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
                {stat.value}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]} numberOfLines={1}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
        {beforeHighlights}
        {highlights && highlights.items.length > 0 ? (
          <View style={styles.highlights}>
            <View style={styles.highlightsHead}>
              <View style={[styles.highlightsRule, { backgroundColor: `${colors.primary}26` }]} />
              <Text style={[styles.highlightsTitle, { color: colors.textMuted }]} numberOfLines={1}>
                {highlights.title}
              </Text>
              <View style={[styles.highlightsRule, { backgroundColor: `${colors.primary}26` }]} />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.highlightsScroll}
              contentContainerStyle={styles.highlightsRow}
            >
              {highlights.items.map((item, index) => {
                const [from, to] = TILE_GRADIENTS[index % TILE_GRADIENTS.length];
                return (
                  <View key={item.label} style={styles.bubble}>
                    {/* A gradient ring, a gap in the page colour, then the gradient disc with the icon. */}
                    <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bubbleRing}>
                      <View style={[styles.bubbleGap, { backgroundColor: colors.background }]}>
                        <LinearGradient colors={[to, from]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bubbleDisc}>
                          <FontAwesome6 name={item.icon} size={20} color="#FFFFFF" solid />
                        </LinearGradient>
                      </View>
                    </LinearGradient>
                    <Text style={[styles.bubbleLabel, { color: colors.text }]} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
        {children}
      </View>
    </ScrollView>
  );
}

/** A pill under the profile name. `filled` = the brand gradient (the distance). */
export function ProfilePill({
  icon,
  label,
  filled = false,
  color,
}: {
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  label: string;
  filled?: boolean;
  color?: string;
}) {
  const { colors } = useThemeColors();
  if (filled) {
    return (
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pill}>
        <FontAwesome6 name={icon} size={10} color="#FFFFFF" solid />
        <Text style={[styles.pillText, { color: '#FFFFFF' }]}>{label}</Text>
      </LinearGradient>
    );
  }
  const tone = color ?? colors.primary;
  return (
    <View style={[styles.pill, { backgroundColor: colors.surface, borderWidth: 1, borderColor: `${tone}33` }]}>
      <FontAwesome6 name={icon} size={10} color={tone} solid />
      <Text style={[styles.pillText, { color: color ?? colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export const PROFILE_AVATAR_SIZE = AVATAR;

/** A titled card on a profile page: icon, title, a count, then the content. */
export function ProfileSection({
  icon,
  title,
  count,
  children,
}: PropsWithChildren<{ icon: IconName; title: string; count?: number }>) {
  const { colors } = useThemeColors();
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: `${colors.primary}1F` }]}>
      <View style={styles.sectionHead}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sectionIcon}>
          <FontAwesome6 name={icon} size={12} color="#FFFFFF" solid />
        </LinearGradient>
        <Text style={[styles.sectionTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {count !== undefined ? (
          <View style={[styles.sectionCount, { backgroundColor: `${colors.primary}14` }]}>
            <Text style={[styles.sectionCountText, { color: colors.primary }]}>{count}</Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { paddingHorizontal: 16, overflow: 'hidden', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  shape: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  shapeOne: { width: 180, height: 180, top: -80, right: -50 },
  shapeTwo: { width: 110, height: 110, bottom: -60, left: -20, backgroundColor: 'rgba(255,255,255,0.09)' },
  shapeThree: { width: 56, height: 56, top: 18, left: '42%', backgroundColor: 'rgba(255,255,255,0.08)' },
  coverRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  watermark: { position: 'absolute', right: 18, bottom: -22, transform: [{ rotate: '-12deg' }] },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    flexShrink: 1,
  },
  kickerText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 16 },
  backSpacer: { width: 42 },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: { alignItems: 'center', marginTop: -(AVATAR / 2), paddingHorizontal: 20 },
  avatarRing: {
    padding: 4,
    borderRadius: AVATAR / 2 + 4,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  name: { fontFamily: fonts.semiBold, fontSize: 21, lineHeight: 28, textAlign: 'center', marginTop: 8 },
  subtitle: { ...typography.body, fontSize: 13.5, textAlign: 'center', marginTop: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, borderRadius: 14, paddingHorizontal: 11, maxWidth: 220 },
  pillText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 16 },
  body: { paddingHorizontal: 16, paddingTop: 18 },
  stats: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 14,
    shadowColor: '#0B3A8A',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  stat: { flex: 1, alignItems: 'center', gap: 3, paddingHorizontal: 4 },
  statIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  statValue: { fontFamily: fonts.semiBold, fontSize: 16, lineHeight: 21 },
  statLabel: { ...typography.caption, fontSize: 11 },
  highlights: { marginTop: 18 },
  highlightsHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  highlightsRule: { flex: 1, height: 1 },
  highlightsTitle: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11.5, letterSpacing: 0.6, textTransform: 'uppercase' },
  highlightsScroll: { flexGrow: 0 },
  // Centred when they fit; scrolls sideways when there are more.
  highlightsRow: { flexGrow: 1, justifyContent: 'center', gap: 14, paddingTop: 12 },
  bubble: { width: 76, alignItems: 'center', gap: 7 },
  bubbleRing: { width: 66, height: 66, borderRadius: 33, padding: 2.5 },
  bubbleGap: { flex: 1, borderRadius: 31, padding: 3 },
  bubbleDisc: { flex: 1, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  bubbleLabel: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 15, textAlign: 'center' },
  section: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginTop: 14,
    gap: 12,
    shadowColor: '#0B3A8A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15, flexShrink: 1 },
  sectionCount: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  sectionCountText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 14 },
});
