import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { KeyboardAwareView } from '@/components/KeyboardAwareView';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GradientHeader } from '@/components/GradientHeader';
import { ScreenContainer } from '@/components/ScreenContainer';
import { OtpCodeInput } from '@/components/OtpCodeInput';
import { Button } from '@/components/Button';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { AuthStackParamList } from '@/navigation/types';
import { useRequestLoginOtp, useVerifyLoginOtp } from '@/hooks/useAuthMutations';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

function formatMobile(mobileNumber: string): string {
  return mobileNumber.length === 10 ? `+91 ${mobileNumber.slice(0, 5)} ${mobileNumber.slice(5)}` : mobileNumber;
}

/**
 * Login-only now — registration's own OTP verification moved inline into
 * `PhoneVerification`/`RegisterWorkerScreen`/`RegisterBusinessScreen` (see those screens'
 * doc comments), so `LoginScreen` is the only remaining caller of this screen. Same look as
 * LoginScreen. The code is checked as soon as all six digits are in; "Resend" unlocks after
 * 30 seconds.
 */
export function OtpScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { mobileNumber } = route.params;
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const verifyLogin = useVerifyLoginOtp();
  const resend = useRequestLoginOtp();

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const verify = (code: string) => {
    if (code.length !== OTP_LENGTH || verifyLogin.isPending) return;
    setError(null);
    verifyLogin.mutate(
      { mobileNumber, otp: code },
      {
        // RootNavigator automatically switches to MainNavigator once accessToken is set.
        onError: (err) => {
          setOtp('');
          setError(getLocalizedErrorMessage(err, t));
        },
      },
    );
  };

  const handleResend = () => {
    resend.mutate(
      { mobileNumber },
      {
        onSuccess: () => {
          setOtp('');
          setError(null);
          setSecondsLeft(RESEND_SECONDS);
          showToast({ variant: 'success', title: t('auth.otpResent') });
        },
        onError: (err) => setError(getLocalizedErrorMessage(err, t)),
      },
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <GradientHeader title={t('auth.verifyOtp')} subtitle={t('auth.otpHeaderSubtitle')} showBack />
      <ScreenContainer edges={['left', 'right', 'bottom']}>
        <KeyboardAwareView>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
          >
            <View style={styles.intro}>
              <View style={[styles.introRing, { borderColor: `${colors.primary}33`, backgroundColor: `${colors.primary}0D` }]}>
                <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.introIcon}>
                  <FontAwesome6 name="shield-halved" size={30} color="#FFFFFF" solid />
                </LinearGradient>
              </View>
              <Text style={[styles.introTitle, { color: colors.text }]}>{t('auth.otpTitle')}</Text>
              <Text style={[styles.introText, { color: colors.textMuted }]}>
                {t('auth.otpSubtitle', { mobileNumber: formatMobile(mobileNumber) })}
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.numberRow}>
                <View style={styles.numberLeft}>
                  <View style={[styles.sectionIcon, { backgroundColor: `${colors.primary}14` }]}>
                    <FontAwesome6 name="phone" size={12} color={colors.primary} solid />
                  </View>
                  <Text style={[styles.number, { color: colors.text }]}>{formatMobile(mobileNumber)}</Text>
                </View>
                <Pressable onPress={navigation.goBack} hitSlop={8} style={styles.changeButton}>
                  <FontAwesome6 name="pen" size={11} color={colors.primary} solid />
                  <Text style={[styles.change, { color: colors.primary }]}>{t('auth.changeNumber')}</Text>
                </Pressable>
              </View>

              <OtpCodeInput
                value={otp}
                onChange={(value) => {
                  setOtp(value);
                  setError(null);
                }}
                length={OTP_LENGTH}
                onComplete={verify}
                hasError={!!error}
              />

              {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

              <View style={styles.resendRow}>
                {secondsLeft > 0 ? (
                  <Text style={[styles.resendText, { color: colors.textMuted }]}>
                    {t('auth.resendIn', { seconds: secondsLeft })}
                  </Text>
                ) : (
                  <Pressable onPress={handleResend} disabled={resend.isPending} hitSlop={8}>
                    <Text style={[styles.resendLink, { color: colors.primary, opacity: resend.isPending ? 0.5 : 1 }]}>
                      {t('auth.resendOtp')}
                    </Text>
                  </Pressable>
                )}
              </View>

              <Button
                label={t('auth.verifyOtp')}
                onPress={() => verify(otp)}
                loading={verifyLogin.isPending}
                disabled={otp.length !== OTP_LENGTH}
              />
            </View>
          </ScrollView>
        </KeyboardAwareView>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingBottom: 40 },
  intro: { alignItems: 'center', marginTop: 6, marginBottom: 22 },
  introRing: { padding: 7, borderRadius: 60, borderWidth: 1 },
  introIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  introTitle: { ...typography.heading, fontFamily: fonts.semiBold, fontSize: 22, marginTop: 14, textAlign: 'center' },
  introText: { ...typography.body, textAlign: 'center', marginTop: 6, lineHeight: 21, paddingHorizontal: 12 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 16 },
  numberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  numberLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  number: { fontFamily: fonts.semiBold, fontSize: 16 },
  changeButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  change: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13 },
  error: { ...typography.caption, marginTop: 12 },
  resendRow: { alignItems: 'center', marginTop: 18, marginBottom: 18 },
  resendText: { ...typography.caption, fontSize: 13 },
  resendLink: { fontFamily: fonts.semiBold, fontSize: 14 },
});
