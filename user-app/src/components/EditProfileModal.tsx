import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { KeyboardAwareView } from './KeyboardAwareView';
import { TextField } from './TextField';
import { Button } from './Button';
import { LocationField } from './LocationField';
import { ProfilePhotoField } from './ProfilePhotoField';
import { PickedImage } from './ImagePickerField';
import { ToastHost } from './ToastHost';
import { InfoTipsButton } from './InfoTipsButton';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { AuthAccount, useAuthStore } from '@/state/authStore';
import { authService } from '@/services/authService';
import { PlaceValue, placeFromCoords } from '@/utils/place';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

// A Plus Code such as "7JCM+2X" — older accounts saved the full geocoder line, code and all.
const PLUS_CODE = /[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}/i;

function placeOf(account: AuthAccount | null): PlaceValue | null {
  if (!account || account.latitude == null || account.longitude == null) return null;
  return { latitude: account.latitude, longitude: account.longitude, locationName: account.locationAddress ?? '' };
}

/** Whether a saved place name needs replacing with the village name for its point. */
function needsVillageName(name: string): boolean {
  return !name.trim() || PLUS_CODE.test(name);
}

/**
 * The customer's own profile (Profile tab menu → Edit Profile): photo, name, email and location.
 * The mobile number is the login and can't be changed here. Saves the details first, then the
 * photo change, and updates the signed-in account everywhere.
 */
export function EditProfileModal({ visible, onClose }: EditProfileModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const account = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [place, setPlace] = useState<PlaceValue | null>(null);
  const [newPhoto, setNewPhoto] = useState<PickedImage | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fill = (source: AuthAccount | null) => {
    setFullName(source?.fullName ?? '');
    setEmail(source?.email ?? '');
    const saved = placeOf(source);
    setPlace(saved);
    // Show the village name, never a code: look it up again for the saved point when needed.
    if (saved && needsVillageName(saved.locationName)) {
      placeFromCoords(saved.latitude, saved.longitude).then((found) =>
        setPlace((current) =>
          current && current.latitude === saved.latitude && current.longitude === saved.longitude ? found : current,
        ),
      );
    }
  };

  // Fill from the saved account, then refresh it (older sessions don't carry photo / location).
  useEffect(() => {
    if (!visible) return;
    fill(useAuthStore.getState().account);
    setNewPhoto(null);
    setPhotoRemoved(false);
    setError(null);
    let cancelled = false;
    authService
      .me()
      .then((fresh) => {
        if (cancelled) return;
        setAccount(fresh);
        fill(fresh);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const shownPhoto = newPhoto?.uri ?? (photoRemoved ? null : (account?.profilePhotoUrl ?? null));

  const save = async () => {
    setError(null);
    if (fullName.trim().length < 2) {
      setError(t('editProfile.nameRequired'));
      return;
    }
    setSaving(true);
    try {
      let updated = await authService.updateProfile({
        fullName: fullName.trim(),
        email: email.trim() || null,
        latitude: place?.latitude ?? null,
        longitude: place?.longitude ?? null,
        locationAddress: place?.locationName || null,
      });
      try {
        if (newPhoto) updated = await authService.uploadPhoto(newPhoto);
        else if (photoRemoved && account?.profilePhotoUrl) updated = await authService.removePhoto();
      } catch {
        showToast({ variant: 'error', title: t('editProfile.photoFailed') });
      }
      setAccount(updated);
      showToast({ variant: 'success', title: t('editProfile.savedTitle') });
      onClose();
    } catch (err) {
      setError(getLocalizedErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 14 }]}
        >
          <Pressable style={styles.backButton} onPress={onClose} hitSlop={8} accessibilityLabel={t('common.close')}>
            <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {t('editProfile.title')}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {t('editProfile.subtitle')}
            </Text>
          </View>
        </LinearGradient>

        <KeyboardAwareView>
          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <InfoTipsButton
              title={t('infoTips.editProfileTitle')}
              tips={[
                { icon: 'camera', text: t('profilePhoto.customerHint') },
                { icon: 'lock', text: t('editProfile.mobileLocked') },
                { icon: 'location-dot', text: t('auth.registerPlaceHint') },
                { icon: 'envelope', text: t('infoTips.email') },
              ]}
            />

            <ProfilePhotoField
              uri={shownPhoto}
              name={fullName}
              title={t('profilePhoto.customerTitle')}
              onPick={(image) => {
                setNewPhoto(image);
                setPhotoRemoved(false);
              }}
              onRemove={() => {
                setNewPhoto(null);
                setPhotoRemoved(true);
              }}
            />

            <TextField
              label={t('auth.fullNameLabel')}
              value={fullName}
              onChangeText={setFullName}
              maxLength={100}
              placeholder={t('auth.fullNamePlaceholder')}
              importantForAutofill="no"
            />

            <Text style={[styles.label, { color: colors.textMuted }]}>{t('auth.mobileNumberLabel')}</Text>
            <View style={[styles.locked, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.lockedText, { color: colors.text }]}>+91 {account?.mobileNumber ?? ''}</Text>
              <FontAwesome6 name="lock" size={12} color={colors.textMuted} solid />
            </View>

            <TextField
              label={t('editProfile.emailLabel')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={255}
              placeholder={t('auth.emailPlaceholder')}
              importantForAutofill="no"
            />
            <LocationField label={t('editProfile.locationLabel')} value={place} onChange={setPlace} />

            {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
            <Button label={t('common.saveChanges')} onPress={save} loading={saving} />
          </ScrollView>
        </KeyboardAwareView>
        <ToastHost />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 16 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 18 },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  body: { padding: 20 },
  label: { ...typography.caption, marginBottom: 6 },
  locked: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  lockedText: { ...typography.body, includeFontPadding: false },
  error: { ...typography.caption, marginBottom: 12, textAlign: 'center' },
});
