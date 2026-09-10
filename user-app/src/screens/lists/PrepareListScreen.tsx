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
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useListStore } from '@/state/listStore';
import { showToast } from '@/state/toastStore';
import { parseVoiceListText } from '@/utils/parseVoiceList';

const MIC_SIZE = 84;
const DELETE_GRADIENT = ['#ef4444', '#dc2626'] as const;

/**
 * Voice-to-list "Prepare List" tab — tap the mic, say items and quantities in one go
 * ("senagapappu kg minapappu 3/2kg"), and each "<item> <quantity>? <unit>" run gets its
 * own row (see utils/parseVoiceList.ts for the exact parsing rules and why quantities are
 * kept verbatim rather than mathematically reinterpreted). Every row stays freely editable/
 * deletable afterward — voice is just a fast way to draft the list, not the only way to
 * change it. Items live only in AsyncStorage on this device (state/listStore.ts) —
 * deliberately never sent to the backend; there is no server-side "list" concept and none
 * is planned, this is a personal scratch pad for getting ready before booking/shopping.
 */
export function PrepareListScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const items = useListStore((state) => state.items);
  const addItems = useListStore((state) => state.addItems);
  const updateItem = useListStore((state) => state.updateItem);
  const removeItem = useListStore((state) => state.removeItem);
  const clearAll = useListStore((state) => state.clearAll);

  const [recognizing, setRecognizing] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

  // Same floating-tab-bar clearance fix as ProfileScreen's own ScrollView — CustomTabBar is
  // position:'absolute' and contributes ~0 height to layout, so scroll content needs enough
  // bottom padding to clear it manually. See that screen's own comment for the exact numbers.
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
      // Always te-IN, regardless of the app's own display-language setting — grocery item
      // names here are predominantly Telugu words with English units/numbers mixed in
      // (this app's whole MVP audience, per .cloud/project-context.md), and Google's
      // regional-locale recognizers are specifically trained on exactly that kind of
      // code-switched speech; en-IN was tried first and recognized common English loanwords
      // fine but mangled Telugu quantity words like "nnara" ("one and a half") into
      // unrecognizable fragments far more often.
      lang: 'te-IN',
      interimResults: true,
      continuous: true,
    });
  };

  const handleAddBlankItem = () => {
    addItems([{ name: t('prepareList.newItemName'), quantity: '1', unit: '' }]);
  };

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <ScreenContainer edges={['left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tabBarClearance }}>
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
          <Text style={[styles.listHeading, { color: colors.text }]}>{t('prepareList.yourListHeading', { count: items.length })}</Text>
          {items.length ? (
            <Pressable onPress={() => setShowClearConfirm(true)} hitSlop={8}>
              <Text style={[styles.clearAllText, { color: colors.error }]}>{t('prepareList.clearAll')}</Text>
            </Pressable>
          ) : null}
        </View>

        {items.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FontAwesome6 name="list-check" size={28} color={colors.textMuted} solid />
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
              <Pressable onPress={() => removeItem(item.id)} hitSlop={8} style={styles.deleteButton}>
                <FontAwesome6 name="trash" size={16} color={colors.error} solid />
              </Pressable>
            </View>
          ))
        )}

        <Pressable style={[styles.addRow, { borderColor: colors.border }]} onPress={handleAddBlankItem}>
          <FontAwesome6 name="plus" size={14} color={colors.primary} solid />
          <Text style={[styles.addRowText, { color: colors.primary }]}>{t('prepareList.addItemManually')}</Text>
        </Pressable>
      </ScrollView>

      <ConfirmModal
        visible={showClearConfirm}
        icon="trash"
        gradient={DELETE_GRADIENT}
        title={t('prepareList.clearAllConfirmTitle')}
        message={t('prepareList.clearAllConfirmMessage')}
        confirmLabel={t('prepareList.clearAll')}
        onConfirm={() => {
          clearAll();
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  micSection: { alignItems: 'center', paddingVertical: 20 },
  micWrap: { width: MIC_SIZE, height: MIC_SIZE, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  pulseRing: { position: 'absolute', width: MIC_SIZE, height: MIC_SIZE, borderRadius: MIC_SIZE / 2 },
  mic: { width: MIC_SIZE, height: MIC_SIZE, borderRadius: MIC_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  micStatus: { ...typography.subheading, fontFamily: fonts.semiBold, marginBottom: 6 },
  micHint: { ...typography.caption, textAlign: 'center', paddingHorizontal: 24 },
  listHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 12 },
  listHeading: { ...typography.subheading, fontFamily: fonts.semiBold },
  clearAllText: { ...typography.caption, fontFamily: fonts.medium },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center', gap: 10 },
  emptyText: { ...typography.body, textAlign: 'center' },
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
  deleteButton: { padding: 6 },
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
});
