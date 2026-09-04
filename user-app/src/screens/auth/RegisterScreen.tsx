import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LocationPicker, LocationValue } from '@/components/LocationPicker';
import { colors, typography } from '@/theme';
import { AuthStackParamList } from '@/navigation/types';
import { useRequestRegistrationOtp } from '@/hooks/useAuthMutations';
import { useSettingsStore } from '@/state/settingsStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const language = useSettingsStore((state) => state.language);
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState<LocationValue>({ latitude: null, longitude: null, address: '' });
  const [error, setError] = useState<string | null>(null);
  const requestOtp = useRequestRegistrationOtp();

  const handleSubmit = () => {
    setError(null);

    if (!fullName.trim() || !mobileNumber.trim() || !email.trim() || !location.address.trim()) {
      setError(t('errors.VALIDATION_ERROR'));
      return;
    }

    requestOtp.mutate(
      {
        fullName,
        mobileNumber,
        email,
        latitude: location.latitude,
        longitude: location.longitude,
        locationAddress: location.address,
        preferredLanguage: language,
      },
      {
        onSuccess: () => navigation.navigate('Otp', { mode: 'registration', mobileNumber }),
        onError: (err) => setError(getLocalizedErrorMessage(err, t)),
      },
    );
  };

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.languageRow}>
          <LanguageSwitcher />
        </View>
        <TextField label={t('auth.fullNameLabel')} value={fullName} onChangeText={setFullName} />
        <TextField
          label={t('auth.mobileNumberLabel')}
          value={mobileNumber}
          onChangeText={setMobileNumber}
          keyboardType="number-pad"
          maxLength={10}
        />
        <TextField
          label={t('auth.emailLabel')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <LocationPicker value={location} onChange={setLocation} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label={t('auth.sendOtp')} onPress={handleSubmit} loading={requestOtp.isPending} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  languageRow: { marginBottom: 24 },
  error: { ...typography.caption, color: colors.error, marginBottom: 12 },
});
