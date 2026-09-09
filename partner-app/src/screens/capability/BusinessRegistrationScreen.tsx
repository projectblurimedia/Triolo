import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { AddressPicker, AddressValue, EMPTY_ADDRESS } from '@/components/AddressPicker';
import { ImagePickerField, PickedImage } from '@/components/ImagePickerField';
import { Button } from '@/components/Button';
import { ConfirmModal } from '@/components/ConfirmModal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useCreateBusinessProfile, useDeleteBusinessProfile, useUpdateBusinessProfile } from '@/hooks/useBusinessMutations';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { MainStackParamList } from '@/navigation/types';

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
 * "+ Add New" pattern, same delivery Yes/No chip pair, same shared AddressPicker/
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
  const createProfile = useCreateBusinessProfile();
  const updateProfile = useUpdateBusinessProfile();
  const deleteProfile = useDeleteBusinessProfile();

  const [shopName, setShopName] = useState('');
  const [shopCategories, setShopCategories] = useState<string[]>([]);
  const [otherCategoryEntries, setOtherCategoryEntries] = useState<string[]>([]);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherInputValue, setOtherInputValue] = useState('');
  const [address, setAddress] = useState<AddressValue>(EMPTY_ADDRESS);
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [deliveryAvailable, setDeliveryAvailable] = useState<boolean | null>(null);
  const [deliveryPricePerKm, setDeliveryPricePerKm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (profile) {
      setShopName(profile.shopName);
      setShopCategories(profile.shopCategories.filter((key) => key !== 'other'));
      setOtherCategoryEntries(profile.otherCategoryDescription ? profile.otherCategoryDescription.split(', ').filter(Boolean) : []);
      setAddress({
        latitude: profile.latitude,
        longitude: profile.longitude,
        area: profile.area ?? '',
        city: profile.city,
        district: profile.district,
        state: profile.state,
        pincode: profile.pincode,
      });
      setPhotos(profile.shopPhotoUrls.map((url) => ({ uri: url, name: url.split('/').pop() ?? 'photo.jpg', type: 'image/jpeg' })));
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

  const handleSubmit = () => {
    setError(null);
    const includesOther = otherCategoryEntries.length > 0;
    if (
      !shopName.trim() ||
      (shopCategories.length === 0 && !includesOther) ||
      !address.city.trim() ||
      !address.district.trim() ||
      !address.state.trim() ||
      !/^[0-9]{6}$/.test(address.pincode) ||
      deliveryAvailable === null ||
      (deliveryAvailable && !deliveryPricePerKm.trim())
    ) {
      setError(t('errors.VALIDATION_ERROR'));
      return;
    }

    const commonPayload = {
      shopName,
      shopCategories: includesOther ? [...shopCategories, 'other'] : shopCategories,
      otherCategoryDescription: includesOther ? otherCategoryEntries.join(', ') : undefined,
      latitude: address.latitude,
      longitude: address.longitude,
      area: address.area.trim() || undefined,
      city: address.city.trim(),
      district: address.district.trim(),
      state: address.state.trim(),
      pincode: address.pincode,
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
            showToast({ variant: 'success', title: t('businessProfile.successTitle'), message: t('businessProfile.successMessage') });
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
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {t(isEditMode ? 'businessProfile.editSubtitle' : 'businessProfile.subtitle')}
        </Text>

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
                    <Text style={[styles.chipLabel, { color: '#FFFFFF' }]}>{t(`businessProfile.categories.${category.key}`)}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[styles.chip, styles.chipInactive, { borderColor: colors.border }]}>
                    <FontAwesome6 name={category.icon} size={12} color={colors.textMuted} solid />
                    <Text style={[styles.chipLabel, { color: colors.text }]}>{t(`businessProfile.categories.${category.key}`)}</Text>
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
            <View style={[styles.chip, styles.addNewChip, { borderColor: headerGradient[0], backgroundColor: `${headerGradient[0]}16` }]}>
              <View style={[styles.addNewBadge, { backgroundColor: headerGradient[0] }]}>
                <FontAwesome6 name="plus" size={9} color="#FFFFFF" solid />
              </View>
              <Text style={[styles.chipLabel, { color: headerGradient[0], fontFamily: fonts.semiBold }]}>{t('common.addNew')}</Text>
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
                <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.otherDoneGradient}>
                  <FontAwesome6 name="check" size={16} color="#FFFFFF" solid />
                </LinearGradient>
              </Pressable>
            </View>
          </>
        ) : null}

        <AddressPicker value={address} onChange={setAddress} />

        <ImagePickerField label={t('businessProfile.photosLabel')} images={photos} onChange={setPhotos} />

        <Text style={[styles.label, { color: colors.textMuted }]}>{t('businessProfile.deliveryLabel')}</Text>
        <View style={styles.chipRow}>
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
        </View>

        {deliveryAvailable ? (
          <TextField
            label={t('businessProfile.deliveryPriceLabel')}
            value={deliveryPricePerKm}
            onChangeText={setDeliveryPricePerKm}
            keyboardType="decimal-pad"
          />
        ) : null}

        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

        <Button
          label={t(isEditMode ? 'common.saveChanges' : 'common.submit')}
          onPress={handleSubmit}
          loading={isEditMode ? updateProfile.isPending : createProfile.isPending}
        />

        {isEditMode ? (
          <Pressable style={styles.deleteButton} onPress={() => setShowDeleteConfirm(true)}>
            <FontAwesome6 name="trash" size={14} color={colors.error} solid />
            <Text style={[styles.deleteText, { color: colors.error }]}>{t('businessProfile.deleteAction')}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

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
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, paddingVertical: 10 },
  deleteText: { ...typography.body, fontFamily: fonts.semiBold },
});
