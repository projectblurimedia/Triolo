import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GradientHeader } from '@/components/GradientHeader';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { VerificationBadge } from '@/components/VerificationBadge';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useAuthStore } from '@/state/authStore';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';
import { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'MyInfo'>;
type MyInfoNavigation = Props['navigation'];

/**
 * Shows the submitted Worker/Business profile, with a `pen` header action opening the same
 * registration screen in edit mode (see WorkerRegistrationScreen/BusinessRegistrationScreen's
 * own doc comments) — no longer purely read-only. Renders its own GradientHeader (rather than
 * a navigator-level one) so the pen action can carry the profile data this screen already
 * fetched — same wrapper-component pattern used wherever a screen's header needs local data/
 * state a stateless navigator `header:` render function can't hold.
 */
export function MyInfoScreen({ route, navigation }: Props) {
  const { capability } = route.params;
  return capability === 'worker' ? <WorkerInfo navigation={navigation} /> : <BusinessInfo navigation={navigation} />;
}

function WorkerInfo({ navigation }: { navigation: MyInfoNavigation }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const account = useAuthStore((state) => state.account);
  const { data: profile, isLoading } = useMyWorkerProfile();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader
        title={t('myInfo.title')}
        showBack
        actions={profile ? [{ icon: 'pen', accessibilityLabel: t('common.edit'), onPress: () => navigation.navigate('WorkerRegistration', { profile }) }] : undefined}
      />

      {isLoading || !profile ? (
        <LoadingView />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <HeroCard icon="screwdriver-wrench" name={account?.fullName ?? t('workerProfile.title')} tagline={t('mainTabs.Profile.workerTitle')} />
          <View style={styles.statusRow}>
            <VerificationBadge status={profile.verificationStatus} />
          </View>

          <DetailCard colors={colors}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('workerProfile.skillLabel')}</Text>
            <View style={styles.chipRow}>
              {profile.skillCategories
                .filter((key) => key !== 'other')
                .map((key) => (
                  <View key={key} style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.chipLabel, { color: colors.text }]}>{t(`workerProfile.skills.${key}`)}</Text>
                  </View>
                ))}
              {(profile.otherSkillDescription ? profile.otherSkillDescription.split(', ').filter(Boolean) : []).map(
                (entry, index) => (
                  <View key={`${entry}-${index}`} style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.chipLabel, { color: colors.text }]}>{entry}</Text>
                  </View>
                ),
              )}
            </View>

            <Divider colors={colors} />
            <InfoRow icon="briefcase" label={t('workerProfile.experienceLabel')} value={String(profile.experienceYears)} colors={colors} />
            <Divider colors={colors} />
            <InfoRow icon="location-dot" label={t('location.addressLabel')} value={profile.locationAddress ?? '-'} colors={colors} />
          </DetailCard>

          {profile.portfolioPhotoUrls.length > 0 ? (
            <DetailCard colors={colors}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('workerProfile.portfolioLabel')}</Text>
              <PhotoRow urls={profile.portfolioPhotoUrls} />
            </DetailCard>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function BusinessInfo({ navigation }: { navigation: MyInfoNavigation }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { data: profile, isLoading } = useMyBusinessProfile();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GradientHeader
        title={t('myInfo.title')}
        showBack
        actions={profile ? [{ icon: 'pen', accessibilityLabel: t('common.edit'), onPress: () => navigation.navigate('BusinessRegistration', { profile }) }] : undefined}
      />

      {isLoading || !profile ? (
        <LoadingView />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <HeroCard icon="store" name={profile.shopName} tagline={t('mainTabs.Profile.businessTitle')} />
          <View style={styles.statusRow}>
            <VerificationBadge status={profile.verificationStatus} />
          </View>

          <DetailCard colors={colors}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('businessProfile.categoryLabel')}</Text>
            <View style={styles.chipRow}>
              {profile.shopCategories
                .filter((key) => key !== 'other')
                .map((key) => (
                  <View key={key} style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.chipLabel, { color: colors.text }]}>{t(`businessProfile.categories.${key}`)}</Text>
                  </View>
                ))}
              {(profile.otherCategoryDescription ? profile.otherCategoryDescription.split(', ').filter(Boolean) : []).map(
                (entry, index) => (
                  <View key={`${entry}-${index}`} style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.chipLabel, { color: colors.text }]}>{entry}</Text>
                  </View>
                ),
              )}
            </View>

            <Divider colors={colors} />
            <InfoRow
              icon="truck"
              label={t('businessProfile.deliveryLabel')}
              value={profile.deliveryAvailable ? t('businessProfile.deliveryYes') : t('businessProfile.deliveryNo')}
              colors={colors}
            />
            <Divider colors={colors} />
            <InfoRow icon="location-dot" label={t('location.addressLabel')} value={profile.locationAddress ?? '-'} colors={colors} />
          </DetailCard>

          {profile.shopPhotoUrls.length > 0 ? (
            <DetailCard colors={colors}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('businessProfile.photosLabel')}</Text>
              <PhotoRow urls={profile.shopPhotoUrls} />
            </DetailCard>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function LoadingView() {
  const { colors } = useThemeColors();
  return (
    <View style={styles.loadingWrap}>
      <LoadingIndicator color={colors.primary} />
    </View>
  );
}

interface HeroCardProps {
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  name: string;
  tagline: string;
}

/** Identity banner shared by both capability views — same gradient/avatar treatment as ProfileScreen's own hero, for visual consistency across "who is this" surfaces in the app. */
function HeroCard({ icon, name, tagline }: HeroCardProps) {
  return (
    <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
      <View style={styles.heroIcon}>
        <FontAwesome6 name={icon} size={24} color="#FFFFFF" solid />
      </View>
      <Text style={styles.heroName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.heroTagline}>{tagline}</Text>
    </LinearGradient>
  );
}

function DetailCard({ children, colors }: { children: React.ReactNode; colors: ReturnType<typeof useThemeColors>['colors'] }) {
  return <View style={[styles.detailCard, { backgroundColor: colors.surface }]}>{children}</View>;
}

function Divider({ colors }: { colors: ReturnType<typeof useThemeColors>['colors'] }) {
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

interface InfoRowProps {
  icon: React.ComponentProps<typeof FontAwesome6>['name'];
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeColors>['colors'];
}

function InfoRow({ icon, label, value, colors }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: `${colors.primary}14` }]}>
        <FontAwesome6 name={icon} size={13} color={colors.primary} solid />
      </View>
      <View style={styles.infoText}>
        <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

function PhotoRow({ urls }: { urls: string[] }) {
  return (
    <View style={styles.photoRow}>
      {urls.map((url) => (
        <Image key={url} source={{ uri: url }} style={styles.photo} />
      ))}
    </View>
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
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 20, paddingBottom: 40 },
  heroCard: { borderRadius: 22, padding: 22, alignItems: 'center', ...CARD_SHADOW, shadowOpacity: 0.18 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroName: { ...typography.heading, fontFamily: fonts.semiBold, fontSize: 19, color: '#FFFFFF', textAlign: 'center' },
  heroTagline: { ...typography.caption, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  statusRow: { alignItems: 'center', marginTop: 14, marginBottom: 4 },
  detailCard: { borderRadius: 18, padding: 16, marginTop: 16, ...CARD_SHADOW },
  sectionLabel: { ...typography.caption, fontFamily: fonts.semiBold, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 18, paddingVertical: 7, paddingHorizontal: 13 },
  chipLabel: { ...typography.caption, fontFamily: fonts.medium },
  divider: { height: 1, marginVertical: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1 },
  infoLabel: { ...typography.caption },
  infoValue: { ...typography.body, fontFamily: fonts.medium, marginTop: 2 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photo: { width: 72, height: 72, borderRadius: 10 },
});
