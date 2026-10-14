import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  type ExpoSpeechRecognitionErrorEvent,
} from 'expo-speech-recognition';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ConfirmModal } from '@/components/ConfirmModal';
import { SendListModal } from '@/components/SendListModal';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { listFallbackName, SavedList, useListStore } from '@/state/listStore';
import { showToast } from '@/state/toastStore';
import { parseVoiceListText } from '@/utils/parseVoiceList';

const MIC_SIZE = 84;
const DELETE_GRADIENT = ['#ef4444', '#dc2626'] as const;
const PREVIEW_ITEMS = 3;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Built by hand — Hermes on Android doesn't reliably ship Intl date formatting.
function formatShortDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/**
 * Prepare List tab — the customer's saved shopping lists ("My Lists") plus an editor.
 *
 * In the editor, tap the mic and say items and quantities in one go ("senagapappu kg minapappu
 * 3/2kg"); each "<item> <quantity>? <unit>" run becomes its own editable row (see
 * utils/parseVoiceList.ts). Rows can also be typed in. "Save List" stores it in My Lists, where
 * any list can be edited again, deleted, or sent to a nearby shop to pack. Lists live only on
 * this device (state/listStore.ts); a sent order keeps its own copy of the items.
 *
 * Rows the user never named are dropped on save — a manual row starts empty (with an "Item
 * name" placeholder) so an untouched row can never reach a shop as a fake item.
 */
export function PrepareListScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const lists = useListStore((state) => state.lists);
  const draft = useListStore((state) => state.draft);
  const addItems = useListStore((state) => state.addItems);
  const updateItem = useListStore((state) => state.updateItem);
  const removeItem = useListStore((state) => state.removeItem);
  const clearDraftItems = useListStore((state) => state.clearDraftItems);
  const setDraftName = useListStore((state) => state.setDraftName);
  const startNewList = useListStore((state) => state.startNewList);
  const editList = useListStore((state) => state.editList);
  const saveDraft = useListStore((state) => state.saveDraft);
  const discardDraft = useListStore((state) => state.discardDraft);
  const deleteList = useListStore((state) => state.deleteList);

  // An unfinished draft (from before the app was closed) reopens in the editor; otherwise the
  // saved lists come first, and with no lists at all the editor is the only thing to show.
  const [screen, setScreen] = useState<'lists' | 'editor'>(() => {
    const state = useListStore.getState();
    if (state.draft.items.length > 0 || state.draft.listId) return 'editor';
    return state.lists.length > 0 ? 'lists' : 'editor';
  });
  const [recognizing, setRecognizing] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedList | null>(null);
  const [sendListId, setSendListId] = useState<string | null>(null);
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  const items = draft.items;
  const isEditingSaved = draft.listId !== null;

  // Same floating-tab-bar clearance as ProfileScreen's own ScrollView — CustomTabBar is
  // position:'absolute' and contributes ~0 height to layout.
  const tabBarClearance = Math.max(insets.bottom, 18) + 66 + 24;

  useEffect(() => {
    if (!recognizing) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recognizing, pulse]);

  useSpeechRecognitionEvent('start', () => setRecognizing(true));
  useSpeechRecognitionEvent('end', () => {
    setRecognizing(false);
    setInterimText('');
  });
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript ?? '';
    if (!event.isFinal) {
      setInterimText(transcript);
      return;
    }
    setInterimText('');
    const parsed = parseVoiceListText(transcript);
    if (parsed.length) {
      addItems(parsed);
      showToast({ variant: 'success', title: t('prepareList.itemsAddedTitle', { count: parsed.length }) });
    }
  });
  useSpeechRecognitionEvent('error', (event: ExpoSpeechRecognitionErrorEvent) => {
    setRecognizing(false);
    if (event.error === 'not-allowed') {
      showToast({ variant: 'error', title: t('prepareList.micPermissionTitle'), message: t('prepareList.micPermissionMessage') });
    } else if (event.error === 'no-speech') {
      // Nothing heard — not really an error worth interrupting the user over.
    } else {
      showToast({ variant: 'error', title: t('common.errorTitle'), message: t('prepareList.recognitionErrorMessage') });
    }
  });

  const stopListening = () => {
    if (recognizing) ExpoSpeechRecognitionModule.stop();
  };

  const handleMicPress = async () => {
    if (recognizing) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      showToast({ variant: 'error', title: t('prepareList.micPermissionTitle'), message: t('prepareList.micPermissionMessage') });
      return;
    }
    ExpoSpeechRecognitionModule.start({
      // Always te-IN regardless of the display language — item names here are mostly Telugu
      // with English units/numbers mixed in, which te-IN handles far better than en-IN did
      // (en-IN mangled Telugu quantity words like "nnara").
      lang: 'te-IN',
      interimResults: true,
      continuous: true,
    });
  };

  const handleAddBlankItem = () => {
    addItems([{ name: '', quantity: '1', unit: '' }]);
    const added = useListStore.getState().draft.items;
    setFocusItemId(added[added.length - 1]?.id ?? null);
  };

  const handleSave = () => {
    stopListening();
    const savedId = saveDraft(listFallbackName(t('prepareList.defaultListName')));
    if (!savedId) {
      showToast({ variant: 'info', title: t('prepareList.emptyDraftTitle'), message: t('prepareList.emptyDraftMessage') });
      return;
    }
    showToast({ variant: 'success', title: t('prepareList.savedTitle') });
    setScreen('lists');
  };

  const leaveEditor = () => {
    stopListening();
    discardDraft();
    setShowDiscardConfirm(false);
    setScreen('lists');
  };

  const handleBack = () => {
    if (items.some((item) => item.name.trim())) setShowDiscardConfirm(true);
    else leaveEditor();
  };

  const handleNewList = () => {
    startNewList();
    setScreen('editor');
  };

  const handleEdit = (list: SavedList) => {
    editList(list.id);
    setScreen('editor');
  };

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  const renderListCard = (list: SavedList) => (
    <View key={list.id} style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable style={styles.listCardTop} onPress={() => handleEdit(list)}>
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.listIcon}>
          <FontAwesome6 name="list-check" size={16} color="#FFFFFF" solid />
        </LinearGradient>
        <View style={styles.flex}>
          <Text style={[styles.listName, { color: colors.text }]} numberOfLines={1}>
            {list.name}
          </Text>
          <Text style={[styles.listMeta, { color: colors.textMuted }]}>
            {t('prepareList.itemsCount', { count: list.items.length })} ·{' '}
            {t('prepareList.updatedOn', { date: formatShortDate(list.updatedAt) })}
          </Text>
        </View>
        <Pressable onPress={() => setDeleteTarget(list)} hitSlop={10} style={styles.iconButton}>
          <FontAwesome6 name="trash" size={15} color={colors.error} solid />
        </Pressable>
      </Pressable>

      <View style={[styles.preview, { borderColor: colors.border }]}>
        {list.items.slice(0, PREVIEW_ITEMS).map((item, index) => (
          <View key={item.id} style={styles.previewRow}>
            <Text style={[styles.previewIndex, { color: colors.textMuted }]}>{index + 1}.</Text>
            <Text style={[styles.previewName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.previewQty, { color: colors.textMuted }]}>
              {[item.quantity, item.unit].filter(Boolean).join(' ')}
            </Text>
          </View>
        ))}
        {list.items.length > PREVIEW_ITEMS ? (
          <Text style={[styles.more, { color: colors.primary }]}>
            {t('prepareList.more', { count: list.items.length - PREVIEW_ITEMS })}
          </Text>
        ) : null}
      </View>

      <View style={styles.cardActions}>
        <Pressable style={[styles.outlineButton, { borderColor: colors.primary }]} onPress={() => handleEdit(list)}>
          <FontAwesome6 name="pen" size={12} color={colors.primary} solid />
          <Text style={[styles.outlineButtonText, { color: colors.primary }]}>{t('prepareList.edit')}</Text>
        </Pressable>
        <Pressable style={styles.sendButton} onPress={() => setSendListId(list.id)}>
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sendButtonGradient}>
            <FontAwesome6 name="store" size={12} color="#FFFFFF" solid />
            <Text style={styles.sendButtonText}>{t('prepareList.sendToShop')}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );

  const renderLists = () => (
    <>
      <View style={[styles.listHeaderRow, styles.firstRow]}>
        <Text style={[styles.listHeading, { color: colors.text }]}>
          {t('prepareList.myListsHeading', { count: lists.length })}
        </Text>
        <Pressable onPress={handleNewList} hitSlop={6}>
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.newListPill}>
            <FontAwesome6 name="plus" size={12} color="#FFFFFF" solid />
            <Text style={styles.newListText}>{t('prepareList.newList')}</Text>
          </LinearGradient>
        </Pressable>
      </View>
      {lists.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FontAwesome6 name="list-check" size={28} color={colors.textMuted} solid />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('prepareList.noListsTitle')}</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('prepareList.noListsMessage')}</Text>
        </View>
      ) : (
        lists.map(renderListCard)
      )}
    </>
  );

  const renderEditor = () => (
    <>
      <View style={styles.editorTop}>
        {lists.length > 0 || isEditingSaved ? (
          <Pressable
            style={[styles.backButton, { borderColor: `${colors.primary}40`, backgroundColor: `${colors.primary}10` }]}
            onPress={handleBack}
            hitSlop={8}
            accessibilityLabel={t('prepareList.backToLists')}
          >
            <FontAwesome6 name="chevron-left" size={15} color={colors.primary} solid />
          </Pressable>
        ) : null}
        <Text style={[styles.editorTitle, { color: colors.text }]}>
          {t(isEditingSaved ? 'prepareList.editingTitle' : 'prepareList.newListTitle')}
        </Text>
      </View>
      <TextInput
        style={[styles.nameField, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        value={draft.name}
        onChangeText={setDraftName}
        maxLength={60}
        placeholder={t('prepareList.listNamePlaceholder')}
        placeholderTextColor={colors.textMuted}
      />

      <View style={styles.micSection}>
        <View style={styles.micWrap}>
          {recognizing ? (
            <Animated.View
              style={[
                styles.pulseRing,
                { backgroundColor: colors.error, opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
              ]}
            />
          ) : null}
          <Pressable onPress={handleMicPress} accessibilityLabel={t('prepareList.micLabel')}>
            <LinearGradient
              colors={recognizing ? DELETE_GRADIENT : headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mic}
            >
              <FontAwesome6 name={recognizing ? 'stop' : 'microphone'} size={30} color="#FFFFFF" solid />
            </LinearGradient>
          </Pressable>
        </View>
        <Text style={[styles.micStatus, { color: colors.text }]}>
          {t(recognizing ? 'prepareList.listening' : 'prepareList.tapToSpeak')}
        </Text>
        <Text style={[styles.micHint, { color: colors.textMuted }]} numberOfLines={2}>
          {interimText || t('prepareList.exampleHint')}
        </Text>
      </View>

      <View style={styles.listHeaderRow}>
        <Text style={[styles.listHeading, { color: colors.text }]}>
          {t('prepareList.yourListHeading', { count: items.length })}
        </Text>
        {items.length ? (
          <Pressable onPress={() => setShowClearConfirm(true)} hitSlop={8}>
            <Text style={[styles.clearAllText, { color: colors.error }]}>{t('prepareList.clearAll')}</Text>
          </Pressable>
        ) : null}
      </View>

      {items.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FontAwesome6 name="microphone-lines" size={26} color={colors.textMuted} solid />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('prepareList.emptyMessage')}</Text>
        </View>
      ) : (
        items.map((item, index) => (
          <View key={item.id} style={[styles.itemRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.itemIndex, { color: colors.textMuted }]}>{index + 1}.</Text>
            <View style={styles.itemFields}>
              <TextInput
                style={[styles.nameInput, { color: colors.text }]}
                value={item.name}
                onChangeText={(text) => updateItem(item.id, { name: text })}
                placeholder={t('prepareList.namePlaceholder')}
                placeholderTextColor={colors.textMuted}
                autoFocus={item.id === focusItemId}
              />
              <View style={styles.qtyRow}>
                <TextInput
                  style={[styles.qtyInput, { color: colors.textMuted, borderColor: colors.border }]}
                  value={item.quantity}
                  onChangeText={(text) => updateItem(item.id, { quantity: text })}
                  placeholder={t('prepareList.quantityPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={[styles.unitInput, { color: colors.textMuted, borderColor: colors.border }]}
                  value={item.unit}
                  onChangeText={(text) => updateItem(item.id, { unit: text.toUpperCase() })}
                  placeholder={t('prepareList.unitPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                />
              </View>
            </View>
            <Pressable onPress={() => removeItem(item.id)} hitSlop={8} style={styles.iconButton}>
              <FontAwesome6 name="trash" size={16} color={colors.error} solid />
            </Pressable>
          </View>
        ))
      )}

      <Pressable style={[styles.addRow, { borderColor: colors.border }]} onPress={handleAddBlankItem}>
        <FontAwesome6 name="plus" size={14} color={colors.primary} solid />
        <Text style={[styles.addRowText, { color: colors.primary }]}>{t('prepareList.addItemManually')}</Text>
      </Pressable>
      {items.length ? (
        <Pressable style={styles.saveButton} onPress={handleSave}>
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveButtonGradient}>
            <FontAwesome6 name="check" size={14} color="#FFFFFF" solid />
            <Text style={styles.saveButtonText}>{t('prepareList.saveList')}</Text>
          </LinearGradient>
        </Pressable>
      ) : null}
    </>
  );

  return (
    <ScreenContainer edges={['left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: tabBarClearance }}
      >
        {screen === 'lists' ? renderLists() : renderEditor()}
      </ScrollView>

      <SendListModal visible={sendListId !== null} listId={sendListId} onClose={() => setSendListId(null)} />

      <ConfirmModal
        visible={showClearConfirm}
        icon="trash"
        gradient={DELETE_GRADIENT}
        title={t('prepareList.clearAllConfirmTitle')}
        message={t('prepareList.clearAllConfirmMessage')}
        confirmLabel={t('prepareList.clearAll')}
        onConfirm={() => {
          clearDraftItems();
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
      <ConfirmModal
        visible={showDiscardConfirm}
        icon="rotate-left"
        gradient={DELETE_GRADIENT}
        title={t('prepareList.discardTitle')}
        message={t('prepareList.discardMessage')}
        confirmLabel={t('prepareList.discard')}
        onConfirm={leaveEditor}
        onCancel={() => setShowDiscardConfirm(false)}
      />
      <ConfirmModal
        visible={deleteTarget !== null}
        icon="trash"
        gradient={DELETE_GRADIENT}
        title={t('prepareList.deleteListTitle')}
        message={t('prepareList.deleteListMessage', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('prepareList.deleteList')}
        onConfirm={() => {
          if (deleteTarget) deleteList(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 12 },
  listHeading: { ...typography.subheading, fontFamily: fonts.semiBold },
  clearAllText: { ...typography.caption, fontFamily: fonts.medium },
  newListPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, paddingHorizontal: 14, height: 36 },
  newListText: { ...typography.caption, fontFamily: fonts.semiBold, color: '#FFFFFF', fontSize: 13 },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center', gap: 10, marginBottom: 12 },
  emptyTitle: { ...typography.body, fontFamily: fonts.semiBold },
  emptyText: { ...typography.body, textAlign: 'center' },
  listCard: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 12, gap: 12 },
  listCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  listName: { ...typography.body, fontFamily: fonts.semiBold },
  listMeta: { ...typography.caption, fontSize: 12, marginTop: 1 },
  iconButton: { padding: 6 },
  preview: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  previewIndex: { ...typography.caption, width: 18 },
  previewName: { ...typography.body, fontSize: 14, flex: 1 },
  previewQty: { ...typography.caption, fontSize: 12 },
  more: { ...typography.caption, fontFamily: fonts.semiBold, marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: 10 },
  outlineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    height: 42,
  },
  outlineButtonText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13 },
  sendButton: { flex: 1.4, borderRadius: 12, overflow: 'hidden' },
  sendButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42 },
  sendButtonText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13, color: '#FFFFFF' },
  // The first row sits right under the header with only the screen's own padding, like every other tab.
  firstRow: { marginTop: 0 },
  editorTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  backButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  editorTitle: { ...typography.subheading, fontFamily: fonts.semiBold },
  nameField: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 46, ...typography.body },
  micSection: { alignItems: 'center', paddingVertical: 18 },
  micWrap: { width: MIC_SIZE, height: MIC_SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  pulseRing: { position: 'absolute', width: MIC_SIZE, height: MIC_SIZE, borderRadius: MIC_SIZE / 2 },
  mic: { width: MIC_SIZE, height: MIC_SIZE, borderRadius: MIC_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  micStatus: { ...typography.subheading, fontFamily: fonts.semiBold, marginBottom: 6 },
  micHint: { ...typography.caption, textAlign: 'center', paddingHorizontal: 24 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  itemIndex: { ...typography.body, fontFamily: fonts.semiBold, width: 20 },
  itemFields: { flex: 1, gap: 8 },
  nameInput: { ...typography.body, fontFamily: fonts.medium, padding: 0 },
  qtyRow: { flexDirection: 'row', gap: 8 },
  qtyInput: { ...typography.caption, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flex: 1 },
  unitInput: { ...typography.caption, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, width: 80 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 14,
    marginTop: 4,
  },
  addRowText: { ...typography.body, fontFamily: fonts.semiBold },
  saveButton: { marginTop: 14, borderRadius: 14, overflow: 'hidden' },
  saveButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48 },
  saveButtonText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
});
