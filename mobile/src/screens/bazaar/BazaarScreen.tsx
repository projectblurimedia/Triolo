import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { BusinessProfileCard } from '@/components/BusinessProfileCard';
import { BusinessProfileModal } from '@/components/BusinessProfileModal';
import { useMyBusinessProfile } from '@/hooks/useBusinessMutations';
import { typography, useThemeColors } from '@/theme';

/** Placeholder until the Business shopping-list/ordering module is built (see .cloud/project-context.md) — the account's own Business profile, if any, gets a summary card at the top regardless. */
export function BazaarScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { data: businessProfile } = useMyBusinessProfile();
  const [editVisible, setEditVisible] = useState(false);

  return (
    <ScreenContainer edges={['left', 'right']}>
      {businessProfile ? <BusinessProfileCard profile={businessProfile} onEdit={() => setEditVisible(true)} /> : null}
      <Text style={[styles.placeholder, { color: colors.textMuted }]}>{t('bazaar.comingSoon')}</Text>
      <BusinessProfileModal visible={editVisible} onClose={() => setEditVisible(false)} profile={businessProfile} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  placeholder: { ...typography.body, marginTop: 20, textAlign: 'center' },
});
