import React, { useEffect, useRef, useState } from 'react';
import { useListReturnStore } from '@/state/listReturnStore';
import { Animated, Easing, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { ToastHost } from '@/components/ToastHost';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { isListNameTaken, listFallbackName, MAX_LIST_PHOTOS, PrepareListPhoto, SavedList, useListStore } from '@/state/listStore';
import { ImagePickerField, PickedImage } from '@/components/ImagePickerField';
import { SmartImage } from '@/components/SmartImage';
import { keepListPhoto, pruneListPhotos } from '@/utils/listPhotos';
import { formatVoiceLength, pruneListVoices } from '@/utils/listVoice';
import { VoiceRecorderCard } from '@/components/VoiceRecorderCard';
import { showToast } from '@/state/toastStore';
import { parseVoiceListText } from '@/utils/parseVoiceList';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '@/navigation/types';
import { FullText } from '@/components/FullText';

const MIC_SIZE = 84;
const DELETE_GRADIENT = ['#ef4444', '#dc2626'] as const;
// The four ways to make a list, each its own colour.
const SPEAK_GRADIENT = ['#0055D3', '#1D76FA'] as const;
const TYPE_GRADIENT = ['#0F9D58', '#34C77B'] as const;
// The same colours as Home's Hire Staff quick action.
const PHOTO_GRADIENT = ['#4338CA', '#7C3AED', '#C026D3'] as const;
const RECORD_GRADIENT = ['#DB2777', '#F472B6'] as const;
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
  const setDraftPhotos = useListStore((state) => state.setDraftPhotos);
  const setDraftVoice = useListStore((state) => state.setDraftVoice);

  // My Lists is always the tab; New List / Edit open the editor in its own full screen. An
  // unfinished draft (from before the app was closed) reopens it.
  const [screen, setScreen] = useState<'lists' | 'editor'>(() => {
    const state = useListStore.getState();
    return state.draft.items.length > 0 || (state.draft.photos ?? []).length > 0 || !!state.draft.voice || state.draft.listId ? 'editor' : 'lists';
  });
  const [recognizing, setRecognizing] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SavedList | null>(null);
  const [sendListId, setSendListId] = useState<string | null>(null);
  const [focusItemId, setFocusItemId] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;
  // Keeps the row being typed in on screen: the keyboard covers the bottom of this edge-to-edge
  // screen, so the list gets the keyboard's height as extra bottom room and scrolls the active
  // row up into view (a newly added row as soon as it appears).
  const scrollRef = useRef<ScrollView>(null);
  const rowYs = useRef<Record<string, number>>({});
  const activeRowId = useRef<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const scrollToRow = (id: string) => {
    const y = rowYs.current[id];
    if (y === undefined) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
  };

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      const id = activeRowId.current;
      if (id) setTimeout(() => scrollToRow(id), 60);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Opened with `newList` (e.g. from Send List when there are no lists): start a fresh list.
  const route = useRoute<RouteProp<MainTabParamList, 'PrepareList'>>();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const newListRequest = route.params?.newList;
  useEffect(() => {
    if (!newListRequest) return;
    startNewList();
    setScreen('editor');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newListRequest]);

  const items = draft.items;
  const isEditingSaved = draft.listId !== null;
  // List names are unique: warn while typing, before Save is even tapped.
  const nameTaken = isListNameTaken(lists, draft.name, draft.listId);

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

  const photos = draft.photos ?? [];
  const voice = draft.voice ?? null;
  const [showPhotos, setShowPhotos] = useState(false);
  const [recordSignal, setRecordSignal] = useState(0);
  const [recordingVoice, setRecordingVoice] = useState(false);
  // A list is made one way: once it has items (spoken or typed), photos, or a voice message,
  // only that way's options stay on screen. Emptied again, all four come back.
  const listMode: 'items' | 'photo' | 'voice' | null =
    items.length > 0 ? 'items' : photos.length > 0 || showPhotos ? 'photo' : voice || recordingVoice ? 'voice' : null;

  /** One of the four ways to make a list: a colourful card, all the same size, with a big faded icon. */
  const renderWay = (
    key: string,
    gradient: readonly [string, string, ...string[]],
    icon: string,
    title: string,
    subtitle: string,
    onPress: () => void,
    active = false,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.wayWrap, { opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.way, active && styles.wayActive]}>
        <View style={styles.wayBubble} />
        <FontAwesome6 name={icon} size={78} color="rgba(255,255,255,0.16)" solid style={styles.wayBigIcon} />
        <View style={styles.wayIcon}>
          <FontAwesome6 name={icon} size={19} color="#FFFFFF" solid />
        </View>
        <FullText style={styles.wayTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {title}
        </FullText>
        <FullText style={styles.waySub} numberOfLines={2}>
          {subtitle}
        </FullText>
      </LinearGradient>
    </Pressable>
  );
  const handlePhotosChange = (images: PickedImage[]) => {
    const next: PrepareListPhoto[] = images.map((image) => {
      const kept = photos.find((photo) => photo.uri === image.uri);
      if (kept) return kept;
      return {
        id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        uri: keepListPhoto(image.uri, image.name),
        name: image.name,
        type: image.type,
      };
    });
    setDraftPhotos(next);
  };

  const handleAddBlankItem = () => {
    addItems([{ name: '', quantity: '1', unit: '' }]);
    const added = useListStore.getState().draft.items;
    const id = added[added.length - 1]?.id ?? null;
    activeRowId.current = id;
    setFocusItemId(id);
  };

  const handleSave = () => {
    stopListening();
    const prefix = t(listMode === 'voice' ? 'prepareList.defaultVoiceName' : listMode === 'photo' ? 'prepareList.defaultPhotoName' : 'prepareList.defaultListName');
    const result = saveDraft(listFallbackName(prefix));
    if (result.status === 'empty' && draft.listId) {
      // Everything was taken out of a saved list: the list goes.
      removeEmptiedList(draft.listId);
      return;
    }
    if (result.status === 'empty') {
      showToast({ variant: 'info', title: t('prepareList.emptyDraftTitle'), message: t('prepareList.emptyDraftMessage') });
      return;
    }
    if (result.status === 'duplicate') {
      showToast({ variant: 'error', title: t('prepareList.duplicateNameTitle'), message: t('prepareList.duplicateNameMessage') });
      return;
    }
    showToast({ variant: 'success', title: t('prepareList.savedTitle') });
    pruneListPhotos();
    pruneListVoices();
    setScreen('lists');
    // Made from Quick Order: straight back there with this list chosen.
    const origin = useListReturnStore.getState().done(result.id);
    if (origin) navigation.navigate(origin);
  };

  useEffect(() => {
    if (screen !== 'editor') {
      setShowPhotos(false);
      setRecordingVoice(false);
    }
  }, [screen]);

  /** A saved list whose last item / photo / voice message was removed is deleted. */
  const removeEmptiedList = (listId: string) => {
    stopListening();
    discardDraft();
    deleteList(listId);
    pruneListPhotos();
    pruneListVoices();
    setShowDiscardConfirm(false);
    setScreen('lists');
    showToast({ variant: 'info', title: t('prepareList.emptiedTitle'), message: t('prepareList.emptiedMessage') });
  };

  const leaveEditor = () => {
    useListReturnStore.getState().cancel();
    stopListening();
    discardDraft();
    pruneListPhotos();
    pruneListVoices();
    setShowDiscardConfirm(false);
    setScreen('lists');
  };

  const handleBack = () => {
    if (items.some((item) => item.name.trim()) || photos.length > 0 || voice) setShowDiscardConfirm(true);
    else if (draft.listId) removeEmptiedList(draft.listId);
    else leaveEditor();
  };

  const handleNewList = () => {
    useListReturnStore.getState().cancel();
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
          <FullText style={[styles.listName, { color: colors.text }]} numberOfLines={1}>
            {list.name}
          </FullText>
          <Text style={[styles.listMeta, { color: colors.textMuted }]}>
            {[
              list.items.length || (!(list.photos ?? []).length && !list.voice) ? t('prepareList.itemsCount', { count: list.items.length }) : '',
              (list.photos ?? []).length ? t('prepareList.photosCount', { count: list.photos.length }) : '',
              list.voice ? t('voice.countLine', { length: formatVoiceLength(list.voice.seconds) }) : '',
            ]
              .filter(Boolean)
              .join(' · ')}{' '}
            ·{' '}
            {t('prepareList.updatedOn', { date: formatShortDate(list.updatedAt) })}
          </Text>
        </View>
        <Pressable onPress={() => setDeleteTarget(list)} hitSlop={10} style={styles.iconButton}>
          <FontAwesome6 name="trash" size={15} color={colors.error} solid />
        </Pressable>
      </Pressable>

      {/* The items as small cards, one sideways row (names only). */}
      <ScrollView
        horizontal
        style={styles.previewScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.previewRow}
      >
        {list.voice ? (
          <View style={[styles.previewItem, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}33` }]}>
            <FontAwesome6 name="microphone" size={10} color={colors.primary} solid />
            <FullText style={[styles.previewName, { color: colors.text }]} numberOfLines={1}>
              {formatVoiceLength(list.voice.seconds)}
            </FullText>
          </View>
        ) : null}
        {(list.photos ?? []).map((photo) => (
          <SmartImage key={photo.id} source={{ uri: photo.uri }} style={[styles.previewPhoto, { borderColor: `${colors.primary}1F` }]} />
        ))}
        {list.items.map((item) => (
          <View key={item.id} style={[styles.previewItem, { backgroundColor: colors.background, borderColor: `${colors.primary}1F` }]}>
            <FontAwesome6 name="basket-shopping" size={10} color={colors.primary} solid />
            <FullText style={[styles.previewName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </FullText>
          </View>
        ))}
      </ScrollView>

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
      <View style={styles.fieldLabelRow}>
        <View style={[styles.fieldLabelIcon, { backgroundColor: `${colors.primary}14` }]}>
          <FontAwesome6 name="tag" size={11} color={colors.primary} solid />
        </View>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>{t('prepareList.listNameLabel')}</Text>
      </View>
      <TextInput
        style={[
          styles.nameField,
          { color: colors.text, borderColor: nameTaken ? colors.error : `${colors.primary}26`, backgroundColor: colors.surface },
        ]}
        value={draft.name}
        onChangeText={setDraftName}
        maxLength={60}
        placeholder={t('prepareList.listNamePlaceholder')}
        placeholderTextColor={colors.textMuted}
      />
      {nameTaken ? (
        <View style={styles.nameError}>
          <FontAwesome6 name="circle-exclamation" size={12} color={colors.error} solid />
          <Text style={[styles.nameErrorText, { color: colors.error }]}>{t('prepareList.duplicateNameMessage')}</Text>
        </View>
      ) : null}

      {listMode === null || listMode === 'items' ? (
        <Text style={[styles.waysTitle, { color: colors.text }]}>{t(listMode ? 'prepareList.waysMore' : 'prepareList.waysTitle')}</Text>
      ) : null}
      <View style={styles.waysGrid}>
        {(listMode === null || listMode === 'items') && renderWay(
          'speak',
          recognizing ? DELETE_GRADIENT : SPEAK_GRADIENT,
          recognizing ? 'stop' : 'microphone-lines',
          t(recognizing ? 'prepareList.ways.speakActive' : 'prepareList.ways.speak'),
          t(recognizing ? 'prepareList.ways.speakActiveSub' : 'prepareList.ways.speakSub'),
          handleMicPress,
          recognizing,
        )}
        {(listMode === null || listMode === 'items') &&
          renderWay('type', TYPE_GRADIENT, 'keyboard', t('prepareList.ways.type'), t('prepareList.ways.typeSub'), handleAddBlankItem)}
        {listMode === null && renderWay(
          'photo',
          PHOTO_GRADIENT,
          'camera',
          t('prepareList.ways.photo'),
          photos.length ? t('prepareList.photosCount', { count: photos.length }) : t('prepareList.ways.photoSub'),
          () => setShowPhotos(true),
        )}
        {listMode === null && renderWay(
          'record',
          RECORD_GRADIENT,
          'microphone',
          t('prepareList.ways.record'),
          voice ? t('voice.countLine', { length: formatVoiceLength(voice.seconds) }) : t('prepareList.ways.recordSub'),
          () => setRecordSignal((value) => value + 1),
        )}
      </View>

      {/* Speak & prepare: what's being heard, turned into items as you talk. */}
      {recognizing ? (
        <View style={[styles.listening, { backgroundColor: `${colors.error}0D`, borderColor: `${colors.error}40` }]}>
          <View style={styles.listeningDotWrap}>
            <Animated.View
              style={[styles.listeningRing, { backgroundColor: colors.error, opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]}
            />
            <View style={[styles.listeningDot, { backgroundColor: colors.error }]} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.listeningTitle, { color: colors.text }]}>{t('prepareList.listening')}</Text>
            <FullText style={[styles.listeningText, { color: colors.textMuted }]} numberOfLines={3}>
              {interimText || t('prepareList.exampleHint')}
            </FullText>
          </View>
        </View>
      ) : null}

      {/* Photos of a written list: they go to the shop instead of (or with) typed items. */}
      {showPhotos || photos.length ? (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: `${colors.primary}26` }]}>
          <View style={styles.sectionHead}>
            <FontAwesome6 name="camera" size={13} color={PHOTO_GRADIENT[0]} solid />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('prepareList.photoTitle')}</Text>
          </View>
          <ImagePickerField
            label=""
            images={photos.map((photo) => ({ uri: photo.uri, name: photo.name, type: photo.type }))}
            onChange={handlePhotosChange}
            maxImages={MAX_LIST_PHOTOS}
            allowCamera
          />
        </View>
      ) : null}
      {/* Opened Photo but changed their mind: back to the four ways. */}
      {listMode === 'photo' && photos.length === 0 ? (
        <Pressable onPress={() => setShowPhotos(false)} style={styles.otherWay} hitSlop={6}>
          <FontAwesome6 name="arrow-left" size={11} color={colors.primary} solid />
          <Text style={[styles.otherWayText, { color: colors.primary }]}>{t('prepareList.otherWay')}</Text>
        </Pressable>
      ) : null}

      {/* Record: the shop hears the list in the customer's own words. */}
      <VoiceRecorderCard voice={voice} onChange={setDraftVoice} onBeforeRecord={stopListening} startSignal={recordSignal} compact onRecordingChange={setRecordingVoice} />

      {items.length ? (
        <View style={styles.listHeaderRow}>
          <Text style={[styles.listHeading, { color: colors.text }]}>
            {t('prepareList.yourListHeading', { count: items.length })}
          </Text>
          <Pressable onPress={() => setShowClearConfirm(true)} hitSlop={8}>
            <Text style={[styles.clearAllText, { color: colors.error }]}>{t('prepareList.clearAll')}</Text>
          </Pressable>
        </View>
      ) : null}

      {items.map((item, index) => (
          <View
            key={item.id}
            style={[styles.itemRow, { backgroundColor: colors.surface, borderColor: `${colors.primary}26` }]}
            onLayout={(event) => {
              const firstLayout = rowYs.current[item.id] === undefined;
              rowYs.current[item.id] = event.nativeEvent.layout.y;
              // A row just added with "Add Item" scrolls into view as soon as it exists.
              if (firstLayout && item.id === focusItemId) setTimeout(() => scrollToRow(item.id), 80);
            }}
          >
            <View style={[styles.itemBadge, { backgroundColor: `${colors.primary}14` }]}>
              <Text style={[styles.itemBadgeText, { color: colors.primary }]}>{index + 1}</Text>
            </View>
            <TextInput
              style={[styles.nameInput, { color: colors.text }]}
              value={item.name}
              onChangeText={(text) => updateItem(item.id, { name: text })}
              placeholder={t('prepareList.namePlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoFocus={item.id === focusItemId}
              onFocus={() => {
                activeRowId.current = item.id;
                scrollToRow(item.id);
              }}
            />
            {/* Quantity and unit together in one small pill. */}
            <View style={[styles.qtyPill, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput
                style={[styles.qtyInput, { color: colors.text }]}
                value={item.quantity}
                onChangeText={(text) => updateItem(item.id, { quantity: text })}
                onFocus={() => {
                  activeRowId.current = item.id;
                  scrollToRow(item.id);
                }}
                placeholder={t('prepareList.quantityPlaceholder')}
                placeholderTextColor={colors.textMuted}
                textAlign="center"
              />
              <View style={[styles.qtyDivider, { backgroundColor: colors.border }]} />
              <TextInput
                style={[styles.unitInput, { color: colors.primary }]}
                value={item.unit}
                onChangeText={(text) => updateItem(item.id, { unit: text.toUpperCase() })}
                onFocus={() => {
                  activeRowId.current = item.id;
                  scrollToRow(item.id);
                }}
                placeholder={t('prepareList.unitPlaceholder')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                textAlign="center"
              />
            </View>
            <Pressable
              onPress={() => removeItem(item.id)}
              hitSlop={8}
              style={[styles.removeButton, { backgroundColor: `${colors.error}12` }]}
              accessibilityLabel={t('common.delete')}
            >
              <FontAwesome6 name="xmark" size={13} color={colors.error} solid />
            </Pressable>
          </View>
        ))}

      {items.length ? (
        <Pressable onPress={handleAddBlankItem} style={[styles.addMore, { borderColor: `${colors.primary}55` }]} hitSlop={4}>
          <FontAwesome6 name="plus" size={12} color={colors.primary} solid />
          <Text style={[styles.addMoreText, { color: colors.primary }]}>{t('prepareList.addAnother')}</Text>
        </Pressable>
      ) : null}
      {items.length || photos.length || voice ? (
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
        {renderLists()}
      </ScrollView>

      {/* The list editor: its own full-screen window over the tab. */}
      <Modal visible={screen === 'editor'} animationType="fade" statusBarTranslucent onRequestClose={handleBack}>
        <View style={[styles.flex, { backgroundColor: colors.background }]}>
          <LinearGradient
            colors={headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.editorHeader, { paddingTop: insets.top + 14 }]}
          >
            <Pressable
              style={styles.editorBack}
              onPress={handleBack}
              hitSlop={8}
              accessibilityLabel={t('prepareList.backToLists')}
            >
              <FontAwesome6 name="chevron-left" size={17} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.editorHeaderTitle}>
                {t(isEditingSaved ? 'prepareList.editingTitle' : 'prepareList.newListTitle')}
              </Text>
              <FullText style={styles.editorHeaderSubtitle} numberOfLines={1}>
                {t('prepareList.editorSubtitle')}
              </FullText>
            </View>
          </LinearGradient>
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.editorBody, { paddingBottom: insets.bottom + 32 + keyboardHeight }]}
          >
            {renderEditor()}
          </ScrollView>
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
          <ToastHost />
        </View>
      </Modal>

      <SendListModal visible={sendListId !== null} listId={sendListId} onClose={() => setSendListId(null)} />

      <ConfirmModal
        visible={deleteTarget !== null}
        icon="trash"
        gradient={DELETE_GRADIENT}
        title={t('prepareList.deleteListTitle')}
        message={t('prepareList.deleteListMessage', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('prepareList.deleteList')}
        onConfirm={() => {
          if (deleteTarget) {
            deleteList(deleteTarget.id);
            pruneListPhotos();
            pruneListVoices();
          }
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
  previewScroll: { flexGrow: 0 },
  previewPhoto: { width: 34, height: 34, borderRadius: 10, borderWidth: 1 },
  photoCard: { borderRadius: 16, borderWidth: 1, padding: 12, paddingBottom: 0, marginTop: 12, gap: 10 },
  photoHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewRow: { gap: 8, paddingRight: 4 },
  previewItem: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, borderRadius: 12, borderWidth: 1, paddingHorizontal: 11, maxWidth: 170 },
  previewName: { ...typography.caption, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, flexShrink: 1 },
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
  editorHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 16 },
  editorBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorHeaderTitle: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 18 },
  editorHeaderSubtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  editorBody: { padding: 16 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  fieldLabelIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13 },
  backButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  editorTitle: { ...typography.subheading, fontFamily: fonts.semiBold },
  nameField: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 46, ...typography.body, includeFontPadding: false },
  waysTitle: { ...typography.body, fontFamily: fonts.semiBold, marginTop: 18, marginBottom: 10 },
  waysGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  wayWrap: { width: '48.5%' },
  // One fixed size for every card, whatever its text.
  way: { borderRadius: 20, padding: 14, height: 136, overflow: 'hidden', justifyContent: 'flex-end' },
  wayBigIcon: { position: 'absolute', right: -10, bottom: -12, transform: [{ rotate: '-12deg' }] },
  otherWay: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6, paddingVertical: 10 },
  otherWayText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13 },
  wayActive: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  wayBubble: { position: 'absolute', right: -26, top: -26, width: 86, height: 86, borderRadius: 43, backgroundColor: 'rgba(255,255,255,0.14)' },
  wayIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 14,
    left: 14,
  },
  wayTitle: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF', fontSize: 15 },
  waySub: { ...typography.caption, color: 'rgba(255,255,255,0.88)', fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  listening: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 12, marginTop: 12 },
  listeningDotWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  listeningRing: { position: 'absolute', width: 24, height: 24, borderRadius: 12 },
  listeningDot: { width: 12, height: 12, borderRadius: 6 },
  listeningTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  listeningText: { ...typography.caption, fontSize: 12.5, lineHeight: 17 },
  section: { borderRadius: 16, borderWidth: 1, padding: 12, paddingBottom: 0, marginTop: 12, gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  addMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', marginTop: 4 },
  addMoreText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  micSection: { alignItems: 'center', paddingVertical: 18 },
  micWrap: { width: MIC_SIZE, height: MIC_SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  pulseRing: { position: 'absolute', width: MIC_SIZE, height: MIC_SIZE, borderRadius: MIC_SIZE / 2 },
  mic: { width: MIC_SIZE, height: MIC_SIZE, borderRadius: MIC_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  micStatus: { ...typography.subheading, fontFamily: fonts.semiBold, marginBottom: 6 },
  micHint: { ...typography.caption, textAlign: 'center', paddingHorizontal: 24 },
  nameError: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 2 },
  nameErrorText: { ...typography.caption, fontSize: 12, flex: 1 },
  // One clean line per item: number, name, a quantity · unit pill, remove.
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 5,
    paddingLeft: 10,
    paddingRight: 8,
    marginBottom: 8,
    gap: 8,
  },
  itemBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  itemBadgeText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 16 },
  nameInput: { ...typography.body, fontFamily: fonts.medium, padding: 0, flex: 1, minWidth: 0, height: 36 },
  qtyPill: { flexDirection: 'row', alignItems: 'center', height: 34, borderRadius: 17, borderWidth: 1, overflow: 'hidden' },
  qtyInput: { ...typography.caption, fontFamily: fonts.semiBold, width: 44, padding: 0, height: 34 },
  qtyDivider: { width: 1, height: 18 },
  unitInput: { ...typography.caption, fontFamily: fonts.semiBold, width: 50, padding: 0, height: 34 },
  removeButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 12,
    marginTop: 4,
  },
  addIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  addRowText: { ...typography.body, fontFamily: fonts.semiBold },
  addRowHint: { ...typography.caption, fontSize: 12, marginTop: 1 },
  addPlus: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  saveButton: { marginTop: 14, borderRadius: 14, overflow: 'hidden' },
  saveButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48 },
  saveButtonText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
});
