import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { colors, typography } from '@/theme';
import { AuthStackParamList } from '@/navigation/types';
import { useRequestRegistrationOtp } from '@/hooks/useAuthMutations';
import { ApiError } from '@/services/apiClient';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { role } = route.params;
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const requestOtp = useRequestRegistrationOtp();

  const handleSubmit = () => {
    setError(null);
    requestOtp.mutate(
      { fullName, mobileNumber, role },
      {
        onSuccess: () => navigation.navigate('Otp', { mode: 'registration', mobileNumber }),
        onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong'),
      },
    );
  };

  return (
    <ScreenContainer>
      <Text style={styles.heading}>{t('auth.register')}</Text>
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
  heading: { ...typography.heading, marginBottom: 24 },
  error: { ...typography.caption, color: colors.error, marginBottom: 12 },
});
