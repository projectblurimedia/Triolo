import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { PhoneVerification } from '@/components/PhoneVerification';
import { AddressPicker, AddressValue, EMPTY_ADDRESS } from '@/components/AddressPicker';
import { ImagePickerField, PickedImage } from '@/components/ImagePickerField';
import { Button } from '@/components/Button';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useCreateWorkerProfile } from '@/hooks/useWorkerMutations';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { useAuthStore } from '@/state/authStore';

const SKILL_CATEGORIES = [
  { key: 'electrician', icon: 'bolt' as const },
  { key: 'plumber', icon: 'faucet' as const },
  { key: 'painter', icon: 'paint-roller' as const },
  { key: 'carpenter', icon: 'hammer' as const },
  { key: 'mechanic', icon: 'wrench' as const },
  { key: 'cleaner', icon: 'broom' as const },
  { key: 'mason', icon: 'trowel' as const },
];

/**
 * One screen, one form — Full Name/Mobile Number (via `PhoneVerification`) sit alongside
 * the Worker fields (skills, experience, address, photos) instead of a separate
 * Register→Otp detour followed by a distinct `ChooseCapability`→`WorkerRegistration` chain,
 * per explicit instruction that registration should be "one place" (already applied to
 * `registration-web`; this mirrors it in-app). Submit is disabled until the mobile number
 * is verified — everything else is fillable in any order.
 *
 * Lives in `AuthStackParamList`, reachable directly from `WelcomeScreen` — not
 * `MainStackParamList` — since it must keep rendering before a session exists.
 * `authStore.isCompletingRegistration` (set on mount, cleared once this screen's own
 * `createProfile` mutation succeeds) is what keeps it mounted through the moment
 * `PhoneVerification`'s inline OTP flow calls `setSession()`: without that flag,
 * `RootNavigator` would swap to `MainNavigator` the instant `accessToken` became truthy,
 * unmounting this screen before the user ever reached the skill/address fields. See
 * `RootNavigator`'s own doc comment for the swap condition this flag participates in.
 */
export function RegisterWorkerScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const createProfile = useCreateWorkerProfile();
  const setCompletingRegistration = useAuthStore((state) => state.setCompletingRegistration);

  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [verified, setVerified] = useState(false);

  const [skillCategories, setSkillCategories] = useState<string[]>([]);
  const [otherSkillEntries, setOtherSkillEntries] = useState<string[]>([]);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherInputValue, setOtherInputValue] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [address, setAddress] = useState<AddressValue>(EMPTY_ADDRESS);
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCompletingRegistration(true);
    return () => setCompletingRegistration(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSkill = (key: string) => {
    setSkillCategories((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const orderedSkills = [...SKILL_CATEGORIES].sort(
    (a, b) => Number(skillCategories.includes(b.key)) - Number(skillCategories.includes(a.key)),
  );

  const commitOtherEntry = () => {
    const trimmed = otherInputValue.trim();
    if (trimmed) {
      const matchedSkill = SKILL_CATEGORIES.find(
        (skill) => t(`workerProfile.skills.${skill.key}`).toLowerCase() === trimmed.toLowerCase(),
      );
      if (matchedSkill) {
        setSkillCategories((prev) => (prev.includes(matchedSkill.key) ? prev : [...prev, matchedSkill.key]));
      } else {
        setOtherSkillEntries((prev) => {
          const existingIndex = prev.findIndex((entry) => entry.toLowerCase() === trimmed.toLowerCase());
          if (existingIndex !== -1) {
            const existing = prev[existingIndex];
            return [existing, ...prev.filter((_, i) => i !== existingIndex)];
          }
          return [...prev, trimmed];
        });
      }
    }
    setOtherInputValue('');
    setShowOtherInput(false);
  };

  const removeOtherEntry = (index: number) => {
    setOtherSkillEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    setError(null);
    const includesOther = otherSkillEntries.length > 0;
    if (
      (skillCategories.length === 0 && !includesOther) ||
      !experienceYears.trim() ||
      !address.city.trim() ||
      !address.district.trim() ||
      !address.state.trim() ||
      !/^[0-9]{6}$/.test(address.pincode)
    ) {
      setError(t('errors.VALIDATION_ERROR'));
      return;
    }

    createProfile.mutate(
      {
        skillCategories: includesOther ? [...skillCategories, 'other'] : skillCategories,
        otherSkillDescription: includesOther ? otherSkillEntries.join(', ') : undefined,
        experienceYears: Number(experienceYears),
        latitude: address.latitude,
        longitude: address.longitude,
        area: address.area.trim() || undefined,
        city: address.city.trim(),
        district: address.district.trim(),
        state: address.state.trim(),
        pincode: address.pincode,
        portfolioPhotos: photos,
      },
      {
        onSuccess: () => {
          showToast({ variant: 'success', title: t('workerProfile.successTitle'), message: t('workerProfile.successMessage') });
          // Lets RootNavigator swap to MainNavigator now — it'll land on ChooseCapability,
          // which shows this freshly-created profile's Pending status.
          setCompletingRegistration(false);
        },
        onError: (err) => {
          const message = getLocalizedErrorMessage(err, t);
          setError(message);
          showToast({ variant: 'error', title: t('common.errorTitle'), message });
        },
      },
    );
  };

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('workerProfile.subtitle')}</Text>

        <PhoneVerification
          fullName={fullName}
          onFullNameChange={setFullName}
          mobileNumber={mobileNumber}
          onMobileNumberChange={setMobileNumber}
          verified={verified}
          onVerified={() => setVerified(true)}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>{t('workerProfile.skillLabel')}</Text>
        <View style={styles.chipRow}>
          {orderedSkills.map((skill) => {
            const isActive = skillCategories.includes(skill.key);
            return (
              <Pressable key={skill.key} onPress={() => toggleSkill(skill.key)}>
                {isActive ? (
                  <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
                    <FontAwesome6 name={skill.icon} size={12} color="#FFFFFF" solid />
                    <Text style={[styles.chipLabel, { color: '#FFFFFF' }]}>{t(`workerProfile.skills.${skill.key}`)}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[styles.chip, styles.chipInactive, { borderColor: colors.border }]}>
                    <FontAwesome6 name={skill.icon} size={12} color={colors.textMuted} solid />
                    <Text style={[styles.chipLabel, { color: colors.text }]}>{t(`workerProfile.skills.${skill.key}`)}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
          {otherSkillEntries.map((entry, index) => (
            <Pressable key={`other-${entry}-${index}`} onPress={() => removeOtherEntry(index)}>
              <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
                <Text style={[styles.chipLabel, { color: '#FFFFFF' }]} numberOfLines={1}>
                  {entry}
                </Text>
                <FontAwesome6 name="xmark" size={10} color="#FFFFFF" solid />
              </LinearGradient>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowOtherInput(true)}>
            <View style={[styles.chip, styles.addNewChip, { borderColor: colors.primary, backgroundColor: `${colors.primary}16` }]}>
              <View style={[styles.addNewBadge, { backgroundColor: colors.primary }]}>
                <FontAwesome6 name="plus" size={9} color="#FFFFFF" solid />
              </View>
              <Text style={[styles.chipLabel, { color: colors.primary, fontFamily: fonts.semiBold }]}>{t('common.addNew')}</Text>
            </View>
          </Pressable>
        </View>

        {showOtherInput ? (
          <>
            <Text style={[styles.label, { color: colors.textMuted }]}>{t('workerProfile.otherSkillLabel')}</Text>
            <View style={styles.otherInputRow}>
              <View style={styles.otherInputField}>
                <TextField
                  containerStyle={styles.noMargin}
                  value={otherInputValue}
                  onChangeText={setOtherInputValue}
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={commitOtherEntry}
                  autoFocus
                />
              </View>
              <Pressable
                style={{ opacity: otherInputValue.trim() ? 1 : 0.5 }}
                onPress={commitOtherEntry}
                disabled={!otherInputValue.trim()}
                accessibilityLabel={t('common.done')}
              >
                <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.otherDoneGradient}>
                  <FontAwesome6 name="check" size={16} color="#FFFFFF" solid />
                </LinearGradient>
              </Pressable>
            </View>
          </>
        ) : null}

        <TextField
          label={t('workerProfile.experienceLabel')}
          value={experienceYears}
          onChangeText={setExperienceYears}
          keyboardType="number-pad"
          maxLength={2}
        />

        <AddressPicker value={address} onChange={setAddress} />

        <ImagePickerField label={t('workerProfile.portfolioLabel')} images={photos} onChange={setPhotos} />

        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

        <Button label={t('common.submit')} onPress={handleSubmit} loading={createProfile.isPending} disabled={!verified} />
        {!verified ? <Text style={[styles.hint, { color: colors.textMuted }]}>{t('auth.verifyToSubmitHint')}</Text> : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 40 },
  subtitle: { ...typography.body, marginBottom: 18 },
  label: { ...typography.caption, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14 },
  chipInactive: { borderWidth: 1 },
  addNewChip: { borderWidth: 1.5 },
  addNewBadge: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { ...typography.caption, fontFamily: fonts.medium },
  otherInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  otherInputField: { flex: 1 },
  noMargin: { marginBottom: 0 },
  otherDoneGradient: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  error: { ...typography.caption, marginBottom: 12 },
  hint: { ...typography.caption, textAlign: 'center', marginTop: 10 },
});
