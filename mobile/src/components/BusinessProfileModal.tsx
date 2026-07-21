import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

const SHOP_GRADIENT = ['#F59E0B', '#D97706'] as const;

const SHOP_CATEGORIES = [
  { key: 'grocery', icon: 'basket-shopping' as const },
  { key: 'restaurant', icon: 'utensils' as const },
  { key: 'pharmacy', icon: 'pills' as const },
  { key: 'electronics', icon: 'tv' as const },
  { key: 'clothing', icon: 'shirt' as const },
  { key: 'hardware', icon: 'screwdriver-wrench' as const },
  { key: 'salon', icon: 'scissors' as const },
  { key: 'other', icon: 'ellipsis' as const },
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
  const [otherCategoryDescription, setOtherCategoryDescription] = useState('');
  const [location, setLocation] = useState<LocationValue>({ latitude: null, longitude: null, address: '' });
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [deliveryAvailable, setDeliveryAvailable] = useState<boolean | null>(null);
  const [deliveryPricePerKm, setDeliveryPricePerKm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (key: string) => {
    setShopCategories((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const resetAndClose = () => {
    setShopName('');
    setShopCategories([]);
    setOtherCategoryDescription('');
    setLocation({ latitude: null, longitude: null, address: '' });
    setPhotos([]);
    setDeliveryAvailable(null);
    setDeliveryPricePerKm('');
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    setError(null);
    const includesOther = shopCategories.includes('other');
    if (
      !shopName.trim() ||
      shopCategories.length === 0 ||
      (includesOther && !otherCategoryDescription.trim()) ||
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
        shopCategories,
        otherCategoryDescription: includesOther ? otherCategoryDescription.trim() : undefined,
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
          Alert.alert(t('businessProfile.successTitle'), t('businessProfile.successMessage'));
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
            {SHOP_CATEGORIES.map((category) => {
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
          </View>

          {shopCategories.includes('other') ? (
            <TextField
              label={t('businessProfile.otherCategoryLabel')}
              value={otherCategoryDescription}
              onChangeText={setOtherCategoryDescription}
              maxLength={100}
            />
          ) : null}

          <LocationPicker value={location} onChange={setLocation} />

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
  chipLabel: { ...typography.caption, fontFamily: fonts.medium },
  error: { ...typography.caption, marginBottom: 12 },
});
