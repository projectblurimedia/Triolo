import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { KeyboardAwareView } from '@/components/KeyboardAwareView';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { GradientHeader } from '@/components/GradientHeader';
import { LanguagePickerModal } from '@/components/LanguagePickerModal';
import { LocationField } from '@/components/LocationField';
import { ProfilePhotoField } from '@/components/ProfilePhotoField';
import { PhoneVerification } from '@/components/PhoneVerification';
import { InfoTipsButton } from '@/components/InfoTipsButton';
import { PickedImage } from '@/components/ImagePickerField';
import { PlaceValue } from '@/utils/place';
import { fonts, typography, useThemeColors } from '@/theme';
import { AuthStackParamList } from '@/navigation/types';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/state/authStore';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

/**
 * Create a customer account in one form, the same way the Partner app's registrations work:
 * a centred photo, Full Name + Mobile Number verified inline with an OTP (`PhoneVerification`),
 * then email and location. Submit stays off until the number is verified.
 *
 * Verifying signs the person in (`setSession`), which would normally swap RootNavigator to the
 * app mid-form — `isCompletingRegistration` (set on mount, cleared on submit or on leaving)
 * keeps this screen up until they finish. Submit saves email/location (`PATCH /auth/me`), then
 * the photo, then lets the app open. A number that already has an account just logs in; its
 * details are updated the same way.
 */
export function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const setCompletingRegistration = useAuthStore((state) => state.setCompletingRegistration);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [verified, setVerified] = useState(false);
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState<PlaceValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);

  useEffect(() => {
    setCompletingRegistration(true);
    return () => setCompletingRegistration(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    setError(null);
    if (!verified) return;
    const problem = !email.trim()
      ? t('formErrors.email')
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ? t('formErrors.emailInvalid')
        : !location
          ? t('formErrors.location')
          : null;
    if (problem) {
      setError(problem);
      showToast({ variant: 'error', title: t('formErrors.title'), message: problem });
      return;
    }
    // Already reported above; this only tells TypeScript.
    if (!location) return;
    setSaving(true);
    try {
      let account = await authService.updateProfile({
        fullName: fullName.trim(),
        email: email.trim(),
        latitude: location.latitude,
        longitude: location.longitude,
        locationAddress: location.locationName,
      });
      if (photo) {
        try {
          account = await authService.uploadPhoto(photo);
        } catch {
          showToast({ variant: 'error', title: t('editProfile.photoFailed') });
        }
      }
      setAccount(account);
      showToast({ variant: 'success', title: t('auth.accountCreatedTitle'), message: t('auth.accountCreatedMessage') });
      // Lets RootNavigator open the app now.
      setCompletingRegistration(false);
    } catch (err) {
      setError(getLocalizedErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <GradientHeader
        title={t('auth.register')}
        subtitle={t('auth.registerHeaderSubtitle')}
        showBack
        actions={[{ icon: 'language', accessibilityLabel: t('settings.language'), onPress: () => setLanguageOpen(true) }]}
      />
      <ScreenContainer edges={['left', 'right', 'bottom']}>
        <KeyboardAwareView>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
          >
            <InfoTipsButton
              title={t('infoTips.registerTitle')}
              tips={[
                { icon: 'house', text: t('auth.registerSubtitle') },
                { icon: 'camera', text: t('profilePhoto.customerHint') },
                { icon: 'mobile-screen-button', text: t('auth.verifyToSubmitHint') },
                { icon: 'location-dot', text: t('auth.registerPlaceHint') },
                { icon: 'envelope', text: t('infoTips.email') },
              ]}
            />

            <ProfilePhotoField
              uri={photo?.uri ?? null}
              name={fullName}
              title={t('profilePhoto.customerTitle')}
              onPick={setPhoto}
              onRemove={() => setPhoto(null)}
            />

            <PhoneVerification
              fullName={fullName}
              onFullNameChange={setFullName}
              mobileNumber={mobileNumber}
              onMobileNumberChange={(text) => setMobileNumber(text.replace(/[^0-9]/g, '').slice(0, 10))}
              verified={verified}
              onVerified={() => setVerified(true)}
              newAccountsOnly
              onLoginInstead={() => navigation.navigate('Login')}
            />

            <TextField
              label={t('auth.emailLabel')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder={t('auth.emailPlaceholder')}
              importantForAutofill="no"
            />
            <LocationField label={t('editProfile.locationLabel')} value={location} onChange={setLocation} />

            {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
            <Button label={t('auth.createAccount')} onPress={handleSubmit} loading={saving} disabled={!verified} />

            <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8} style={styles.loginRow}>
              <Text style={[styles.loginText, { color: colors.textMuted }]}>
                {t('auth.alreadyHaveAccount')}{' '}
                <Text style={[styles.loginLink, { color: colors.primary }]}>{t('auth.login')}</Text>
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAwareView>
      </ScreenContainer>
      <LanguagePickerModal visible={languageOpen} onClose={() => setLanguageOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingBottom: 40 },
  error: { ...typography.caption, marginBottom: 12 },
  loginRow: { alignItems: 'center', marginTop: 18 },
  loginText: { ...typography.body },
  loginLink: { fontFamily: fonts.semiBold },
});
