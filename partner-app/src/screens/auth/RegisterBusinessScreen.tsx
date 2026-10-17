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
import { useCreateBusinessProfile } from '@/hooks/useBusinessMutations';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { businessesService } from '@/services/businessesService';
import { useAuthStore } from '@/state/authStore';

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
 * One screen, one form — mirrors `RegisterWorkerScreen`'s own restructuring (see its doc
 * comment for the full rationale, including how `authStore.isCompletingRegistration` keeps
 * this screen mounted through inline OTP verification). Full Name/Mobile Number sit
 * alongside the Business fields; Submit is disabled until the mobile number is verified.
 */
export function RegisterBusinessScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const createProfile = useCreateBusinessProfile();
  const setCompletingRegistration = useAuthStore((state) => state.setCompletingRegistration);

  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [verified, setVerified] = useState(false);

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCompletingRegistration(true);
    return () => setCompletingRegistration(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleSubmit = () => {
    setError(null);
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

    createProfile.mutate(
      {
        shopName,
        shopCategories: includesOther ? [...shopCategories, 'other'] : shopCategories,
        otherCategoryDescription: includesOther ? otherCategoryEntries.join(', ') : undefined,
        place,
        profilePhoto: profilePhoto ?? (photoRemoved ? null : undefined),
        deliveryAvailable,
        deliveryPricePerKm: deliveryAvailable ? Number(deliveryPricePerKm) : undefined,
        shopPhotos: photos,
      },
      {
        onSuccess: () => {
          showToast({
            variant: 'success',
            title: t('businessProfile.successTitle'),
            message: t('businessProfile.successMessage'),
          });
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
            title={t('infoTips.shopTitle')}
            tips={[
              { icon: 'store', text: t('businessProfile.subtitle') },
              { icon: 'camera', text: t('profilePhoto.businessHint') },
              { icon: 'mobile-screen-button', text: t('auth.verifyToSubmitHint') },
              { icon: 'location-dot', text: t('infoTips.location') },
              { icon: 'truck', text: t('businessProfile.deliveryChargeHint') },
              { icon: 'shield-halved', text: t('infoTips.verification') },
            ]}
          />

          <ProfilePhotoField
            uri={profilePhoto?.uri ?? null}
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
              businessesService
                .getMyProfile()
                .then((existing) => {
                  if (!existing) return;
                  showToast({ variant: 'info', title: t('auth.alreadyShop') });
                  setCompletingRegistration(false);
                })
                .catch(() => undefined);
            }}
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
