import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { colors, typography } from '@/theme';
import { AuthStackParamList } from '@/navigation/types';
import { useRequestLoginOtp } from '@/hooks/useAuthMutations';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const requestOtp = useRequestLoginOtp();

  const handleSubmit = () => {
    setError(null);
    requestOtp.mutate(
      { mobileNumber },
      {
        onSuccess: () => navigation.navigate('Otp', { mode: 'login', mobileNumber }),
        onError: (err) => setError(getLocalizedErrorMessage(err, t)),
      },
    );
  };

  return (
    <ScreenContainer>
      <Text style={styles.heading}>{t('auth.login')}</Text>
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
