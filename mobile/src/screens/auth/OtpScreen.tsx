import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { colors, typography } from '@/theme';
import { AuthStackParamList } from '@/navigation/types';
import { useVerifyLoginOtp, useVerifyRegistrationOtp } from '@/hooks/useAuthMutations';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

export function OtpScreen({ route }: Props) {
  const { t } = useTranslation();
  const { mode, mobileNumber } = route.params;
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);

  const verifyRegistration = useVerifyRegistrationOtp();
  const verifyLogin = useVerifyLoginOtp();
  const mutation = mode === 'registration' ? verifyRegistration : verifyLogin;

  const handleSubmit = () => {
    setError(null);
    mutation.mutate(
      { mobileNumber, otp },
      {
        // Successful verification updates the auth store; RootNavigator
        // automatically switches to the app stack once accessToken is set.
        onSuccess: () => {
          // Every account is a plain user immediately (see .cloud/project-context.md's
          // "Account Model") — Worker/Business are opt-in, reachable from Home's menu,
          // not part of this form. One-time pointer so that's discoverable right away
          // instead of the user having to go looking for it.
          if (mode === 'registration') {
            Alert.alert(t('auth.accountCreatedTitle'), t('auth.accountCreatedMessage'));
          }
        },
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
      <Button label={t('auth.verifyOtp')} onPress={handleSubmit} loading={mutation.isPending} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  error: { ...typography.caption, color: colors.error, marginBottom: 12 },
});
