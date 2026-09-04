import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenContainer } from '@/components/ScreenContainer';
import { WorkerProfileCard } from '@/components/WorkerProfileCard';
import { WorkerProfileModal } from '@/components/WorkerProfileModal';
import { useMyWorkerProfile } from '@/hooks/useWorkerMutations';
import { typography, useThemeColors } from '@/theme';

/** Placeholder until the Worker/Business search module is built (see .cloud/project-context.md) — the account's own Worker profile, if any, gets a summary card at the top regardless. */
export function ServicesScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { data: workerProfile } = useMyWorkerProfile();
  const [editVisible, setEditVisible] = useState(false);

  return (
    <ScreenContainer edges={['left', 'right']}>
      {workerProfile ? <WorkerProfileCard profile={workerProfile} onEdit={() => setEditVisible(true)} /> : null}
      <Text style={[styles.placeholder, { color: colors.textMuted }]}>{t('services.comingSoon')}</Text>
      <WorkerProfileModal visible={editVisible} onClose={() => setEditVisible(false)} profile={workerProfile} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  placeholder: { ...typography.body, marginTop: 20, textAlign: 'center' },
});
