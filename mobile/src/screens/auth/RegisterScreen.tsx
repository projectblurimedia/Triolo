import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { colors, typography } from '@/theme';
import { AuthStackParamList } from '@/navigation/types';
import { useRequestRegistrationOtp } from '@/hooks/useAuthMutations';
import { useSettingsStore } from '@/state/settingsStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { role } = route.params;
  const language = useSettingsStore((state) => state.language);
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const requestOtp = useRequestRegistrationOtp();

  const handleSubmit = () => {
    setError(null);
    requestOtp.mutate(
      { fullName, mobileNumber, role, preferredLanguage: language },
      {
        onSuccess: () => navigation.navigate('Otp', { mode: 'registration', mobileNumber }),
        onError: (err) => setError(getLocalizedErrorMessage(err, t)),
      },
    );
  };

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
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
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={t('auth.sendOtp')} onPress={handleSubmit} loading={requestOtp.isPending} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  languageRow: { marginBottom: 24 },
  error: { ...typography.caption, color: colors.error, marginBottom: 12 },
});
