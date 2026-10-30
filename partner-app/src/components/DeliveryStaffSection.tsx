import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassBackdrop, GlassCard } from './Glass';
import { TextField } from './TextField';
import { Button } from './Button';
import { ConfirmModal } from './ConfirmModal';
import { useAddShopStaff, useRemoveShopStaff, useShopStaff } from '@/hooks/useBusinessMutations';
import { StaffDraft } from '@/services/businessesService';
import { ApiError } from '@/services/apiClient';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { showToast } from '@/state/toastStore';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

const MOBILE_PATTERN = /^[6-9]\d{9}$/;
const DELETE_GRADIENT = ['#ef4444', '#dc2626'] as const;
const STAFF_GRADIENT = ['#0A3FAE', '#0055D3', '#2B83FF'] as const;
// Each person gets their own avatar colour, so the list reads at a glance.
const AVATAR_COLORS = ['#0055D3', '#16A34A', '#7C3AED', '#DB2777', '#0891B2', '#CA8A04'];

interface StaffRow {
  key: string;
  fullName: string;
  mobileNumber: string;
  /** Saved shops only: whether they joined yet. */
  status?: 'invited' | 'active' | 'declined';
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts.length === 1 ? parts[0][0] : `${parts[0][0]}${parts[parts.length - 1][0]}`).toUpperCase();
}

function StatusPill({ status }: { status: 'invited' | 'active' | 'declined' }) {
  const { t } = useTranslation();
  const tone = status === 'active' ? '#16A34A' : status === 'invited' ? '#CA8A04' : '#DC2626';
  return (
    <View style={[styles.statusPill, { backgroundColor: `${tone}1A` }]}>
      <Text style={[styles.statusText, { color: tone }]}>{t(`deliveryStaff.status.${status}`)}</Text>
    </View>
  );
}

function StaffAvatar({ name, index, size = 36 }: { name: string; index: number; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initialsOf(name)}</Text>
    </View>
  );
}

/**
 * The shop form's Delivery Staff block: the name and number the owner types are that person's
 * sign-in (they log in to Triolo Partner with the number and an OTP). The owner's own number is
 * fine too — the OTP then comes to the owner. Each person sees only the deliveries handed to them.
 */
function StaffEditor({
  rows,
  onAdd,
  onRemove,
}: {
  rows: StaffRow[];
  /** Resolves when added; throws with a message to show in the sheet. */
  onAdd: (member: StaffDraft) => Promise<void>;
  onRemove: (row: StaffRow) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [adding, setAdding] = useState(false);

  return (
    <View style={[styles.editor, { borderColor: `${colors.primary}33`, backgroundColor: `${colors.primary}08` }]}>
      <View style={styles.editorHead}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.editorIcon}>
          <FontAwesome6 name="person-biking" size={14} color="#FFFFFF" solid />
        </LinearGradient>
        <View style={styles.flex}>
          <Text style={[styles.editorTitle, { color: colors.text }]}>{t('deliveryStaff.title')}</Text>
          <Text style={[styles.editorHint, { color: colors.textMuted }]}>{t('deliveryStaff.formHint')}</Text>
        </View>
        {rows.length > 0 ? (
          <View style={[styles.countPill, { backgroundColor: colors.primary }]}>
            <Text style={styles.countText}>{rows.length}</Text>
          </View>
        ) : null}
      </View>
      {rows.map((row, index) => (
        <View key={row.key} style={[styles.editRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <StaffAvatar name={row.fullName} index={index} size={34} />
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {row.fullName}
            </Text>
            <Text style={[styles.phone, { color: colors.textMuted }]}>{row.mobileNumber}</Text>
          </View>
          {row.status ? <StatusPill status={row.status} /> : null}
          <Pressable
            onPress={() => onRemove(row)}
            hitSlop={6}
            style={[styles.iconButton, { borderColor: `${colors.error}40` }]}
            accessibilityLabel={t('deliveryStaff.remove')}
          >
            <FontAwesome6 name="trash" size={12} color={colors.error} solid />
          </Pressable>
        </View>
      ))}
      {rows.length > 0 ? (
        // How they start: install the app, log in with this number, and join.
        <View style={[styles.install, { backgroundColor: colors.surface, borderColor: `${colors.primary}26` }]}>
          <FontAwesome6 name="mobile-screen-button" size={14} color={colors.primary} solid />
          <Text style={[styles.installText, { color: colors.text }]}>{t('deliveryStaff.installNote')}</Text>
        </View>
      ) : null}
      <Pressable
        onPress={() => setAdding(true)}
        style={({ pressed }) => [styles.add, { borderColor: `${colors.primary}55`, backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]}
      >
        <FontAwesome6 name="user-plus" size={13} color={colors.primary} solid />
        <Text style={[styles.addText, { color: colors.primary }]}>{t('deliveryStaff.add')}</Text>
      </Pressable>
      <AddStaffSheet visible={adding} onClose={() => setAdding(false)} onAdd={onAdd} />
    </View>
  );
}

/** Editing a saved shop: staff are added / removed on the server straight away. */
export function ShopStaffEditor({ shopId }: { shopId: string }) {
  const { t } = useTranslation();
  const staff = useShopStaff(shopId);
  const add = useAddShopStaff(shopId);
  const remove = useRemoveShopStaff(shopId);
  const [removing, setRemoving] = useState<StaffRow | null>(null);
  const rows = (staff.data ?? []).map((member) => ({
    key: member.id,
    fullName: member.fullName,
    mobileNumber: member.mobileNumber,
    status: member.status,
  }));

  return (
    <>
      <StaffEditor
        rows={rows}
        onAdd={async (member) => {
          await add.mutateAsync(member);
          showToast({ variant: 'success', title: t('deliveryStaff.addedTitle'), message: t('deliveryStaff.addedMessage') });
        }}
        onRemove={setRemoving}
      />
      <ConfirmModal
        visible={!!removing}
        icon="user-minus"
        gradient={DELETE_GRADIENT}
        title={t('deliveryStaff.removeTitle')}
        message={t('deliveryStaff.removeMessage', { name: removing?.fullName ?? '' })}
        confirmLabel={t('deliveryStaff.remove')}
        loading={remove.isPending}
        onCancel={() => setRemoving(null)}
        onConfirm={() =>
          removing &&
          remove.mutate(removing.key, {
            onSuccess: () => setRemoving(null),
            onError: (error) => showToast({ variant: 'error', title: getLocalizedErrorMessage(error, t) }),
          })
        }
      />
    </>
  );
}

/** A new shop: staff are kept in the form and added once the shop is saved. */
export function DraftStaffEditor({ value, onChange }: { value: StaffDraft[]; onChange: (next: StaffDraft[]) => void }) {
  const { t } = useTranslation();
  return (
    <StaffEditor
      rows={value.map((member) => ({ key: member.mobileNumber, ...member }))}
      onAdd={async (member) => {
        // The same number again just renames that person (like the server does).
        if (value.length >= 20 && !value.some((entry) => entry.mobileNumber === member.mobileNumber)) {
          throw new Error(t('errors.STAFF_LIMIT'));
        }
        onChange([...value.filter((entry) => entry.mobileNumber !== member.mobileNumber), member]);
      }}
      onRemove={(row) => onChange(value.filter((entry) => entry.mobileNumber !== row.mobileNumber))}
    />
  );
}

/** The shop page: who delivers for this shop. Nothing when there is nobody yet (added on Edit). */
export function DeliveryStaffCard({ shopId }: { shopId: string }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const staff = useShopStaff(shopId);
  const list = staff.data ?? [];
  if (list.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: `${colors.primary}26` }]}>
      <LinearGradient colors={STAFF_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.band}>
        <View style={[styles.bubble, styles.bubbleLarge]} />
        <View style={[styles.bubble, styles.bubbleSmall]} />
        <View style={styles.bandIcon}>
          <FontAwesome6 name="person-biking" size={16} color="#FFFFFF" solid />
        </View>
        <View style={styles.flex}>
          <Text style={styles.bandTitle}>{t('deliveryStaff.title')}</Text>
          <Text style={styles.bandText} numberOfLines={1}>
            {t('deliveryStaff.cardLine', { count: list.length })}
          </Text>
        </View>
        <View style={styles.bandAvatars}>
          {list.slice(0, 3).map((member, index) => (
            <View key={member.id} style={[styles.bandAvatarRing, { marginLeft: index === 0 ? 0 : -10 }]}>
              <StaffAvatar name={member.fullName} index={index} size={28} />
            </View>
          ))}
        </View>
      </LinearGradient>
      {list.map((member, index) => (
        <View
          key={member.id}
          style={[styles.cardRow, index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null]}
        >
          <StaffAvatar name={member.fullName} index={index} />
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {member.fullName}
            </Text>
            <Text style={[styles.phone, { color: colors.textMuted }]}>{member.mobileNumber}</Text>
          </View>
          {member.status !== 'active' ? <StatusPill status={member.status} /> : null}
          <Pressable
            onPress={() => Linking.openURL(`tel:${member.mobileNumber}`)}
            hitSlop={6}
            style={[styles.callButton, { backgroundColor: `${colors.primary}14` }]}
            accessibilityLabel={t('deliveryStaff.call')}
          >
            <FontAwesome6 name="phone" size={13} color={colors.primary} solid />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function AddStaffSheet({ visible, onClose, onAdd }: { visible: boolean; onClose: () => void; onAdd: (member: StaffDraft) => Promise<void> }) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setFullName('');
    setMobileNumber('');
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (fullName.trim().length < 2) return setError(t('deliveryStaff.nameNeeded'));
    if (!MOBILE_PATTERN.test(mobileNumber)) return setError(t('deliveryStaff.phoneNeeded'));
    setError(null);
    setBusy(true);
    try {
      await onAdd({ fullName: fullName.trim(), mobileNumber });
      close();
    } catch (err) {
      setError(err instanceof ApiError || !(err instanceof Error) ? getLocalizedErrorMessage(err, t) : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <GlassBackdrop onPress={close} style={styles.overlay}>
          <GlassCard style={styles.sheet}>
            <View style={styles.head}>
              <View style={styles.flex}>
                <Text style={[styles.title, { color: colors.text }]}>{t('deliveryStaff.addTitle')}</Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>{t('deliveryStaff.addHint')}</Text>
              </View>
              <Pressable onPress={close} hitSlop={8} style={[styles.close, { borderColor: colors.border }]}>
                <FontAwesome6 name="xmark" size={14} color={colors.text} solid />
              </Pressable>
            </View>
            <TextField
              label={t('deliveryStaff.nameLabel')}
              placeholder={t('deliveryStaff.namePlaceholder')}
              value={fullName}
              onChangeText={setFullName}
              importantForAutofill="no"
              autoCapitalize="words"
            />
            <TextField
              label={t('deliveryStaff.phoneLabel')}
              placeholder={t('deliveryStaff.phonePlaceholder')}
              value={mobileNumber}
              onChangeText={(text) => setMobileNumber(text.replace(/\D/g, '').slice(0, 10))}
              keyboardType="number-pad"
              importantForAutofill="no"
              maxLength={10}
            />
            <Text style={[styles.note, { color: colors.textMuted }]}>{t('deliveryStaff.ownerNumberNote')}</Text>
            {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
            <Button label={t('deliveryStaff.addButton')} onPress={submit} loading={busy} />
          </GlassCard>
        </GlassBackdrop>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontFamily: fonts.semiBold },
  name: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  phone: { ...typography.caption, fontSize: 11.5 },
  iconButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  // Form editor
  editor: { borderRadius: 18, borderWidth: 1, padding: 12, marginBottom: 16, gap: 8 },
  editorHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  editorIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  editorTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14.5 },
  editorHint: { ...typography.caption, fontSize: 11.5, lineHeight: 16 },
  countPill: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 12 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 9 },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed' },
  addText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 13.5 },
  statusPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  statusText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 10.5 },
  install: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 10 },
  installText: { ...typography.caption, fontSize: 12, lineHeight: 17, flex: 1 },
  // Shop page card: same gap above and below as the page's other sections.
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', marginTop: 22 },
  band: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, overflow: 'hidden' },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)' },
  bubbleLarge: { width: 120, height: 120, top: -60, right: -30 },
  bubbleSmall: { width: 70, height: 70, bottom: -40, left: 40 },
  bandIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandTitle: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 15.5 },
  bandText: { color: 'rgba(255,255,255,0.88)', fontFamily: fonts.regular, fontSize: 12 },
  bandAvatars: { flexDirection: 'row' },
  bandAvatarRing: { borderRadius: 16, borderWidth: 2, borderColor: '#FFFFFF' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  callButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  // Add sheet
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  sheet: { borderRadius: 22, padding: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { ...typography.subheading, fontFamily: fonts.semiBold },
  subtitle: { ...typography.caption, fontSize: 12 },
  close: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  note: { ...typography.caption, fontSize: 11.5, lineHeight: 16, marginBottom: 10 },
  error: { ...typography.caption, fontSize: 12, marginBottom: 10 },
});
