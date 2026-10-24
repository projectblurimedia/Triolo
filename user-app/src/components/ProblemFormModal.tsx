import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from './Button';
import { CategoryPicker } from './CategoryPicker';
import { ImagePickerField, PickedImage } from './ImagePickerField';
import { LocationField } from './LocationField';
import { PlaceValue } from '@/utils/place';
import { ToastHost } from './ToastHost';
import { SKILL_CATEGORIES } from '@/constants/categories';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { ProblemPost, problemsService } from '@/services/problemsService';
import { MY_PROBLEMS_QUERY_KEY } from '@/hooks/useProblems';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { useAdGate, useBusyAction } from './Ads';

interface ProblemFormModalProps {
  visible: boolean;
  onClose: () => void;
  /** Present → edit mode, prefilled from this post. Absent → add a new problem. */
  problem?: ProblemPost | null;
}

const MAX_PHOTOS = 5;
const MAX_QUOTATION = 1_000_000;

function isRemote(image: PickedImage): boolean {
  return image.uri.startsWith('http');
}

/**
 * Add/Edit form behind "Your Problems" (Services menu) — photos (camera or gallery, up to
 * 5), location (GPS or typed), the worker type(s) needed, the user's quotation, and an
 * optional description.
 *
 * Add: POST /problems, then each photo via POST /problems/:id/photos (one per request, to
 * stay under Vercel's 4.5MB body limit); if any photo fails the post is deleted again so a
 * retry never duplicates it.
 * Edit: PATCH /problems/:id with the already-uploaded photos to keep (the server removes
 * the rest), then any newly picked photos are uploaded the same way as on add.
 *
 * Renders its own ToastHost: the app-root one sits underneath this native Modal, so any
 * toast (errors, permission prompts from the photo/location pickers) would be invisible.
 */
export function ProblemFormModal({ visible, onClose, problem }: ProblemFormModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const isEditMode = !!problem;
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [quotation, setQuotation] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<PlaceValue | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPhotos((problem?.photoUrls ?? []).map((url, index) => ({ uri: url, name: `existing_${index}.jpg`, type: 'image/jpeg' })));
    setSelectedSkills(problem?.skillCategories ?? []);
    setQuotation(problem ? String(problem.quotationAmount) : '');
    setDescription(problem?.description ?? '');
    setLocation(
      problem && problem.latitude != null && problem.longitude != null
        ? { latitude: problem.latitude, longitude: problem.longitude, locationName: problem.locationAddress ?? '' }
        : null,
    );
    setUploadingPhoto(null);
  }, [visible, problem]);

  const quotationAmount = Number(quotation);
  const quotationValid =
    quotation !== '' && Number.isInteger(quotationAmount) && quotationAmount > 0 && quotationAmount <= MAX_QUOTATION;
  const locationValid = location !== null;
  const canSubmit = selectedSkills.length > 0 && quotationValid && locationValid;

  const uploadNewPhotos = async (postId: string, newPhotos: PickedImage[]) => {
    for (let i = 0; i < newPhotos.length; i += 1) {
      setUploadingPhoto({ current: i + 1, total: newPhotos.length });
      await problemsService.addPhoto(postId, newPhotos[i]);
    }
  };

  // Asking for location / showing the ad: a second tap must not post twice.
  const preparing = useRef(false);
  const { adLoading, waitForAd } = useAdGate(visible, 'post_problem');
  const { busy, run } = useBusyAction();

  const handleSubmit = async () => {
    if (!canSubmit || submitting || preparing.current) return;
    // The form's own Location field (current location or a map pin) is where workers come,
    // so nothing more is asked here.
    if (!location) {
      showToast({ variant: 'error', title: t('location.requiredTitle'), message: t('location.requiredMessage') });
      return;
    }
    preparing.current = true;
    try {
      // A new post shows a local business's ad (when one is running) before it goes out; the
      // button shows its spinner while the ad loads. Edits don't.
      if (!isEditMode && !(await waitForAd())) return;
    } finally {
      preparing.current = false;
    }
    setSubmitting(true);

    const fields = {
      skillCategories: selectedSkills,
      description: description.trim() || undefined,
      quotationAmount,
      // Only the place name is shown; workers use the point itself for directions.
      locationAddress: location.locationName,
      latitude: location.latitude,
      longitude: location.longitude,
    };
    const newPhotos = photos.filter((image) => !isRemote(image));
    let createdPostId: string | null = null;

    try {
      if (problem) {
        await problemsService.update(problem.id, {
          ...fields,
          keepPhotoUrls: photos.filter(isRemote).map((image) => image.uri),
        });
        await uploadNewPhotos(problem.id, newPhotos);
        showToast({ variant: 'success', title: t('problemForm.updatedTitle') });
      } else {
        const post = await problemsService.create(fields);
        createdPostId = post.id;
        await uploadNewPhotos(post.id, newPhotos);
        showToast({ variant: 'success', title: t('problemForm.postedTitle'), message: t('problemForm.postedMessage') });
      }
      await queryClient.invalidateQueries({ queryKey: MY_PROBLEMS_QUERY_KEY });
      onClose();
    } catch (error) {
      if (createdPostId) {
        // All-or-nothing for a new post — roll back so a retry doesn't create a duplicate.
        problemsService.delete(createdPostId).catch(() => {});
      } else if (problem) {
        // The edit itself may have saved before a photo failed — refresh so the list is truthful.
        queryClient.invalidateQueries({ queryKey: MY_PROBLEMS_QUERY_KEY });
      }
      showToast({
        variant: 'error',
        title: t(isEditMode ? 'problemForm.updateFailedTitle' : 'problemForm.postFailedTitle'),
        message: getLocalizedErrorMessage(error, t),
      });
    } finally {
      setSubmitting(false);
      setUploadingPhoto(null);
    }
  };

  const skillOptions = SKILL_CATEGORIES.map((skill) => ({
    key: skill.key,
    label: t(`workerProfile.skills.${skill.key}`),
    icon: skill.icon,
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient
          colors={headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 14 }]}
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel={t('common.cancel')} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.titleGroup}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {t(isEditMode ? 'problemForm.editTitle' : 'problemForm.addTitle')}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {t(isEditMode ? 'problemForm.editSubtitle' : 'problemForm.addSubtitle')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.formBody} keyboardShouldPersistTaps="handled">
          <ImagePickerField
            label={t('problemForm.photosLabel')}
            images={photos}
            onChange={setPhotos}
            maxImages={MAX_PHOTOS}
            allowCamera
          />

          <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('problemForm.locationLabel')}</Text>
          <LocationField label={t('problemForm.locationHint')} value={location} onChange={setLocation} />

          <Text style={[styles.sectionLabel, styles.sectionSpacing, { color: colors.text }]}>{t('problemForm.workerLabel')}</Text>
          <CategoryPicker
            title={t('problemForm.workerLabel')}
            placeholder={t('picker.chooseServices')}
            options={skillOptions}
            selected={selectedSkills}
            onChange={setSelectedSkills}
          />

          <Text style={[styles.sectionLabel, styles.sectionSpacing, { color: colors.text }]}>
            {t('problemForm.quotationLabel')}
          </Text>
          <View style={[styles.quotationWrap, { borderColor: colors.border }]}>
            <Text style={[styles.rupee, { color: colors.textMuted }]}>₹</Text>
            <TextInput
              style={[styles.quotationInput, { color: colors.text }]}
              value={quotation}
              onChangeText={(text) => setQuotation(text.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={7}
              placeholder={t('problemForm.quotationPlaceholder')}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t('problemForm.quotationLabel')}
            />
          </View>
          <Text style={[styles.hint, { color: colors.textMuted }]}>{t('problemForm.quotationHint')}</Text>

          <Text style={[styles.sectionLabel, styles.sectionSpacing, { color: colors.text }]}>
            {t('problemForm.descriptionLabel')}
          </Text>
          <TextInput
            style={[styles.descriptionInput, { borderColor: colors.border, color: colors.text }]}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={500}
            textAlignVertical="top"
            placeholder={t('problemForm.descriptionPlaceholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('problemForm.descriptionLabel')}
          />
        </ScrollView>

        <View style={[styles.submitWrap, { borderTopColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
          {uploadingPhoto !== null ? (
            <Text style={[styles.progressText, { color: colors.textMuted }]}>
              {t('problemForm.uploadingPhoto', uploadingPhoto)}
            </Text>
          ) : null}
          <Button
            label={t(isEditMode ? 'common.saveChanges' : 'problemForm.submit')}
            onPress={() => run(handleSubmit)}
            loading={submitting || adLoading || busy}
            disabled={!canSubmit}
          />
        </View>

        <ToastHost />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  titleGroup: { marginLeft: 14, flex: 1 },
  headerTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', lineHeight: 20 },
  headerSubtitle: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)', lineHeight: 14, marginTop: 2 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formBody: { padding: 20, paddingBottom: 32 },
  sectionLabel: { ...typography.body, fontFamily: fonts.semiBold, marginBottom: 12 },
  sectionSpacing: { marginTop: 24 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipInactive: { borderWidth: 1 },
  chipLabel: { ...typography.body, fontFamily: fonts.medium, fontSize: 13 },
  quotationWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 14 },
  rupee: { ...typography.subheading, fontFamily: fonts.semiBold, marginRight: 8 },
  quotationInput: { flex: 1, ...typography.body, paddingVertical: 12 },
  hint: { ...typography.caption, marginTop: 6 },
  descriptionInput: { borderWidth: 1, borderRadius: 8, padding: 14, minHeight: 100, ...typography.body },
  submitWrap: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
  progressText: { ...typography.caption, textAlign: 'center', marginBottom: 8 },
});
