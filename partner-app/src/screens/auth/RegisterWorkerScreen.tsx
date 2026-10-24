import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { KeyboardAwareView } from '@/components/KeyboardAwareView';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { PhoneVerification } from '@/components/PhoneVerification';
import { InfoTipsButton } from '@/components/InfoTipsButton';
import { LocationField } from '@/components/LocationField';
import { ProfilePhotoField } from '@/components/ProfilePhotoField';
import { PlaceValue } from '@/utils/place';
import { ImagePickerField, PickedImage } from '@/components/ImagePickerField';
import { Button } from '@/components/Button';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useCreateWorkerProfile } from '@/hooks/useWorkerMutations';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { workersService } from '@/services/workersService';
import { useAuthStore } from '@/state/authStore';
import { CategoryPicker } from '@/components/CategoryPicker';
import { SKILL_CATEGORIES } from '@/constants/categories';


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
  const [place, setPlace] = useState<PlaceValue | null>(null);
  // A newly picked profile photo (uploaded after saving), or a removal of the saved one.
  const [profilePhoto, setProfilePhoto] = useState<PickedImage | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
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
    const years = Number(experienceYears);
    const problem =
      skillCategories.length === 0 && !includesOther
        ? t('formErrors.skills')
        : !experienceYears.trim() || !Number.isInteger(years) || years < 0 || years > 60
          ? t('formErrors.experience')
          : !place
            ? t('formErrors.location')
            : null;
    if (problem) {
      setError(problem);
      showToast({ variant: 'error', title: t('formErrors.title'), message: problem });
      return;
    }
    // Already reported above; this only tells TypeScript.
    if (!place) return;

    createProfile.mutate(
      {
        skillCategories: includesOther ? [...skillCategories, 'other'] : skillCategories,
        otherSkillDescription: includesOther ? otherSkillEntries.join(', ') : undefined,
        experienceYears: Number(experienceYears),
        place,
        profilePhoto: profilePhoto ?? (photoRemoved ? null : undefined),
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
      <KeyboardAwareView>
        <ScrollView
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <InfoTipsButton
            title={t('infoTips.workerTitle')}
            tips={[
              { icon: 'briefcase', text: t('workerProfile.subtitle') },
              { icon: 'camera', text: t('profilePhoto.workerHint') },
              { icon: 'mobile-screen-button', text: t('auth.verifyToSubmitHint') },
              { icon: 'location-dot', text: t('infoTips.location') },
              { icon: 'shield-halved', text: t('infoTips.verification') },
            ]}
          />

          <ProfilePhotoField
            uri={profilePhoto?.uri ?? null}
            name={fullName}
            title={t('profilePhoto.workerTitle')}
            onPick={(image) => {
              setProfilePhoto(image);
              setPhotoRemoved(false);
            }}
            onRemove={() => {
              setProfilePhoto(null);
              setPhotoRemoved(true);
            }}
          />

          <PhoneVerification
            fullName={fullName}
            onFullNameChange={setFullName}
            mobileNumber={mobileNumber}
            onMobileNumberChange={setMobileNumber}
            verified={verified}
            onVerified={() => {
              setVerified(true);
              // One account per number: if this one already has this profile, there is nothing to
              // register — they are signed in, so open the app.
              workersService
                .getMyProfile()
                .then((existing) => {
                  if (!existing) return;
                  showToast({ variant: 'info', title: t('auth.alreadyWorker') });
                  setCompletingRegistration(false);
                })
                .catch(() => undefined);
            }}
          />

          <Text style={[styles.label, { color: colors.textMuted }]}>{t('workerProfile.skillLabel')}</Text>
          {/* One searchable list, A–Z: pick several; your own words become a new one (or reuse one
              another partner already added). */}
          <CategoryPicker
            title={t('workerProfile.skillLabel')}
            placeholder={t('picker.chooseSkills')}
            options={SKILL_CATEGORIES.map((entry) => ({ key: entry.key, label: t(`workerProfile.skills.${entry.key}`), icon: entry.icon }))}
            selected={[...skillCategories.filter((key) => key !== 'other'), ...otherSkillEntries]}
            onChange={(next) => {
              const fixedKeys = new Set<string>(SKILL_CATEGORIES.map((entry) => entry.key));
              setSkillCategories(next.filter((key) => fixedKeys.has(key)));
              setOtherSkillEntries(next.filter((key) => !fixedKeys.has(key)));
            }}
            searchCustom={workersService.customSkills}
            allowAdd
            style={styles.picker}
          />

          <TextField
            label={t('workerProfile.experienceLabel')}
            value={experienceYears}
            onChangeText={setExperienceYears}
            keyboardType="number-pad"
            maxLength={2}
          />

          <LocationField label={t('location.workerPlaceLabel')} value={place} onChange={setPlace} />

          <ImagePickerField label={t('workerProfile.portfolioLabel')} images={photos} onChange={setPhotos} />

          {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

          <Button
            label={t('auth.registerButton')}
            onPress={handleSubmit}
            loading={createProfile.isPending}
            disabled={!verified}
          />
        </ScrollView>
      </KeyboardAwareView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  picker: { marginBottom: 16 },
  body: { paddingBottom: 40 },
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
});
