import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { STAR_COLOR } from './RatingStars';
import { SealedAvatar } from './TrustedBadge';
import { WorkerNearbyResult } from '@/services/workersService';
import { formatDistanceValue } from '@/utils/nearbyResult';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { SmartImage } from './SmartImage';
import { workerKindLabels } from '@/utils/kindLabels';
import { FullText } from '@/components/FullText';

export const MINI_CARD_WIDTH = 168;

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export interface AvatarSeal {
  kind: 'service' | 'business' | 'job_post';
  id: string;
}

/**
 * Round photo, or brand-gradient initials when there's no photo — with a seal on its
 * top-right edge when it's Trusted by Triolo.
 */
export function Avatar({ photoUrl, name, size, seal }: { photoUrl?: string | null; name: string; size: number; seal?: AvatarSeal }) {
  if (seal) {
    return (
      <SealedAvatar size={size} kind={seal.kind} id={seal.id}>
        <Avatar photoUrl={photoUrl} name={name} size={size} />
      </SealedAvatar>
    );
  }
  if (photoUrl) {
    return <SmartImage source={{ uri: photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <LinearGradient
      colors={headerGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}
    >
      {/* Poppins sits high in its line box on Android: no font padding, a fixed line height and a
          small nudge down keep the initials truly centred. */}
      <Text
        style={[
          styles.avatarInitials,
          { fontSize: size * 0.36, lineHeight: size * 0.36 * 1.25, transform: [{ translateY: size * 0.025 }] },
        ]}
      >
        {initialsOf(name)}
      </Text>
    </LinearGradient>
  );
}

/** The rating on a photo's bottom-right edge: a small white pill with a star (or "New"). */
export function RatingBadge({ average, count, size }: { average: number | null; count: number; size: number }) {
  const { t } = useTranslation();
  const { colors, isDark } = useThemeColors();
  const rated = average != null && count > 0;
  return (
    <View
      style={[
        styles.ratingBadge,
        { backgroundColor: isDark ? colors.surface : '#FFFFFF', borderColor: isDark ? colors.border : '#FFFFFF', bottom: -4, right: size > 50 ? -10 : -8 },
      ]}
    >
      {rated ? <FontAwesome6 name="star" size={9} color={STAR_COLOR} solid /> : null}
      <Text style={[styles.ratingBadgeText, { color: rated ? colors.text : colors.primary }]}>
        {rated ? average!.toFixed(1) : t('rating.new')}
      </Text>
    </View>
  );
}

/** A profile photo with the rating on its bottom-right edge (the Trusted seal stays top-right). */
export function RatedAvatar({
  photoUrl,
  name,
  size,
  seal,
  average,
  count,
}: {
  photoUrl?: string | null;
  name: string;
  size: number;
  seal?: AvatarSeal;
  average: number | null;
  count: number;
}) {
  // A white ring sets the photo off from the card behind it.
  const ring = 3;
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.avatarRing, { width: size, height: size, borderRadius: size / 2, borderWidth: ring }]}>
        <Avatar photoUrl={photoUrl} name={name} size={size - ring * 2} seal={seal} />
      </View>
      <RatingBadge average={average} count={count} size={size} />
    </View>
  );
}

/**
 * The header of a nearby card, in the app header's brand gradient with two soft light circles
 * and a curved edge into the card; the rest of the card is the app background. `band`
 * (carousel cards, tiles): across the top, the photo overlapping its curve. `side` (list
 * cards, which are rows): a panel down the left behind the photo, curving on its right.
 */
export function CardFill({ variant = 'band', height = 50, width = 82, radius = 18 }: { variant?: 'band' | 'side'; height?: number; width?: number; radius?: number }) {
  const { colors } = useThemeColors();
  const band = variant === 'band';
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
      <View style={band ? { height, overflow: 'hidden' } : { position: 'absolute', left: 0, top: 0, bottom: 0, width, overflow: 'hidden' }}>
        <LinearGradient colors={['#0A3FAE', '#0055D3', '#2B83FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.glow, band ? { width: 70, height: 70, top: -34, right: -18 } : { width: 60, height: 60, top: -26, left: -20 }]} />
        <View style={[styles.glow, band ? { width: 40, height: 40, top: 18, left: -14 } : { width: 44, height: 44, bottom: -18, left: 28 }]} />
        {/* The curve: a wide oval of the card's own colour over the gradient's inner edge. */}
        <View
          style={[
            styles.curve,
            { backgroundColor: colors.background },
            band ? { left: '-25%', right: '-25%', height: 40, bottom: -28, borderRadius: 999 } : { top: '-20%', bottom: '-20%', width: 34, right: -24, borderRadius: 999 },
          ]}
        />
      </View>
    </View>
  );
}

/**
 * Style for a nearby card: the app background, a soft blue rim and a light shadow.
 * Dark theme: no shadow — on Android an elevation shadow shows through as a grey cast.
 */
export function useCardChrome() {
  const { colors, isDark } = useThemeColors();
  return isDark
    ? { backgroundColor: colors.background, borderColor: colors.border, elevation: 0, shadowOpacity: 0 }
    : { backgroundColor: colors.background, borderColor: `${colors.primary}26`, shadowColor: colors.primary };
}

/**
 * A card's kinds of work / shop as solid blue chips, so what they do stands out. As many as fit
 * on one row; the first is cut with "…" if it alone is too long; whatever doesn't fit shows as
 * "+N". Widths are measured from a hidden copy of every chip.
 */
export function KindChips({ kinds, center }: { kinds: string[]; max?: number; center?: boolean }) {
  const [rowWidth, setRowWidth] = useState(0);
  const [widths, setWidths] = useState<Record<number, number>>({});
  const [plusWidth, setPlusWidth] = useState(0);
  if (kinds.length === 0) return null;

  const measured = rowWidth > 0 && kinds.every((_, index) => widths[index] != null) && (kinds.length < 2 || plusWidth > 0);
  let count = 1;
  if (measured) {
    let used = widths[0];
    for (let index = 1; index < kinds.length; index++) {
      const rest = kinds.length - index - 1;
      const need = KIND_GAP + widths[index] + (rest > 0 ? KIND_GAP + plusWidth : 0);
      if (used + need > rowWidth) break;
      used += KIND_GAP + widths[index];
      count = index + 1;
    }
  }
  const more = kinds.length - count;

  const chip = (kind: string, key: string, onLayout?: (width: number) => void, shrink = false) => (
    <LinearGradient
      key={key}
      colors={headerGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.kind, shrink ? styles.kindShrink : null]}
      onLayout={onLayout ? (event) => onLayout(event.nativeEvent.layout.width) : undefined}
    >
      <FullText style={styles.kindText} numberOfLines={1}>
        {kind}
      </FullText>
    </LinearGradient>
  );

  return (
    <View style={[styles.kindsWrap, center ? styles.kindsCenter : null]} onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}>
      {/* Hidden: every chip at its natural width, to know what fits. */}
      <View style={styles.kindsMeasure} pointerEvents="none">
        {kinds.map((kind, index) =>
          chip(kind, `m${index}`, (width) => setWidths((current) => (current[index] === width ? current : { ...current, [index]: width }))),
        )}
        <View style={styles.kind} onLayout={(event) => setPlusWidth(event.nativeEvent.layout.width)}>
          <Text style={styles.kindText}>+{kinds.length}</Text>
        </View>
      </View>
      <View style={[styles.kinds, center ? styles.kindsCenter : null, { opacity: measured || kinds.length === 1 ? 1 : 0 }]}>
        {kinds.slice(0, count).map((kind, index) => chip(kind, kind + index, undefined, index === 0))}
        {more > 0 ? (
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.kind, styles.kindMore]}>
            <Text style={styles.kindText}>+{more}</Text>
          </LinearGradient>
        ) : null}
      </View>
    </View>
  );
}

const KIND_GAP = 5;

/** "1.2 km · Delivery" — the facts under a card's name, on one line. */
export function MetaLine({ parts }: { parts: { text: string; color?: string; strong?: boolean; icon?: React.ComponentProps<typeof FontAwesome6>['name'] }[] }) {
  const { colors } = useThemeColors();
  return (
    <View style={styles.meta}>
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <Text style={[styles.metaText, { color: colors.textMuted }]}>·</Text> : null}
          {part.icon ? <FontAwesome6 name={part.icon} size={10} color={part.color ?? colors.textMuted} solid /> : null}
          <FullText style={[part.strong ? styles.metaStrong : styles.metaText, { color: part.color ?? colors.textMuted }]} numberOfLines={1}>
            {part.text}
          </FullText>
        </React.Fragment>
      ))}
    </View>
  );
}

/** Compact worker card for horizontal carousels (Home, Services). */
export function WorkerMiniCard({ worker, onPress }: { worker: WorkerNearbyResult; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const skills = workerKindLabels(t, worker).join(', ');
  const chrome = useCardChrome();

  return (
    <Pressable onPress={onPress} style={[styles.card, chrome]}>
      <CardFill />
      <RatedAvatar
        photoUrl={worker.profilePhotoUrl}
        name={worker.accountFullName}
        size={56}
        seal={{ kind: 'service', id: worker.id }}
        average={worker.ratingAverage}
        count={worker.ratingCount}
      />
      <FullText style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {worker.accountFullName}
      </FullText>
      <KindChips kinds={workerKindLabels(t, worker)} center />
      <MetaLine
        parts={[
          { text: formatDistanceValue(worker.distanceMeters), color: colors.primary, strong: true, icon: 'location-arrow' },
          { text: t('services.experienceShort', { count: worker.experienceYears }) },
        ]}
      />
    </Pressable>
  );
}

export const miniCardStyles = StyleSheet.create({
  card: {
    width: MINI_CARD_WIDTH,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    paddingTop: 16,
    alignItems: 'center',
    gap: 5,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  name: { ...typography.body, fontFamily: fonts.semiBold, marginTop: 4, textAlign: 'center' },
  sub: { ...typography.caption, fontSize: 11, textAlign: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, flexShrink: 1 },
  metaStrong: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11 },
  metaText: { ...typography.caption, fontSize: 11 },
});

const styles = StyleSheet.create({
  ...miniCardStyles,
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#FFFFFF', fontFamily: fonts.semiBold, includeFontPadding: false, textAlign: 'center', textAlignVertical: 'center' },
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
  kindsWrap: { alignSelf: 'stretch', marginTop: 2 },
  kindsMeasure: { position: 'absolute', flexDirection: 'row', opacity: 0, left: 0, top: 0 },
  kinds: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  kindsCenter: { justifyContent: 'center' },
  kind: { height: 22, borderRadius: 11, paddingHorizontal: 9, justifyContent: 'center' },
  kindShrink: { flexShrink: 1, minWidth: 0 },
  kindMore: { flexShrink: 0, paddingHorizontal: 7 },
  kindText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10.5, lineHeight: 14, includeFontPadding: false, color: '#FFFFFF' },
  curve: { position: 'absolute' },
  avatarRing: { borderColor: '#FFFFFF', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  ratingBadge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 6,
    height: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  ratingBadgeText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10, lineHeight: 13, includeFontPadding: false },
});
