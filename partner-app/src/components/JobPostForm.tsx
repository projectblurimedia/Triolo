import React, { ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { TextField } from './TextField';
import { saveAccountName } from '@/utils/saveAccountName';
import { Button } from './Button';
import { LocationField } from './LocationField';
import { ProfilePhotoField } from './ProfilePhotoField';
import { WorkType, WorkTypePicker, workTypeLabel } from './WorkTypePicker';
import { PickedImage } from './ImagePickerField';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { AVAILABILITIES, Availability, JobPost, jobSeekerService, PayPeriod } from '@/services/jobSeekerService';
import { JOB_POST_QUERY_KEY, useSaveJobPost } from '@/hooks/useJobPost';
import { useAuthStore } from '@/state/authStore';
import { PlaceValue } from '@/utils/place';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { payIfNeeded } from '@/state/payGateStore';

interface JobPostFormProps {
  /** The existing post when editing; omitted for a new one. */
  post?: JobPost | null;
  /** Shown above the fields, below the photo (registration puts name + phone verification here). */
  header?: ReactNode;
  /** The person's name for the photo's initials while they have no photo (registration, before sign-in). */
  displayName?: string;
  /** Registration keeps its tips in an Info card instead. */
  showPhotoHint?: boolean;
  /** Signed-in editing: show the person's name so they can change it (it belongs to the account). */
  showNameField?: boolean;
  /** Keeps Save disabled, e.g. until the phone number is verified. */
  locked?: boolean;
  lockedHint?: string;
  onSaved: (post: JobPost) => void;
}

/**
 * "I'm looking for work" form: a profile photo, the kind of work (a dropdown, with the person's
 * own words when it isn't listed), expected pay per day or per month, full-time / part-time /
 * live-in, experience, skills, a few words about yourself and where you are (GPS, so customers
 * nearby can find you). Saves with PUT (create or update), then uploads or removes the photo.
 */
export function JobPostForm({
  post,
  header,
  displayName,
  showPhotoHint = true,
  showNameField = false,
  locked = false,
  lockedHint,
  onSaved,
}: JobPostFormProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const queryClient = useQueryClient();
  const account = useAuthStore((state) => state.account);
  const save = useSaveJobPost();

  const [workType, setWorkType] = useState<WorkType | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payPeriod, setPayPeriod] = useState<PayPeriod>('monthly');
  const [availability, setAvailability] = useState<Availability>('full_time');
  const [experience, setExperience] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [description, setDescription] = useState('');
  const [place, setPlace] = useState<PlaceValue | null>(null);
  // A newly picked photo (uploaded after saving), or `null` once the person removes theirs.
  const [newPhoto, setNewPhoto] = useState<PickedImage | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(account?.fullName ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!post) return;
    setWorkType({ category: post.category, custom: post.category === 'other' ? post.title : '' });
    setPayAmount(String(post.payAmount));
    setPayPeriod(post.payPeriod);
    setAvailability(post.availability);
    setExperience(String(post.experienceYears));
    setSkills(post.skills);
    setDescription(post.description ?? '');
    setPlace({ latitude: post.latitude, longitude: post.longitude, locationName: post.locationAddress });
    setNewPhoto(null);
    setPhotoRemoved(false);
  }, [post]);

  const shownPhoto = newPhoto?.uri ?? (photoRemoved ? null : (post?.photoUrl ?? null));

  const addSkill = () => {
    const value = skillInput.trim();
    if (value && !skills.some((skill) => skill.toLowerCase() === value.toLowerCase()) && skills.length < 15) {
      setSkills((prev) => [...prev, value]);
    }
    setSkillInput('');
  };

  const handleSave = async () => {
    setError(null);
    if (showNameField && fullName.trim().length < 2) return setError(t('auth.nameBeforeVerify'));
    const amount = Number(payAmount);
    if (!workType) return setError(t('jobPost.errorCategory'));
    if (!Number.isInteger(amount) || amount < 1) return setError(t('jobPost.errorPay'));
    if (!place) return setError(t('jobPost.errorLocation'));
    // Publishing a new post without a partner plan: pay once (the admin's fee) — or subscribe.
    if (!post && !(await payIfNeeded('job_post'))) return;

    setSaving(true);
    try {
      if (showNameField) await saveAccountName(fullName);
      let saved = await save.mutateAsync({
        category: workType.category,
        // The work itself is the title: the person's own words for "other", else the category name.
        title: workTypeLabel(workType, t).trim(),
        payAmount: amount,
        payPeriod,
        availability,
        experienceYears: Number(experience) || 0,
        skills: skillInput.trim() ? [...skills, skillInput.trim()] : skills,
        description: description.trim() || undefined,
        latitude: place.latitude,
        longitude: place.longitude,
        // Only the place name is shown to customers.
        locationAddress: place.locationName,
      });
      try {
        if (newPhoto) saved = await jobSeekerService.uploadPhoto(newPhoto);
        else if (photoRemoved && post?.photoUrl) saved = await jobSeekerService.removePhoto();
        queryClient.setQueryData(JOB_POST_QUERY_KEY, saved);
      } catch {
        showToast({ variant: 'error', title: t('jobPost.photoFailed') });
      }
      setSkillInput('');
      showToast({ variant: 'success', title: t(post ? 'jobPost.updatedToast' : 'jobPost.postedToast') });
      onSaved(saved);
    } catch (err) {
      const message = getLocalizedErrorMessage(err, t);
      setError(message);
      showToast({ variant: 'error', title: t('common.errorTitle'), message });
    } finally {
      setSaving(false);
    }
  };

  const chip = (key: string, label: string, active: boolean, onPress: () => void) => (
    <Pressable key={key} onPress={onPress}>
      {active ? (
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
          <Text style={[styles.chipLabel, { color: '#FFFFFF' }]}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={[styles.chip, styles.chipInactive, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.chipLabel, { color: colors.text }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <View>
      <ProfilePhotoField
        uri={shownPhoto}
        name={displayName ?? account?.fullName}
        title={t('jobPost.photoLabel')}
        hint={showPhotoHint ? t('jobPost.photoHint') : undefined}
        onPick={(image) => {
          setNewPhoto(image);
          setPhotoRemoved(false);
        }}
        onRemove={() => {
          setNewPhoto(null);
          setPhotoRemoved(true);
        }}
      />

      {header}

      {showNameField ? (
        <TextField
          label={t('auth.fullNameLabel')}
          value={fullName}
          onChangeText={setFullName}
          placeholder={t('auth.fullNamePlaceholder')}
          maxLength={100}
          importantForAutofill="no"
        />
      ) : null}

      <WorkTypePicker value={workType} onChange={setWorkType} />

      <Text style={[styles.label, { color: colors.textMuted }]}>{t('jobPost.payLabel')}</Text>
      <View style={styles.payRow}>
        <View style={styles.flex}>
          <TextField
            containerStyle={styles.noMargin}
            value={payAmount}
            onChangeText={(text) => setPayAmount(text.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={8}
            placeholder={t('jobPost.payPlaceholder')}
          />
        </View>
        <View style={[styles.periodSwitch, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {(['daily', 'monthly'] as PayPeriod[]).map((value) => (
            <Pressable
              key={value}
              onPress={() => setPayPeriod(value)}
              style={[styles.periodOption, payPeriod === value ? { backgroundColor: colors.primary } : null]}
            >
              <Text style={[styles.periodText, { color: payPeriod === value ? '#FFFFFF' : colors.textMuted }]}>
                {t(`jobPost.period.${value}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={[styles.label, { color: colors.textMuted }]}>{t('jobPost.availabilityLabel')}</Text>
      <View style={styles.chipRow}>
        {AVAILABILITIES.map((value) =>
          chip(value, t(`jobPost.availability.${value}`), availability === value, () => setAvailability(value)),
        )}
      </View>

      <TextField
        label={t('jobPost.experienceLabel')}
        value={experience}
        onChangeText={(text) => setExperience(text.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={2}
      />

      <Text style={[styles.label, { color: colors.textMuted }]}>{t('jobPost.skillsLabel')}</Text>
      {skills.length > 0 ? (
        <View style={styles.chipRow}>
          {skills.map((skill, index) => (
            <Pressable key={`${skill}-${index}`} onPress={() => setSkills((prev) => prev.filter((_, i) => i !== index))}>
              <View
                style={[
                  styles.chip,
                  { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}40`, borderWidth: 1 },
                ]}
              >
                <Text style={[styles.chipLabel, { color: colors.primary }]}>{skill}</Text>
                <FontAwesome6 name="xmark" size={10} color={colors.primary} solid />
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.payRow}>
        <View style={styles.flex}>
          <TextField
            containerStyle={styles.noMargin}
            value={skillInput}
            onChangeText={setSkillInput}
            maxLength={40}
            placeholder={t('jobPost.skillsPlaceholder')}
            returnKeyType="done"
            onSubmitEditing={addSkill}
          />
        </View>
        <Pressable onPress={addSkill} disabled={!skillInput.trim()} style={{ opacity: skillInput.trim() ? 1 : 0.5 }}>
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addButton}>
            <FontAwesome6 name="plus" size={16} color="#FFFFFF" solid />
          </LinearGradient>
        </Pressable>
      </View>

      <TextField
        label={t('jobPost.aboutLabel')}
        value={description}
        onChangeText={setDescription}
        maxLength={500}
        multiline
        placeholder={t('jobPost.aboutPlaceholder')}
      />

      <LocationField label={t('jobPost.locationLabel')} value={place} onChange={setPlace} />

      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

      <Button label={t(post ? 'jobPost.save' : 'jobPost.post')} onPress={handleSave} loading={saving} disabled={locked} />
      {locked && lockedHint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{lockedHint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  label: { ...typography.caption, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14 },
  chipInactive: { borderWidth: 1 },
  chipLabel: { ...typography.caption, fontFamily: fonts.medium },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  noMargin: { marginBottom: 0 },
  periodSwitch: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 3, gap: 3 },
  periodOption: { paddingHorizontal: 14, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  periodText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13 },
  addButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  error: { ...typography.caption, marginBottom: 12 },
  hint: { ...typography.caption, textAlign: 'center', marginTop: 10 },
});
