import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { LocationPicker, LocationValue } from '@/components/LocationPicker';
import { ImagePickerField, PickedImage } from '@/components/ImagePickerField';
import { Button } from '@/components/Button';
import { ConfirmModal } from '@/components/ConfirmModal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useCreateWorkerProfile, useDeleteWorkerProfile, useUpdateWorkerProfile } from '@/hooks/useWorkerMutations';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { MainStackParamList } from '@/navigation/types';

const DELETE_GRADIENT = ['#ef4444', '#dc2626'] as const;

type Props = NativeStackScreenProps<MainStackParamList, 'WorkerRegistration'>;

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
 * Adapted from user-app's WorkerProfileModal — same fields, same multi-select chip +
 * "+ Add New" pattern, same shared LocationPicker/ImagePickerField, submitting to the same
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

  const [skillCategories, setSkillCategories] = useState<string[]>([]);
  const [otherSkillEntries, setOtherSkillEntries] = useState<string[]>([]);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherInputValue, setOtherInputValue] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [location, setLocation] = useState<LocationValue>({ latitude: null, longitude: null, address: '' });
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (profile) {
      setSkillCategories(profile.skillCategories.filter((key) => key !== 'other'));
      setOtherSkillEntries(profile.otherSkillDescription ? profile.otherSkillDescription.split(', ').filter(Boolean) : []);
      setExperienceYears(String(profile.experienceYears));
      setLocation({ latitude: profile.latitude, longitude: profile.longitude, address: profile.locationAddress ?? '' });
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

  const handleSubmit = () => {
    setError(null);
    const includesOther = otherSkillEntries.length > 0;
    if ((skillCategories.length === 0 && !includesOther) || !experienceYears.trim() || !location.address.trim()) {
      setError(t('errors.VALIDATION_ERROR'));
      return;
    }

    const commonPayload = {
      skillCategories: includesOther ? [...skillCategories, 'other'] : skillCategories,
      otherSkillDescription: includesOther ? otherSkillEntries.join(', ') : undefined,
      experienceYears: Number(experienceYears),
      latitude: location.latitude,
      longitude: location.longitude,
      locationAddress: location.address,
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
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {t(isEditMode ? 'workerProfile.editSubtitle' : 'workerProfile.subtitle')}
        </Text>

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
          <View style={styles.otherInputRow}>
            <View style={styles.otherInputField}>
              <TextField
                label={t('workerProfile.otherSkillLabel')}
                value={otherInputValue}
                onChangeText={setOtherInputValue}
                maxLength={40}
                returnKeyType="done"
                onSubmitEditing={commitOtherEntry}
                autoFocus
              />
            </View>
            <Pressable
              style={[styles.otherDoneButton, { opacity: otherInputValue.trim() ? 1 : 0.5 }]}
              onPress={commitOtherEntry}
              disabled={!otherInputValue.trim()}
              accessibilityLabel={t('common.done')}
            >
              <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.otherDoneGradient}>
                <FontAwesome6 name="check" size={16} color="#FFFFFF" solid />
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}

        <TextField
          label={t('workerProfile.experienceLabel')}
          value={experienceYears}
          onChangeText={setExperienceYears}
          keyboardType="number-pad"
          maxLength={2}
        />

        <LocationPicker value={location} onChange={setLocation} />

        <ImagePickerField label={t('workerProfile.portfolioLabel')} images={photos} onChange={setPhotos} />

        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

        <Button
          label={t(isEditMode ? 'common.saveChanges' : 'common.submit')}
          onPress={handleSubmit}
          loading={isEditMode ? updateProfile.isPending : createProfile.isPending}
        />

        {isEditMode ? (
          <Pressable style={styles.deleteButton} onPress={() => setShowDeleteConfirm(true)}>
            <FontAwesome6 name="trash" size={14} color={colors.error} solid />
            <Text style={[styles.deleteText, { color: colors.error }]}>{t('workerProfile.deleteAction')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

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
  body: { paddingBottom: 40 },
  subtitle: { ...typography.body, marginBottom: 18 },
  label: { ...typography.caption, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14 },
  chipInactive: { borderWidth: 1 },
  addNewChip: { borderWidth: 1.5 },
  addNewBadge: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { ...typography.caption, fontFamily: fonts.medium },
  otherInputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  otherInputField: { flex: 1 },
  otherDoneButton: { marginTop: 22 },
  otherDoneGradient: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  error: { ...typography.caption, marginBottom: 12 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, paddingVertical: 10 },
  deleteText: { ...typography.body, fontFamily: fonts.semiBold },
});
