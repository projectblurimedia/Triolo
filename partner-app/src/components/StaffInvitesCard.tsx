import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAnswerStaffInvite, useStaffInvites } from '@/hooks/useBusinessMutations';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

const JOIN_GRADIENT = ['#16A34A', '#22C55E'] as const;

/**
 * "New for you": a shop owner added this person's number as delivery staff. Join lets the shop
 * hand them deliveries; Reject says no; Later just hides it until the app opens again.
 */
export function StaffInvitesCard() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const invites = useStaffInvites();
  const answer = useAnswerStaffInvite();
  const [hidden, setHidden] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const list = (invites.data ?? []).filter((invite) => !hidden.includes(invite.businessId));
  if (list.length === 0) return null;

  const respond = (businessId: string, shopName: string, accept: boolean) => {
    setBusy(businessId + (accept ? ':yes' : ':no'));
    answer.mutate(
      { businessId, accept },
      {
        onSuccess: () =>
          showToast({
            variant: accept ? 'success' : 'info',
            title: t(accept ? 'staffInvite.joinedTitle' : 'staffInvite.declinedTitle', { shop: shopName }),
            message: accept ? t('staffInvite.joinedMessage') : undefined,
          }),
        onError: (error) => showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) }),
        onSettled: () => setBusy(null),
      },
    );
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.section, { color: colors.textMuted }]}>{t('staffInvite.section')}</Text>
      {list.map((invite) => (
        <View key={invite.businessId} style={[styles.card, { backgroundColor: colors.surface, borderColor: `${brandColors.success}66` }]}>
          <View style={styles.top}>
            <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
              <FontAwesome6 name="person-biking" size={17} color="#FFFFFF" solid />
            </LinearGradient>
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                {t('staffInvite.title', { shop: invite.shopName })}
              </Text>
              <Text style={[styles.text, { color: colors.textMuted }]} numberOfLines={2}>
                {t('staffInvite.text', { owner: invite.ownerName, name: invite.fullName })}
              </Text>
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable
              disabled={busy !== null}
              onPress={() => setHidden((current) => [...current, invite.businessId])}
              style={[styles.ghost, { borderColor: colors.border }]}
            >
              <Text style={[styles.ghostText, { color: colors.textMuted }]}>{t('staffInvite.later')}</Text>
            </Pressable>
            <Pressable
              disabled={busy !== null}
              onPress={() => respond(invite.businessId, invite.shopName, false)}
              style={[styles.ghost, { borderColor: `${brandColors.error}66` }]}
            >
              <Text style={[styles.ghostText, { color: brandColors.error }]}>
                {busy === invite.businessId + ':no' ? '…' : t('staffInvite.reject')}
              </Text>
            </Pressable>
            <Pressable disabled={busy !== null} onPress={() => respond(invite.businessId, invite.shopName, true)} style={styles.flex}>
              <LinearGradient colors={JOIN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.join}>
                <FontAwesome6 name="check" size={13} color="#FFFFFF" solid />
                <Text style={styles.joinText}>{busy === invite.businessId + ':yes' ? '…' : t('staffInvite.join')}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { marginBottom: 14 },
  section: { ...typography.caption, fontFamily: fonts.semiBold, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  card: { borderRadius: 18, borderWidth: 1.5, padding: 14, gap: 12, marginBottom: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15 },
  text: { ...typography.caption, fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ghost: { height: 42, borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  ghostText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 13.5 },
  join: { height: 42, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  joinText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 14 },
});
