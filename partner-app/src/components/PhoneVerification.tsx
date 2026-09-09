import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { TextField } from './TextField';
import { Button } from './Button';
import { LoadingIndicator } from './LoadingIndicator';
import { authService } from '@/services/authService';
import { ApiError } from '@/services/apiClient';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { useAuthStore } from '@/state/authStore';
import { useSettingsStore } from '@/state/settingsStore';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

interface PhoneVerificationProps {
  fullName: string;
  onFullNameChange: (value: string) => void;
  mobileNumber: string;
  onMobileNumberChange: (value: string) => void;
  verified: boolean;
  onVerified: () => void;
}

/**
 * Full Name + Mobile Number, inline as part of `RegisterWorkerScreen`/`RegisterBusinessScreen`
 * (not a separate `Register`→`Otp` stack detour) — mirrors `registration-web`'s own
 * `PhoneVerification` component field-for-field, per explicit instruction that registration
 * should be "one place" in both. Tries `/auth/login/request-otp` first; an
 * `ACCOUNT_NOT_FOUND` response falls through to `/auth/register/request-otp` with the typed
 * name instead — same "one flow covers both cases" logic the old `RegisterScreen`+`OtpScreen`
 * detour used, just surfaced inline here. `onVerified()` fires once the OTP is confirmed and
 * the session is established (`setSession`) — the caller uses that to enable its own Submit
 * button and check whether a profile already exists. Full Name/Mobile Number stay visible
 * (disabled once verification starts) rather than being swapped out for a bare confirmation
 * line — per explicit feedback not to remove those fields from view. The Mobile Number
 * field carries its own status icon via `TextField`'s `rightIcon` slot (absolutely
 * positioned inside the input's right edge, not in the label row, per a later correction):
 * an orange clock while unverified, a green checkmark once verified.
 *
 * The "Verify" action itself sits beside the Mobile Number input, in the same row, rather
 * than as a full-width button underneath — per explicit follow-up feedback. Because
 * `TextField` normally renders its own label above the input, aligning a sibling button to
 * just the input's own box (not the label+input block) needed the label pulled out and
 * rendered separately above the row instead of passed through `TextField`'s `label` prop —
 * otherwise the button's vertical centering would land relative to the taller label+input
 * block and visibly sit off from the input itself. `TextField`'s `containerStyle` prop
 * (added for this) zeroes out its default `marginBottom` so the row manages its own spacing
 * instead. Confirm OTP/Change Number use the shared `Button` component, which now renders at
 * a fixed height (see `Button.tsx`) specifically so the two stay the same height whether
 * either one is mid-loading or not.
 */
export function PhoneVerification({
  fullName,
  onFullNameChange,
  mobileNumber,
  onMobileNumberChange,
  verified,
  onVerified,
}: PhoneVerificationProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const setSession = useAuthStore((s) => s.setSession);
  const language = useSettingsStore((s) => s.language);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [mode, setMode] = useState<'login' | 'registration' | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendOtp = async () => {
    setError(null);
    if (!fullName.trim() || !mobileNumber.trim()) {
      setError(t('errors.VALIDATION_ERROR'));
      return;
    }
    setSending(true);
    try {
      await authService.requestLoginOtp({ mobileNumber });
      setMode('login');
      setOtpSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_NOT_FOUND') {
        try {
          await authService.requestRegistrationOtp({ fullName, mobileNumber, preferredLanguage: language });
          setMode('registration');
          setOtpSent(true);
        } catch (registrationErr) {
          setError(getLocalizedErrorMessage(registrationErr, t));
        }
      } else {
        setError(getLocalizedErrorMessage(err, t));
      }
    } finally {
      setSending(false);
    }
  };

  const confirmOtp = async () => {
    setError(null);
    if (!otp.trim()) {
      setError(t('errors.VALIDATION_ERROR'));
      return;
    }
    setConfirming(true);
    try {
      const result =
        mode === 'registration'
          ? await authService.verifyRegistrationOtp({ mobileNumber, otp })
          : await authService.verifyLoginOtp({ mobileNumber, otp });
      setSession(result);
      onVerified();
    } catch (err) {
      setError(getLocalizedErrorMessage(err, t));
    } finally {
      setConfirming(false);
    }
  };

  const changeNumber = () => {
    setOtpSent(false);
    setOtp('');
    setMode(null);
    setError(null);
  };

  return (
    <View style={styles.container}>
      <TextField
        label={t('auth.fullNameLabel')}
        value={fullName}
        onChangeText={onFullNameChange}
        editable={!otpSent && !verified}
      />

      <Text style={[styles.label, { color: colors.textMuted }]}>{t('auth.mobileNumberLabel')}</Text>
      <View style={styles.mobileRow}>
        <View style={styles.mobileField}>
          <TextField
            containerStyle={styles.noMargin}
            rightIcon={
              verified ? (
                <FontAwesome6 name="circle-check" size={16} color={colors.success} solid />
              ) : (
                <FontAwesome6 name="clock" size={16} color={colors.warning} solid />
              )
            }
            value={mobileNumber}
            onChangeText={onMobileNumberChange}
            keyboardType="number-pad"
            maxLength={10}
            editable={!otpSent && !verified}
          />
        </View>
        {!verified && !otpSent ? (
          <Pressable onPress={sendOtp} disabled={sending} accessibilityLabel={t('auth.verifyMobileNumber')}>
            <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.verifyButton}>
              {sending ? <LoadingIndicator size={16} color={colors.white} /> : <Text style={styles.verifyButtonText}>{t('auth.verify')}</Text>}
            </LinearGradient>
          </Pressable>
        ) : null}
      </View>

      {!verified && otpSent ? (
        <>
          <TextField
            label={t('auth.otpSentLabel', { mobileNumber })}
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
          <View style={[styles.otpButtonRow, styles.buttonSpacing]}>
            <View style={styles.otpButton}>
              <Button label={t('auth.confirmOtp')} onPress={confirmOtp} loading={confirming} />
            </View>
            <View style={styles.otpButton}>
              <Button label={t('auth.changeNumber')} onPress={changeNumber} disabled={confirming} gradient={['#9CA3AF', '#6B7280']} />
            </View>
          </View>
        </>
      ) : null}

      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 4 },
  label: { ...typography.caption, marginBottom: 6 },
  mobileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  mobileField: { flex: 1 },
  noMargin: { marginBottom: 0 },
  verifyButton: { height: 46, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  verifyButtonText: { color: '#FFFFFF', ...typography.caption, fontFamily: fonts.semiBold },
  buttonSpacing: { marginBottom: 20 },
  otpButtonRow: { flexDirection: 'row', gap: 10 },
  otpButton: { flex: 1 },
  error: { ...typography.caption, marginBottom: 12 },
});
