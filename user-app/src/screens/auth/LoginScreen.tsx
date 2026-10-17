import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { KeyboardAwareView } from '@/components/KeyboardAwareView';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GradientHeader } from '@/components/GradientHeader';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { AuthStackParamList } from '@/navigation/types';
import { useRequestLoginOtp } from '@/hooks/useAuthMutations';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const PERKS: { icon: React.ComponentProps<typeof FontAwesome6>['name']; key: string }[] = [
  { icon: 'shield-halved', key: 'secure' },
  { icon: 'language', key: 'languages' },
  { icon: 'bolt', key: 'quick' },
];

/**
 * Log in with a mobile number: an OTP is sent, then OtpScreen checks it. Same look as the
 * registration screens — gradient header with a subtitle, a centred intro, and the form on a
 * sectioned card.
 */
export function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [mobileNumber, setMobileNumber] = useState('');
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestOtp = useRequestLoginOtp();
  const valid = /^[6-9][0-9]{9}$/.test(mobileNumber);

  const handleSubmit = () => {
    if (!valid || requestOtp.isPending) return;
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
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <GradientHeader title={t('auth.login')} subtitle={t('auth.loginHeaderSubtitle')} showBack />
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
                  <FontAwesome6 name="mobile-screen-button" size={30} color="#FFFFFF" solid />
                </LinearGradient>
              </View>
              <Text style={[styles.introTitle, { color: colors.text }]}>{t('auth.loginTitle')}</Text>
              <Text style={[styles.introText, { color: colors.textMuted }]}>{t('auth.loginSubtitle')}</Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.sectionHead}>
                <View style={[styles.sectionIcon, { backgroundColor: `${colors.primary}14` }]}>
                  <FontAwesome6 name="phone" size={12} color={colors.primary} solid />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('auth.mobileNumberLabel')}</Text>
              </View>

              <View
                style={[
                  styles.phoneRow,
                  {
                    borderColor: error ? colors.error : focused ? colors.primary : colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <View style={[styles.prefix, { borderRightColor: colors.border }]}>
                  <Text style={styles.flag}>🇮🇳</Text>
                  <Text style={[styles.prefixText, { color: colors.text }]}>+91</Text>
                </View>
                <TextInput
                  style={[styles.phoneInput, { color: colors.text }]}
                  value={mobileNumber}
                  onChangeText={(text) => {
                    setMobileNumber(text.replace(/[^0-9]/g, '').slice(0, 10));
                    setError(null);
                  }}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  importantForAutofill="no"
                  keyboardType="number-pad"
                  maxLength={10}
                  placeholder={t('auth.mobilePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  accessibilityLabel={t('auth.mobileNumberLabel')}
                />
                {valid ? (
                  <FontAwesome6 name="circle-check" size={18} color={colors.success} solid style={styles.validIcon} />
                ) : null}
              </View>

              <View style={styles.noteRow}>
                <FontAwesome6 name="lock" size={11} color={colors.textMuted} solid />
                <Text style={[styles.note, { color: colors.textMuted }]}>{t('auth.otpNote')}</Text>
              </View>

              {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

              <Button label={t('auth.sendOtp')} onPress={handleSubmit} loading={requestOtp.isPending} disabled={!valid} />
            </View>

            <View style={[styles.card, styles.perks, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {PERKS.map((perk) => (
                <View key={perk.key} style={styles.perk}>
                  <View style={[styles.perkIcon, { backgroundColor: `${colors.primary}14` }]}>
                    <FontAwesome6 name={perk.icon} size={14} color={colors.primary} solid />
                  </View>
                  <Text style={[styles.perkText, { color: colors.textMuted }]} numberOfLines={2}>
                    {t(`auth.perks.${perk.key}`)}
                  </Text>
                </View>
              ))}
            </View>

            <Pressable onPress={() => navigation.navigate('Register')} hitSlop={8} style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.textMuted }]}>
                {t('auth.newHere')} <Text style={[styles.footerLink, { color: colors.primary }]}>{t('auth.createAccount')}</Text>
              </Text>
            </Pressable>
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
  introTitle: { ...typography.heading, fontFamily: fonts.semiBold, fontSize: 22, marginTop: 14 },
  introText: { ...typography.body, textAlign: 'center', marginTop: 6, lineHeight: 21, paddingHorizontal: 12 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 16 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...typography.body, fontFamily: fonts.semiBold },
  phoneRow: { flexDirection: 'row', alignItems: 'center', height: 56, borderWidth: 1.5, borderRadius: 14, overflow: 'hidden' },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    alignSelf: 'stretch',
    borderRightWidth: 1,
  },
  flag: { fontSize: 18, includeFontPadding: false },
  prefixText: { fontFamily: fonts.semiBold, fontSize: 16, includeFontPadding: false },
  // Fixed height, no vertical padding and no Android font padding: Poppins otherwise sits low.
  phoneInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    paddingVertical: 0,
    fontFamily: fonts.semiBold,
    fontSize: 18,
    letterSpacing: 1.5,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  validIcon: { marginRight: 14 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12, marginBottom: 18 },
  note: { ...typography.caption, fontSize: 12, flex: 1 },
  error: { ...typography.caption, marginTop: -8, marginBottom: 14 },
  perks: { flexDirection: 'row', gap: 8 },
  perk: { flex: 1, alignItems: 'center', gap: 6 },
  perkIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  perkText: { ...typography.caption, fontSize: 11, textAlign: 'center' },
  footer: { alignItems: 'center', marginTop: 6 },
  footerText: { ...typography.body, textAlign: 'center' },
  footerLink: { fontFamily: fonts.semiBold },
});
