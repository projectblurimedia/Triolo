import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ScreenContainer';
import { VerificationBadge } from '@/components/VerificationBadge';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useAuthStore } from '@/state/authStore';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';
import { MainStackParamList, MainTabParamList } from '@/navigation/types';

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, 'Profile'>, NativeStackScreenProps<MainStackParamList>>;

/**
 * The verified-partner app's account tab — a gradient identity banner (avatar initials,
 * name/mobile/email), a summary card per capability with a quick fact and its verification
 * status (linking into the existing read-only MyInfo screen for full details — which now
 * also carries the edit/delete entry point, reused rather than duplicated here), and a
 * prompt card to add whichever capability isn't registered yet. No inline logout on this
 * screen — matching user-app's own Profile screen, logout lives only in the header's
 * SettingsMenuModal (see MainTabNavigator), reachable from every tab, not just this one.
 */
export function ProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const account = useAuthStore((state) => state.account);

  const workerProfile = useMyWorkerProfile();
  const businessProfile = useMyBusinessProfile();

  return (
    <ScreenContainer edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.body}>
        {account ? (
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>{getInitials(account.fullName)}</Text>
            </View>
            <Text style={styles.heroName} numberOfLines={1}>
              {account.fullName}
            </Text>
            <View style={styles.heroMetaRow}>
              <FontAwesome6 name="phone" size={11} color="rgba(255,255,255,0.85)" solid />
              <Text style={styles.heroMeta}>{account.mobileNumber}</Text>
            </View>
            {account.email ? (
              <View style={styles.heroMetaRow}>
                <FontAwesome6 name="envelope" size={11} color="rgba(255,255,255,0.85)" solid />
                <Text style={styles.heroMeta} numberOfLines={1}>
                  {account.email}
                </Text>
              </View>
            ) : null}
          </LinearGradient>
        ) : null}

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('mainTabs.Profile.capabilitiesLabel')}</Text>

        <CapabilityRow
          icon="screwdriver-wrench"
          title={t('mainTabs.Profile.workerTitle')}
          profile={workerProfile.data}
          quickFact={
            workerProfile.data ? t('mainTabs.Profile.workerQuickFact', { count: workerProfile.data.experienceYears }) : undefined
          }
          addLabel={t('mainTabs.Profile.addWorker')}
          onView={() => navigation.navigate('MyInfo', { capability: 'worker' })}
          onAdd={() => navigation.navigate('WorkerRegistration')}
          colors={colors}
        />
        <CapabilityRow
          icon="store"
          title={t('mainTabs.Profile.businessTitle')}
          profile={businessProfile.data}
          quickFact={businessProfile.data?.shopName}
          addLabel={t('mainTabs.Profile.addBusiness')}
          onView={() => navigation.navigate('MyInfo', { capability: 'business' })}
          onAdd={() => navigation.navigate('BusinessRegistration')}
          colors={colors}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

interface CapabilityRowProps {
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  title: string;
  profile: { verificationStatus: string } | null | undefined;
  quickFact?: string;
  addLabel: string;
  onView: () => void;
  onAdd: () => void;
  colors: ReturnType<typeof useThemeColors>['colors'];
}

function CapabilityRow({ icon, title, profile, quickFact, addLabel, onView, onAdd, colors }: CapabilityRowProps) {
  return (
    <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={profile ? onView : onAdd}>
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardIcon}>
        <FontAwesome6 name={icon} size={18} color="#FFFFFF" solid />
      </LinearGradient>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
        {profile ? (
          <>
            {quickFact ? (
              <Text style={[styles.cardQuickFact, { color: colors.textMuted }]} numberOfLines={1}>
                {quickFact}
              </Text>
            ) : null}
            <VerificationBadge status={profile.verificationStatus} />
          </>
        ) : (
          <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>{addLabel}</Text>
        )}
      </View>
      <FontAwesome6 name="chevron-right" size={14} color={colors.textMuted} solid />
    </Pressable>
  );
}

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 10,
  elevation: 3,
};

const styles = StyleSheet.create({
  // No paddingTop here — ScreenContainer's own `flex` style already contributes 20px on
  // every side; adding another top-only paddingVertical stacked the two, making the gap
  // above heroCard roughly double the gap on its left/right (ScreenContainer's own 20px
  // isn't horizontal-only — it's uniform on all sides, so the imbalance was purely this
  // extra vertical-only padding layered on top of it).
  body: { paddingBottom: 40 },
  heroCard: {
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    marginBottom: 24,
    ...CARD_SHADOW,
    shadowOpacity: 0.18,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitials: { ...typography.heading, fontFamily: fonts.semiBold, fontSize: 22, color: '#FFFFFF' },
  heroName: { ...typography.heading, fontFamily: fonts.semiBold, fontSize: 19, color: '#FFFFFF', marginBottom: 8 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 },
  heroMeta: { ...typography.caption, color: 'rgba(255,255,255,0.9)' },
  sectionLabel: { ...typography.caption, fontFamily: fonts.semiBold, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    ...CARD_SHADOW,
  },
  cardIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  cardText: { flex: 1, marginRight: 10 },
  cardTitle: { ...typography.subheading, fontFamily: fonts.semiBold },
  cardQuickFact: { ...typography.caption, marginTop: 3, marginBottom: 3 },
  cardSubtitle: { ...typography.caption, marginTop: 3 },
});
