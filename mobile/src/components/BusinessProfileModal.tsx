import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextField } from './TextField';
import { LocationPicker, LocationValue } from './LocationPicker';
import { ImagePickerField, PickedImage } from './ImagePickerField';
import { Button } from './Button';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useCreateBusinessProfile } from '@/hooks/useBusinessMutations';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';

const SHOP_GRADIENT = ['#F59E0B', '#D97706'] as const;

const SHOP_CATEGORIES = [
  { key: 'grocery', icon: 'basket-shopping' as const },
  { key: 'restaurant', icon: 'utensils' as const },
  { key: 'pharmacy', icon: 'pills' as const },
  { key: 'electronics', icon: 'tv' as const },
  { key: 'clothing', icon: 'shirt' as const },
  { key: 'hardware', icon: 'screwdriver-wrench' as const },
  { key: 'salon', icon: 'scissors' as const },
];

interface BusinessProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Opened from Home's menu ("Become a Business") — adds the Business capability to the current User account. */
export function BusinessProfileModal({ visible, onClose }: BusinessProfileModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const createProfile = useCreateBusinessProfile();

  const [shopName, setShopName] = useState('');
  const [shopCategories, setShopCategories] = useState<string[]>([]);
  const [otherCategoryEntries, setOtherCategoryEntries] = useState<string[]>([]);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherInputValue, setOtherInputValue] = useState('');
  const [location, setLocation] = useState<LocationValue>({ latitude: null, longitude: null, address: '' });
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [deliveryAvailable, setDeliveryAvailable] = useState<boolean | null>(null);
  const [deliveryPricePerKm, setDeliveryPricePerKm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (key: string) => {
    setShopCategories((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const orderedCategories = [...SHOP_CATEGORIES].sort(
    (a, b) => Number(shopCategories.includes(b.key)) - Number(shopCategories.includes(a.key)),
  );

  const commitOtherEntry = () => {
    const trimmed = otherInputValue.trim();
    if (trimmed) {
      setOtherCategoryEntries((prev) => {
        const existingIndex = prev.findIndex((entry) => entry.toLowerCase() === trimmed.toLowerCase());
        if (existingIndex !== -1) {
          // Already added — surface it (bring to front) instead of creating a duplicate chip.
          const existing = prev[existingIndex];
          return [existing, ...prev.filter((_, i) => i !== existingIndex)];
        }
        return [...prev, trimmed];
      });
    }
    setOtherInputValue('');
    setShowOtherInput(false);
  };

  const removeOtherEntry = (index: number) => {
    setOtherCategoryEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const resetAndClose = () => {
    setShopName('');
    setShopCategories([]);
    setOtherCategoryEntries([]);
    setShowOtherInput(false);
    setOtherInputValue('');
    setLocation({ latitude: null, longitude: null, address: '' });
    setPhotos([]);
    setDeliveryAvailable(null);
    setDeliveryPricePerKm('');
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    setError(null);
    const includesOther = otherCategoryEntries.length > 0;
    if (
      !shopName.trim() ||
      (shopCategories.length === 0 && !includesOther) ||
      !location.address.trim() ||
      deliveryAvailable === null ||
      (deliveryAvailable && !deliveryPricePerKm.trim())
    ) {
      setError(t('errors.VALIDATION_ERROR'));
      return;
    }

    createProfile.mutate(
      {
        shopName,
        shopCategories: includesOther ? [...shopCategories, 'other'] : shopCategories,
        otherCategoryDescription: includesOther ? otherCategoryEntries.join(', ') : undefined,
        latitude: location.latitude,
        longitude: location.longitude,
        locationAddress: location.address,
        shopPhotos: photos,
        deliveryAvailable,
        deliveryPricePerKm: deliveryAvailable ? Number(deliveryPricePerKm) : undefined,
      },
      {
        onSuccess: () => {
          resetAndClose();
          showToast({ variant: 'success', title: t('businessProfile.successTitle'), message: t('businessProfile.successMessage') });
        },
        onError: (err) => setError(getLocalizedErrorMessage(err, t)),
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={SHOP_GRADIENT}
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
                {t('businessProfile.title')}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {t('businessProfile.subtitle')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <TextField label={t('businessProfile.shopNameLabel')} value={shopName} onChangeText={setShopName} />

          <Text style={[styles.label, { color: colors.textMuted }]}>{t('businessProfile.categoryLabel')}</Text>
          <View style={styles.chipRow}>
            {orderedCategories.map((category) => {
              const isActive = shopCategories.includes(category.key);
              return (
                <Pressable key={category.key} onPress={() => toggleCategory(category.key)}>
                  {isActive ? (
                    <LinearGradient colors={SHOP_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
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
                <LinearGradient colors={SHOP_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
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
                  { borderColor: SHOP_GRADIENT[0], backgroundColor: `${SHOP_GRADIENT[0]}16` },
                ]}
              >
                <View style={[styles.addNewBadge, { backgroundColor: SHOP_GRADIENT[0] }]}>
                  <FontAwesome6 name="plus" size={9} color="#FFFFFF" solid />
                </View>
                <Text style={[styles.chipLabel, { color: SHOP_GRADIENT[0], fontFamily: fonts.semiBold }]}>
                  {t('common.addNew')}
                </Text>
              </View>
            </Pressable>
          </View>

          {showOtherInput ? (
            <View style={styles.otherInputRow}>
              <View style={styles.otherInputField}>
                <TextField
                  label={t('businessProfile.otherCategoryLabel')}
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
                <LinearGradient colors={SHOP_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.otherDoneGradient}>
                  <FontAwesome6 name="check" size={16} color="#FFFFFF" solid />
                </LinearGradient>
              </Pressable>
            </View>
          ) : null}

          <LocationPicker value={location} onChange={setLocation} accentColor={SHOP_GRADIENT[0]} />

          <ImagePickerField label={t('businessProfile.photosLabel')} images={photos} onChange={setPhotos} />

          <Text style={[styles.label, { color: colors.textMuted }]}>{t('businessProfile.deliveryLabel')}</Text>
          <View style={styles.chipRow}>
            <Pressable onPress={() => setDeliveryAvailable(true)}>
              {deliveryAvailable === true ? (
                <LinearGradient colors={SHOP_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
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
                <LinearGradient colors={SHOP_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
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

          <Button label={t('common.submit')} onPress={handleSubmit} loading={createProfile.isPending} gradient={SHOP_GRADIENT} />
        </ScrollView>
      </View>
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
  body: { padding: 20, paddingBottom: 40 },
  label: { ...typography.caption, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipInactive: { borderWidth: 1 },
  addNewChip: { borderWidth: 1.5 },
  addNewBadge: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { ...typography.caption, fontFamily: fonts.medium },
  otherInputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  otherInputField: { flex: 1 },
  otherDoneButton: { marginTop: 22 },
  otherDoneGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { ...typography.caption, marginBottom: 12 },
});
