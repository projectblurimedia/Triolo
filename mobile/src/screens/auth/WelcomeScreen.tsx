import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { colors, typography } from '@/theme';
import { AuthStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.appName}>{t('common.appName')}</Text>
        <Text style={styles.title}>{t('auth.welcomeTitle')}</Text>

        <View style={styles.actions}>
          <Button label={t('auth.roleUser')} onPress={() => navigation.navigate('Register', { role: 'user' })} />
          <Button label={t('auth.roleWorker')} onPress={() => navigation.navigate('Register', { role: 'worker' })} />
          <Button
            label={t('auth.roleBusiness')}
            onPress={() => navigation.navigate('Register', { role: 'business_owner' })}
          />
          <Button label={t('auth.login')} onPress={() => navigation.navigate('Login')} />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', gap: 12 },
  appName: { ...typography.heading, color: colors.primary, textAlign: 'center', marginBottom: 8 },
  title: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginBottom: 32 },
  actions: { gap: 12 },
});
