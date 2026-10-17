import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { saveAccountName } from '@/utils/saveAccountName';
import { useAuthStore } from '@/state/authStore';
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
import { useCreateBusinessProfile, useDeleteBusinessProfile, useUpdateBusinessProfile } from '@/hooks/useBusinessMutations';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { MainStackParamList } from '@/navigation/types';
import { CancelButton } from '@/components/CancelButton';

const DELETE_GRADIENT = ['#ef4444', '#dc2626'] as const;

type Props = NativeStackScreenProps<MainStackParamList, 'BusinessRegistration'>;

const SHOP_CATEGORIES = [
  { key: 'grocery', icon: 'basket-shopping' as const },
  { key: 'restaurant', icon: 'utensils' as const },
  { key: 'pharmacy', icon: 'pills' as const },
  { key: 'electronics', icon: 'tv' as const },
  { key: 'clothing', icon: 'shirt' as const },
  { key: 'hardware', icon: 'screwdriver-wrench' as const },
  { key: 'salon', icon: 'scissors' as const },
];

/**
 * Adapted from user-app's BusinessProfileModal — same fields, same multi-select chip +
 * "+ Add New" pattern, same delivery Yes/No chip pair, same shared LocationField/
 * ImagePickerField, submitting to the same `POST /businesses/me/profile`.
 *
 * Also doubles as the edit form (mirrors WorkerRegistrationScreen's own edit-mode addition —
 * see its doc comment for the full rationale): an optional `route.params.profile` switches
 * into edit mode, prefilled via `useEffect`, `PATCH` instead of `POST`, plus a Delete action.
 */
export function BusinessRegistrationScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const profile = route.params?.profile;
  const isEditMode = !!profile;
  const account = useAuthStore((state) => state.account);
  const createProfile = useCreateBusinessProfile();
  const updateProfile = useUpdateBusinessProfile();
  const deleteProfile = useDeleteBusinessProfile();

  const [shopName, setShopName] = useState('');
  const [shopCategories, setShopCategories] = useState<string[]>([]);
  const [otherCategoryEntries, setOtherCategoryEntries] = useState<string[]>([]);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherInputValue, setOtherInputValue] = useState('');
  const [place, setPlace] = useState<PlaceValue | null>(null);
  // A newly picked profile photo (uploaded after saving), or a removal of the saved one.
  const [profilePhoto, setProfilePhoto] = useState<PickedImage | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [deliveryAvailable, setDeliveryAvailable] = useState<boolean | null>(null);
  const [deliveryPricePerKm, setDeliveryPricePerKm] = useState('');
  const [fullName, setFullName] = useState(account?.fullName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (profile) {
      setShopName(profile.shopName);
      setShopCategories(profile.shopCategories.filter((key) => key !== 'other'));
      setOtherCategoryEntries(
        profile.otherCategoryDescription ? profile.otherCategoryDescription.split(', ').filter(Boolean) : [],
      );
      setPlace(placeFromProfile(profile));
      setProfilePhoto(null);
      setPhotoRemoved(false);
      setPhotos(
        profile.shopPhotoUrls.map((url) => ({ uri: url, name: url.split('/').pop() ?? 'photo.jpg', type: 'image/jpeg' })),
      );
      setDeliveryAvailable(profile.deliveryAvailable);
      setDeliveryPricePerKm(profile.deliveryPricePerKm != null ? String(profile.deliveryPricePerKm) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const toggleCategory = (key: string) => {
    setShopCategories((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const orderedCategories = [...SHOP_CATEGORIES].sort(
    (a, b) => Number(shopCategories.includes(b.key)) - Number(shopCategories.includes(a.key)),
  );

  const commitOtherEntry = () => {
    const trimmed = otherInputValue.trim();
    if (trimmed) {
      const matchedCategory = SHOP_CATEGORIES.find(
        (category) => t(`businessProfile.categories.${category.key}`).toLowerCase() === trimmed.toLowerCase(),
      );
      if (matchedCategory) {
        setShopCategories((prev) => (prev.includes(matchedCategory.key) ? prev : [...prev, matchedCategory.key]));
      } else {
        setOtherCategoryEntries((prev) => {
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
    setOtherCategoryEntries((prev) => prev.filter((_, i) => i !== index));
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
    const includesOther = otherCategoryEntries.length > 0;
    const problem = !shopName.trim()
      ? t('formErrors.shopName')
      : shopCategories.length === 0 && !includesOther
        ? t('formErrors.shopCategory')
        : !place
          ? t('formErrors.location')
          : deliveryAvailable === null
            ? t('formErrors.delivery')
            : deliveryAvailable && !(Number(deliveryPricePerKm) > 0)
              ? t('formErrors.deliveryPrice')
              : null;
    if (problem) {
      setError(problem);
      showToast({ variant: 'error', title: t('formErrors.title'), message: problem });
      return;
    }
    // Already reported above; this only tells TypeScript.
    if (!place || deliveryAvailable === null) return;
    try {
      await saveAccountName(fullName);
    } catch (err) {
      handleMutationError(err);
      return;
    }

    const commonPayload = {
      shopName,
      shopCategories: includesOther ? [...shopCategories, 'other'] : shopCategories,
      otherCategoryDescription: includesOther ? otherCategoryEntries.join(', ') : undefined,
      place,
      profilePhoto: profilePhoto ?? (photoRemoved ? null : undefined),
      deliveryAvailable,
      deliveryPricePerKm: deliveryAvailable ? Number(deliveryPricePerKm) : undefined,
    };

    if (isEditMode) {
      const existingPhotoUrls = photos.filter((image) => image.uri.startsWith('http')).map((image) => image.uri);
      const newPhotos = photos.filter((image) => !image.uri.startsWith('http'));
      updateProfile.mutate(
        { ...commonPayload, existingPhotoUrls, shopPhotos: newPhotos },
        {
          onSuccess: () => {
            showToast({
              variant: 'success',
              title: t('businessProfile.updateSuccessTitle'),
              message: t('businessProfile.updateSuccessMessage'),
            });
            navigation.replace('MyInfo', { capability: 'business' });
          },
          onError: handleMutationError,
        },
      );
    } else {
      createProfile.mutate(
        { ...commonPayload, shopPhotos: photos },
        {
          onSuccess: () => {
            showToast({
              variant: 'success',
              title: t('businessProfile.successTitle'),
              message: t('businessProfile.successMessage'),
            });
            navigation.replace('MyInfo', { capability: 'business' });
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
          title: t('businessProfile.deleteSuccessTitle'),
          message: t('businessProfile.deleteSuccessMessage'),
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
            title={t('infoTips.shopTitle')}
            tips={[
              { icon: 'store', text: t(isEditMode ? 'businessProfile.editSubtitle' : 'businessProfile.subtitle') },
              { icon: 'camera', text: t('profilePhoto.businessHint') },
              { icon: 'location-dot', text: t('infoTips.location') },
              { icon: 'truck', text: t('businessProfile.deliveryChargeHint') },
              { icon: 'shield-halved', text: t('infoTips.verification') },
            ]}
          />

          <ProfilePhotoField
            uri={profilePhoto?.uri ?? (photoRemoved ? null : (profile?.profilePhotoUrl ?? null))}
            name={fullName}
            title={t('profilePhoto.businessTitle')}
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

          <TextField label={t('businessProfile.shopNameLabel')} value={shopName} onChangeText={setShopName} />

          <Text style={[styles.label, { color: colors.textMuted }]}>{t('businessProfile.categoryLabel')}</Text>
          <View style={styles.chipRow}>
            {orderedCategories.map((category) => {
              const isActive = shopCategories.includes(category.key);
              return (
                <Pressable key={category.key} onPress={() => toggleCategory(category.key)}>
                  {isActive ? (
                    <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
                      <FontAwesome6 name={category.icon} size={12} color="#FFFFFF" solid />
                      <Text style={[styles.chipLabel, { color: '#FFFFFF' }]}>
                        {t(`businessProfile.categories.${category.key}`)}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.chip, styles.chipInactive, { borderColor: colors.border }]}>
                      <FontAwesome6 name={category.icon} size={12} color={colors.textMuted} solid />
                      <Text style={[styles.chipLabel, { color: colors.text }]}>
                        {t(`businessProfile.categories.${category.key}`)}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
            {otherCategoryEntries.map((entry, index) => (
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
              <View
                style={[
                  styles.chip,
                  styles.addNewChip,
                  { borderColor: headerGradient[0], backgroundColor: `${headerGradient[0]}16` },
                ]}
              >
                <View style={[styles.addNewBadge, { backgroundColor: headerGradient[0] }]}>
                  <FontAwesome6 name="plus" size={9} color="#FFFFFF" solid />
                </View>
                <Text style={[styles.chipLabel, { color: headerGradient[0], fontFamily: fonts.semiBold }]}>
                  {t('common.addNew')}
                </Text>
              </View>
            </Pressable>
          </View>

          {showOtherInput ? (
            <>
              <Text style={[styles.label, { color: colors.textMuted }]}>{t('businessProfile.otherCategoryLabel')}</Text>
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
                  <LinearGradient
                    colors={headerGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.otherDoneGradient}
                  >
                    <FontAwesome6 name="check" size={16} color="#FFFFFF" solid />
                  </LinearGradient>
                </Pressable>
              </View>
            </>
          ) : null}

          <LocationField label={t('location.shopPlaceLabel')} value={place} onChange={setPlace} />

          <ImagePickerField label={t('businessProfile.photosLabel')} images={photos} onChange={setPhotos} />

          <Text style={[styles.label, { color: colors.textMuted }]}>{t('businessProfile.deliveryLabel')}</Text>
          <View style={styles.deliveryRow}>
            <Pressable onPress={() => setDeliveryAvailable(true)}>
              {deliveryAvailable === true ? (
                <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
                  <Text style={[styles.chipLabel, { color: '#FFFFFF' }]}>{t('businessProfile.deliveryYes')}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.chip, styles.chipInactive, { borderColor: colors.border }]}>
                  <Text style={[styles.chipLabel, { color: colors.text }]}>{t('businessProfile.deliveryYes')}</Text>
                </View>
              )}
            </Pressable>
            <Pressable onPress={() => setDeliveryAvailable(false)}>
              {deliveryAvailable === false ? (
                <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
                  <Text style={[styles.chipLabel, { color: '#FFFFFF' }]}>{t('businessProfile.deliveryNo')}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.chip, styles.chipInactive, { borderColor: colors.border }]}>
                  <Text style={[styles.chipLabel, { color: colors.text }]}>{t('businessProfile.deliveryNo')}</Text>
                </View>
              )}
            </Pressable>
            {/* The price sits right beside Yes / No, not on a line of its own. */}
            {deliveryAvailable ? (
              <View style={styles.deliveryInput}>
                <TextField
                  containerStyle={styles.deliveryInputField}
                  value={deliveryPricePerKm}
                  onChangeText={(text) => setDeliveryPricePerKm(text.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  placeholder={t('businessProfile.deliveryPerKmPlaceholder')}
                  accessibilityLabel={t('businessProfile.deliveryPriceLabel')}
                />
              </View>
            ) : null}
          </View>

          {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

          <Button
            label={t(isEditMode ? 'common.saveChanges' : 'common.submit')}
            onPress={handleSubmit}
            loading={isEditMode ? updateProfile.isPending : createProfile.isPending}
          />

          {isEditMode ? (
            <CancelButton icon="trash" label={t('businessProfile.deleteAction')} onPress={() => setShowDeleteConfirm(true)} />
          ) : null}
        </ScrollView>
      </KeyboardAwareView>

      <ConfirmModal
        visible={showDeleteConfirm}
        icon="trash"
        gradient={DELETE_GRADIENT}
        title={t('businessProfile.deleteConfirmTitle')}
        message={t('businessProfile.deleteConfirmMessage')}
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
  label: { ...typography.caption, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  // A fixed width at the right of the row, so it doesn't stretch across all the space beside Yes / No.
  deliveryInput: { width: 140, marginLeft: 'auto' },
  deliveryInputField: { marginBottom: 0 },
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
