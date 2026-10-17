import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { InfoTipsButton } from '@/components/InfoTipsButton';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/components/ScreenContainer';
import { JobPostForm } from '@/components/JobPostForm';
import { ConfirmModal } from '@/components/ConfirmModal';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { colors as brandColors, fonts, typography, useThemeColors } from '@/theme';
import { useDeleteJobPost, useMyJobPost, useSetJobPostActive } from '@/hooks/useJobPost';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { MainStackParamList } from '@/navigation/types';
import { KeyboardAwareView } from '@/components/KeyboardAwareView';
import { CancelButton } from '@/components/CancelButton';

type Props = NativeStackScreenProps<MainStackParamList, 'JobPost'>;

const DELETE_GRADIENT = ['#ef4444', '#dc2626'] as const;

/**
 * Create or edit the signed-in partner's "looking for work" post. With an existing post it also
 * offers the Show / Hide switch (a hidden post keeps its details but drops out of search) and
 * Delete.
 */
export function JobPostScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { data: post, isLoading } = useMyJobPost();
  const setActive = useSetJobPostActive();
  const deletePost = useDeleteJobPost();
  const [confirmDelete, setConfirmDelete] = useState(false);
  // The switch moves the moment it's tapped; it only goes back if saving fails. (Driving it
  // straight from the server value made the first tap snap back, so it needed a second tap.)
  const [live, setLive] = useState(post?.isActive ?? true);
  useEffect(() => {
    if (post) setLive(post.isActive);
  }, [post?.isActive]);

  const toggleActive = (value: boolean) => {
    setLive(value);
    setActive.mutate(value, {
      onSuccess: () => showToast({ variant: 'info', title: t(value ? 'jobPost.shownToast' : 'jobPost.hiddenToast') }),
      onError: (err) => {
        setLive(!value);
        showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(err, t) });
      },
    });
  };

  const handleDelete = () => {
    deletePost.mutate(undefined, {
      onSuccess: () => {
        setConfirmDelete(false);
        showToast({ variant: 'info', title: t('jobPost.deletedToast') });
        navigation.goBack();
      },
      onError: (err) => showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(err, t) }),
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <LoadingIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <KeyboardAwareView>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {post ? (
            <Pressable
              onPress={() => toggleActive(!live)}
              style={[styles.visibility, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.visibilityIcon, { backgroundColor: `${live ? brandColors.success : colors.textMuted}1A` }]}>
                <FontAwesome6
                  name={live ? 'eye' : 'eye-slash'}
                  size={15}
                  color={live ? brandColors.success : colors.textMuted}
                  solid
                />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.visibilityTitle, { color: colors.text }]}>
                  {t(live ? 'jobPost.liveTitle' : 'jobPost.hiddenTitle')}
                </Text>
                <Text style={[styles.visibilityText, { color: colors.textMuted }]}>
                  {t(live ? 'jobPost.liveMessage' : 'jobPost.hiddenMessage')}
                </Text>
              </View>
              <Switch
                value={live}
                onValueChange={toggleActive}
                trackColor={{ true: brandColors.success, false: colors.border }}
              />
            </Pressable>
          ) : (
            <InfoTipsButton
              title={t('infoTips.jobTitle')}
              tips={[
                { icon: 'user-tie', text: t('jobPost.subtitle') },
                { icon: 'camera', text: t('jobPost.photoHint') },
                { icon: 'location-dot', text: t('infoTips.location') },
              ]}
            />
          )}

          <JobPostForm post={post} showPhotoHint={false} showNameField onSaved={() => navigation.goBack()} />

          {post ? <CancelButton icon="trash" label={t('jobPost.delete')} onPress={() => setConfirmDelete(true)} /> : null}
        </ScrollView>
      </KeyboardAwareView>

      <ConfirmModal
        visible={confirmDelete}
        icon="trash"
        gradient={DELETE_GRADIENT}
        title={t('jobPost.deleteConfirmTitle')}
        message={t('jobPost.deleteConfirmMessage')}
        confirmLabel={t('jobPost.delete')}
        loading={deletePost.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingBottom: 40 },
  visibility: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  visibilityIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  visibilityTitle: { ...typography.body, fontFamily: fonts.semiBold },
  visibilityText: { ...typography.caption, fontSize: 12, marginTop: 1 },
});
