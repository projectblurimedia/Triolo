import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { colors, typography } from '@/theme';
import { AuthStackParamList } from '@/navigation/types';
import { useVerifyLoginOtp } from '@/hooks/useAuthMutations';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

/**
 * Login-only now — registration's own OTP verification moved inline into
 * `PhoneVerification`/`RegisterWorkerScreen`/`RegisterBusinessScreen` (see those screens'
 * doc comments), so `LoginScreen` is the only remaining caller of this screen.
 */
export function OtpScreen({ route }: Props) {
  const { t } = useTranslation();
  const { mobileNumber } = route.params;
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);

  const verifyLogin = useVerifyLoginOtp();

  const handleSubmit = () => {
    setError(null);
    verifyLogin.mutate(
      { mobileNumber, otp },
      {
        // RootNavigator automatically switches to MainNavigator once accessToken is set.
        onError: (err) => setError(getLocalizedErrorMessage(err, t)),
      },
    );
  };

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <TextField
        label={t('auth.otpLabel')}
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        maxLength={6}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={t('auth.verifyOtp')} onPress={handleSubmit} loading={verifyLogin.isPending} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  error: { ...typography.caption, color: colors.error, marginBottom: 12 },
});
