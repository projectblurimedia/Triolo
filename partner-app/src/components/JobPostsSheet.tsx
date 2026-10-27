import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassBackdrop, GlassCard } from './Glass';
import { JobPostCard } from './JobPostCard';
import { JobPost } from '@/services/jobSeekerService';
import { fonts, typography, useThemeColors } from '@/theme';

/**
 * Every job post of the partner in one sheet (Profile shows them as one card when there are
 * two or more). Tapping a post opens its profile; Add another starts a new one.
 */
export function JobPostsSheet({
  visible,
  posts,
  name,
  canAdd,
  hint,
  onClose,
  onOpen,
  onAdd,
}: {
  visible: boolean;
  posts: JobPost[];
  name?: string;
  canAdd: boolean;
  /** The line under the title (default: tap one to open its profile). */
  hint?: string;
  onClose: () => void;
  onOpen: (post: JobPost) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GlassBackdrop onPress={onClose} style={styles.overlay}>
        <GlassCard style={styles.sheet}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.text }]}>{t('jobPost.postsTitle')}</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>{hint ?? t('jobPost.postsSheetHint')}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={[styles.close, { borderColor: colors.border }]}>
              <FontAwesome6 name="xmark" size={14} color={colors.text} solid />
            </Pressable>
          </View>
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {posts.map((post, index) => (
              <View key={post.id}>
                <Text style={[styles.number, { color: colors.primary }]}>{t('jobPost.postNumber', { n: index + 1 })}</Text>
                <JobPostCard post={post} name={name} compact onPress={() => onOpen(post)} />
              </View>
            ))}
          </ScrollView>
          {canAdd ? (
            <Pressable
              onPress={onAdd}
              style={({ pressed }) => [styles.add, { borderColor: `${colors.primary}40`, backgroundColor: `${colors.primary}0A`, opacity: pressed ? 0.85 : 1 }]}
            >
              <FontAwesome6 name="plus" size={13} color={colors.primary} solid />
              <Text style={[styles.addText, { color: colors.primary }]}>{t('jobPost.addAnother')}</Text>
            </Pressable>
          ) : null}
        </GlassCard>
      </GlassBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  sheet: { borderRadius: 22, padding: 14, maxHeight: '80%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  title: { ...typography.subheading, fontFamily: fonts.semiBold },
  subtitle: { ...typography.caption, fontSize: 12 },
  close: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 0 },
  number: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', marginTop: 4 },
  addText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
});
