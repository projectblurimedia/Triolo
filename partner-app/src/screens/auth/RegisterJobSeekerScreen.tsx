import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { PhoneVerification } from '@/components/PhoneVerification';
import { JobPostForm } from '@/components/JobPostForm';
import { typography, useThemeColors } from '@/theme';
import { useAuthStore } from '@/state/authStore';
import { KeyboardAwareView } from '@/components/KeyboardAwareView';

/**
 * "Looking for a job?" from the Welcome screen: name + phone verification and the job post in
 * one form, the same one-place registration as RegisterWorkerScreen (see its comment for why
 * `isCompletingRegistration` keeps this screen mounted through phone verification). No admin
 * review: once saved, the post is live and the app moves on to the signed-in screens.
 */
export function RegisterJobSeekerScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const setCompletingRegistration = useAuthStore((state) => state.setCompletingRegistration);
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    setCompletingRegistration(true);
    return () => setCompletingRegistration(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <KeyboardAwareView>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('jobPost.subtitle')}</Text>
          <JobPostForm
            header={
              <PhoneVerification
                fullName={fullName}
                onFullNameChange={setFullName}
                mobileNumber={mobileNumber}
                onMobileNumberChange={setMobileNumber}
                verified={verified}
                onVerified={() => setVerified(true)}
              />
            }
            locked={!verified}
            lockedHint={t('auth.verifyToSubmitHint')}
            onSaved={() => setCompletingRegistration(false)}
          />
        </ScrollView>
      </KeyboardAwareView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 40 },
  subtitle: { ...typography.body, marginBottom: 18 },
});
