import React, { ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { TextField } from './TextField';
import { Button } from './Button';
import { LoadingIndicator } from './LoadingIndicator';
import { WorkType, WorkTypePicker, workTypeLabel } from './WorkTypePicker';
import { PickedImage } from './ImagePickerField';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { AVAILABILITIES, Availability, JobPost, jobSeekerService, PayPeriod } from '@/services/jobSeekerService';
import { JOB_POST_QUERY_KEY, useSaveJobPost } from '@/hooks/useJobPost';
import { useAuthStore } from '@/state/authStore';
import { ensureLocationOn } from '@/utils/ensureLocationOn';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { SmartImage } from './SmartImage';

interface JobPostFormProps {
  /** The existing post when editing; omitted for a new one. */
  post?: JobPost | null;
  /** Shown above the fields (registration puts name + phone verification here). */
  header?: ReactNode;
  /** Keeps Save disabled, e.g. until the phone number is verified. */
  locked?: boolean;
  lockedHint?: string;
  onSaved: (post: JobPost) => void;
}

interface Place {
  latitude: number;
  longitude: number;
}

const PHOTO_SIZE = 96;

function initialsOf(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.length === 1 ? parts[0][0].toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * "I'm looking for work" form: a profile photo, the kind of work (a dropdown, with the person's
 * own words when it isn't listed), expected pay per day or per month, full-time / part-time /
 * live-in, experience, skills, a few words about yourself and where you are (GPS, so customers
 * nearby can find you). Saves with PUT (create or update), then uploads or removes the photo.
 */
export function JobPostForm({ post, header, locked = false, lockedHint, onSaved }: JobPostFormProps) {
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
  const [place, setPlace] = useState<Place | null>(null);
  const [address, setAddress] = useState('');
  const [locating, setLocating] = useState(false);
  // A newly picked photo (uploaded after saving), or `null` once the person removes theirs.
  const [newPhoto, setNewPhoto] = useState<PickedImage | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
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
    setPlace({ latitude: post.latitude, longitude: post.longitude });
    setAddress(post.locationAddress);
    setNewPhoto(null);
    setPhotoRemoved(false);
  }, [post]);

  const shownPhoto = newPhoto?.uri ?? (photoRemoved ? null : (post?.photoUrl ?? null));

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast({ variant: 'error', title: t('jobPost.photoPermission') });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setNewPhoto({ uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.mimeType ?? 'image/jpeg' });
    setPhotoRemoved(false);
  };

  const removePhoto = () => {
    setNewPhoto(null);
    setPhotoRemoved(true);
  };

  const detectLocation = async () => {
    setLocating(true);
    try {
      if (!(await ensureLocationOn())) {
        showToast({ variant: 'error', title: t('jobPost.locationOffTitle'), message: t('jobPost.locationOffMessage') });
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;
      setPlace({ latitude, longitude });
      try {
        const [found] = await Location.reverseGeocodeAsync({ latitude, longitude });
        const text = found
          ? [found.name, found.street, found.city ?? found.subregion, found.region].filter(Boolean).join(', ')
          : '';
        if (text) setAddress(text);
      } catch {
        // Address lookup failed — the person can type it; the GPS point is what search uses.
      }
    } catch {
      showToast({ variant: 'error', title: t('common.errorTitle'), message: t('jobPost.locationFailed') });
    } finally {
      setLocating(false);
    }
  };

  const addSkill = () => {
    const value = skillInput.trim();
    if (value && !skills.some((skill) => skill.toLowerCase() === value.toLowerCase()) && skills.length < 15) {
      setSkills((prev) => [...prev, value]);
    }
    setSkillInput('');
  };

  const handleSave = async () => {
    setError(null);
    const amount = Number(payAmount);
    if (!workType) return setError(t('jobPost.errorCategory'));
    if (!Number.isInteger(amount) || amount < 1) return setError(t('jobPost.errorPay'));
    if (!place) return setError(t('jobPost.errorLocation'));
    if (address.trim().length < 3) return setError(t('jobPost.errorAddress'));

    setSaving(true);
    try {
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
        locationAddress: address.trim(),
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
      {header}

      <View style={styles.photoSection}>
        <Pressable onPress={pickPhoto} accessibilityLabel={t('jobPost.photoLabel')}>
          <View style={[styles.photoRing, { borderColor: `${colors.primary}40` }]}>
            {shownPhoto ? (
              <SmartImage source={{ uri: shownPhoto }} style={styles.photo} />
            ) : (
              <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.photo}>
                <Text style={styles.initials}>{initialsOf(account?.fullName)}</Text>
              </LinearGradient>
            )}
          </View>
          <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
            <FontAwesome6 name="camera" size={12} color="#FFFFFF" solid />
          </View>
        </Pressable>
        <View style={styles.photoActions}>
          <Text style={[styles.photoTitle, { color: colors.text }]}>{t('jobPost.photoLabel')}</Text>
          <Text style={[styles.photoHint, { color: colors.textMuted }]}>{t('jobPost.photoHint')}</Text>
          <View style={styles.photoButtons}>
            <Pressable onPress={pickPhoto} hitSlop={6}>
              <Text style={[styles.photoLink, { color: colors.primary }]}>
                {t(shownPhoto ? 'jobPost.changePhoto' : 'jobPost.addPhoto')}
              </Text>
            </Pressable>
            {shownPhoto ? (
              <Pressable onPress={removePhoto} hitSlop={6}>
                <Text style={[styles.photoLink, { color: colors.error }]}>{t('jobPost.removePhoto')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

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
            placeholder={payPeriod === 'daily' ? '1000' : '30000'}
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

      <Text style={[styles.label, { color: colors.textMuted }]}>{t('jobPost.locationLabel')}</Text>
      <Pressable
        onPress={detectLocation}
        disabled={locating}
        style={[
          styles.locationButton,
          {
            borderColor: place ? colors.success : colors.primary,
            backgroundColor: `${place ? colors.success : colors.primary}12`,
          },
        ]}
      >
        {locating ? (
          <LoadingIndicator size={18} dotSize={3.5} color={colors.primary} />
        ) : (
          <FontAwesome6
            name={place ? 'circle-check' : 'location-crosshairs'}
            size={15}
            color={place ? colors.success : colors.primary}
            solid
          />
        )}
        <Text style={[styles.locationText, { color: place ? colors.success : colors.primary }]}>
          {t(place ? 'jobPost.locationSet' : 'jobPost.useLocation')}
        </Text>
      </Pressable>
      <TextField value={address} onChangeText={setAddress} maxLength={300} placeholder={t('jobPost.addressPlaceholder')} />

      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

      <Button label={t(post ? 'jobPost.save' : 'jobPost.post')} onPress={handleSave} loading={saving} disabled={locked} />
      {locked && lockedHint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{lockedHint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  label: { ...typography.caption, marginBottom: 8 },
  photoSection: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 22 },
  photoRing: { width: PHOTO_SIZE + 8, height: PHOTO_SIZE + 8, borderRadius: (PHOTO_SIZE + 8) / 2, borderWidth: 2, padding: 2 },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: PHOTO_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 30, lineHeight: 38 },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActions: { flex: 1 },
  photoTitle: { ...typography.body, fontFamily: fonts.semiBold },
  photoHint: { ...typography.caption, fontSize: 12, marginTop: 2, lineHeight: 17 },
  photoButtons: { flexDirection: 'row', gap: 18, marginTop: 8 },
  photoLink: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13 },
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
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  locationText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  error: { ...typography.caption, marginBottom: 12 },
  hint: { ...typography.caption, textAlign: 'center', marginTop: 10 },
});
