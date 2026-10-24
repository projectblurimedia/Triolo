import React, { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useIsTrusted } from '@/hooks/useSubscription';
import { fonts, typography } from '@/theme';
import { SealedPhoto, TrustedSeal } from './TrustedSeal';

type ProfileKind = 'service' | 'business' | 'job_post';

/** "Trusted by Triolo": emerald to green. */
export const TRUSTED_GRADIENT = ['#047857', '#10B981'] as const;
const TRUSTED_COLOR = '#059669';

interface TrustedBadgeProps {
  kind: ProfileKind;
  id: string | null | undefined;
  style?: StyleProp<ViewStyle>;
}

/** The "Trusted by Triolo" pill (profiles) — only for a profile whose owner bought the badge. */
export function TrustedBadge({ kind, id, style }: TrustedBadgeProps) {
  const { t } = useTranslation();
  if (!useIsTrusted(kind, id)) return null;
  return (
    <LinearGradient colors={TRUSTED_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.pill, style]}>
      <ShieldMark size={16} />
      <Text style={styles.pillText}>{t('trusted.label')}</Text>
    </LinearGradient>
  );
}

/** A white shield with a green tick inside. */
function ShieldMark({ size }: { size: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <View style={styles.center}>
        <FontAwesome6 name="shield" size={size * 0.92} color="#FFFFFF" solid />
      </View>
      <View style={[styles.center, { paddingTop: size * 0.04 }]}>
        <FontAwesome6 name="check" size={size * 0.42} color={TRUSTED_COLOR} solid />
      </View>
    </View>
  );
}

/** The seal on a profile photo's top-right edge, only for "Trusted by Triolo". */
export function ProfileSeal({ kind, id, size = 22 }: { kind: ProfileKind; id?: string | null; size?: number }) {
  if (!useIsTrusted(kind, id)) return null;
  return <TrustedSeal size={size} />;
}

/** A profile photo with the Trusted seal on its top-right edge (when bought) — sized to the photo. */
export function SealedAvatar({ size, kind, id, children }: PropsWithChildren<{ size: number; kind: ProfileKind; id?: string | null }>) {
  const trusted = useIsTrusted(kind, id);
  return (
    <SealedPhoto size={size} trusted={trusted}>
      {children}
    </SealedPhoto>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 14,
    paddingLeft: 7,
    paddingRight: 10,
    paddingVertical: 4,
    shadowColor: '#065F46',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  pillText: { ...typography.caption, fontSize: 11, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
