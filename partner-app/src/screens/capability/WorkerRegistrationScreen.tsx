import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { saveAccountName } from '@/utils/saveAccountName';
import { InfoTipsButton } from '@/components/InfoTipsButton';
import { KeyboardAwareView } from '@/components/KeyboardAwareView';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { LocationField } from '@/components/LocationField';
import { ProfilePhotoField } from '@/components/ProfilePhotoField';
import { PlaceValue, placeFromProfile } from '@/utils/place';
import { ImagePickerField, PickedImage } from '@/components/ImagePickerField';
import { Button } from '@/components/Button';
import { ConfirmModal } from '@/components/ConfirmModal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useCreateWorkerProfile, useDeleteWorkerProfile, useUpdateWorkerProfile } from '@/hooks/useWorkerMutations';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { MainStackParamList } from '@/navigation/types';
import { CancelButton } from '@/components/CancelButton';
import { useAuthStore } from '@/state/authStore';
import { CategoryPicker } from '@/components/CategoryPicker';
import { workersService } from '@/services/workersService';
import { SKILL_CATEGORIES } from '@/constants/categories';

const DELETE_GRADIENT = ['#ef4444', '#dc2626'] as const;

type Props = NativeStackScreenProps<MainStackParamList, 'WorkerRegistration'>;


/**
 * Adapted from user-app's WorkerProfileModal — same fields, same multi-select chip +
 * "+ Add New" pattern, same shared LocationField/ImagePickerField, submitting to the same
 * `POST /workers/me/profile`. A plain screen here, not a `Modal`, since navigation itself
 * provides the "come from somewhere, go back" framing a Modal gave the original.
 *
 * Also doubles as the edit form — an optional `route.params.profile` (passed by MyInfoScreen's
 * edit action, or ChooseCapabilityScreen in principle) switches into edit mode (`isEditMode`):
 * prefilled via a `useEffect` keyed on the profile, `PATCH` instead of `POST`, plus a Delete
 * action gated behind the existing generic `ConfirmModal`. Mirrors WorkerProfileModal's own
 * edit-mode branch field-for-field.
 */
export function WorkerRegistrationScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const profile = route.params?.profile;
  const isEditMode = !!profile;
  const createProfile = useCreateWorkerProfile();
  const updateProfile = useUpdateWorkerProfile();
  const deleteProfile = useDeleteWorkerProfile();
  const account = useAuthStore((state) => state.account);

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
  const [fullName, setFullName] = useState(account?.fullName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (profile) {
      setSkillCategories(profile.skillCategories.filter((key) => key !== 'other'));
      setOtherSkillEntries(profile.otherSkillDescription ? profile.otherSkillDescription.split(', ').filter(Boolean) : []);
      setExperienceYears(String(profile.experienceYears));
      setPlace(placeFromProfile(profile));
      setProfilePhoto(null);
      setPhotoRemoved(false);
      setPhotos(
        profile.portfolioPhotoUrls.map((url) => ({ uri: url, name: url.split('/').pop() ?? 'photo.jpg', type: 'image/jpeg' })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

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

  const handleMutationError = (err: unknown) => {
    const message = getLocalizedErrorMessage(err, t);
    setError(message);
    showToast({ variant: 'error', title: t('common.errorTitle'), message });
  };

  const handleSubmit = async () => {
    setError(null);
    if (fullName.trim().length < 2) {
      setError(t('auth.nameBeforeVerify'));
      return;
    }
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
    try {
      await saveAccountName(fullName);
    } catch (err) {
      handleMutationError(err);
      return;
    }

    const commonPayload = {
      skillCategories: includesOther ? [...skillCategories, 'other'] : skillCategories,
      otherSkillDescription: includesOther ? otherSkillEntries.join(', ') : undefined,
      experienceYears: Number(experienceYears),
      place,
      profilePhoto: profilePhoto ?? (photoRemoved ? null : undefined),
    };

    if (isEditMode) {
      const existingPhotoUrls = photos.filter((image) => image.uri.startsWith('http')).map((image) => image.uri);
      const newPhotos = photos.filter((image) => !image.uri.startsWith('http'));
      updateProfile.mutate(
        { ...commonPayload, existingPhotoUrls, portfolioPhotos: newPhotos },
        {
          onSuccess: () => {
            showToast({
              variant: 'success',
              title: t('workerProfile.updateSuccessTitle'),
              message: t('workerProfile.updateSuccessMessage'),
            });
            navigation.replace('MyInfo', { capability: 'worker' });
          },
          onError: handleMutationError,
        },
      );
    } else {
      createProfile.mutate(
        { ...commonPayload, portfolioPhotos: photos },
        {
          onSuccess: () => {
            showToast({ variant: 'success', title: t('workerProfile.successTitle'), message: t('workerProfile.successMessage') });
            navigation.replace('MyInfo', { capability: 'worker' });
          },
          onError: handleMutationError,
        },
      );
    }
  };

  const handleDelete = () => {
    deleteProfile.mutate(undefined, {
      onSuccess: () => {
        setShowDeleteConfirm(false);
        showToast({
          variant: 'success',
          title: t('workerProfile.deleteSuccessTitle'),
          message: t('workerProfile.deleteSuccessMessage'),
        });
        navigation.popToTop();
      },
      onError: (err) => {
        setShowDeleteConfirm(false);
        showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(err, t) });
      },
    });
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
              { icon: 'briefcase', text: t(isEditMode ? 'workerProfile.editSubtitle' : 'workerProfile.subtitle') },
              { icon: 'camera', text: t('profilePhoto.workerHint') },
              { icon: 'location-dot', text: t('infoTips.location') },
              { icon: 'shield-halved', text: t('infoTips.verification') },
            ]}
          />

          <ProfilePhotoField
            uri={profilePhoto?.uri ?? (photoRemoved ? null : (profile?.profilePhotoUrl ?? null))}
            name={account?.fullName}
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

          <TextField
            label={t('auth.fullNameLabel')}
            value={fullName}
            onChangeText={setFullName}
            placeholder={t('auth.fullNamePlaceholder')}
            maxLength={100}
            importantForAutofill="no"
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
            label={t(isEditMode ? 'common.saveChanges' : 'common.submit')}
            onPress={handleSubmit}
            loading={isEditMode ? updateProfile.isPending : createProfile.isPending}
          />

          {isEditMode ? (
            <CancelButton icon="trash" label={t('workerProfile.deleteAction')} onPress={() => setShowDeleteConfirm(true)} />
          ) : null}
        </ScrollView>
      </KeyboardAwareView>

      <ConfirmModal
        visible={showDeleteConfirm}
        icon="trash"
        gradient={DELETE_GRADIENT}
        title={t('workerProfile.deleteConfirmTitle')}
        message={t('workerProfile.deleteConfirmMessage')}
        confirmLabel={t('common.delete')}
        loading={deleteProfile.isPending}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
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
