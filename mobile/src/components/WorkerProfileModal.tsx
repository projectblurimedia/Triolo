import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextField } from './TextField';
import { LocationPicker, LocationValue } from './LocationPicker';
import { ImagePickerField, PickedImage } from './ImagePickerField';
import { Button } from './Button';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { useCreateWorkerProfile } from '@/hooks/useWorkerMutations';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';

const SKILL_CATEGORIES = [
  { key: 'electrician', icon: 'bolt' as const },
  { key: 'plumber', icon: 'faucet' as const },
  { key: 'painter', icon: 'paint-roller' as const },
  { key: 'carpenter', icon: 'hammer' as const },
  { key: 'mechanic', icon: 'wrench' as const },
  { key: 'cleaner', icon: 'broom' as const },
  { key: 'mason', icon: 'trowel' as const },
  { key: 'other', icon: 'ellipsis' as const },
];

interface WorkerProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Opened from Home's menu ("Become a Worker") — adds the Worker capability to the current User account. */
export function WorkerProfileModal({ visible, onClose }: WorkerProfileModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const createProfile = useCreateWorkerProfile();

  const [skillCategories, setSkillCategories] = useState<string[]>([]);
  const [otherSkillEntries, setOtherSkillEntries] = useState<string[]>([]);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherInputValue, setOtherInputValue] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [location, setLocation] = useState<LocationValue>({ latitude: null, longitude: null, address: '' });
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggleSkill = (key: string) => {
    if (key === 'other') {
      setShowOtherInput(true);
      return;
    }
    setSkillCategories((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const commitOtherEntry = () => {
    const trimmed = otherInputValue.trim();
    if (trimmed && !otherSkillEntries.includes(trimmed)) {
      setOtherSkillEntries((prev) => [...prev, trimmed]);
    }
    setOtherInputValue('');
    setShowOtherInput(false);
  };

  const removeOtherEntry = (index: number) => {
    setOtherSkillEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const resetAndClose = () => {
    setSkillCategories([]);
    setOtherSkillEntries([]);
    setShowOtherInput(false);
    setOtherInputValue('');
    setExperienceYears('');
    setLocation({ latitude: null, longitude: null, address: '' });
    setPhotos([]);
    setError(null);
    onClose();
  };

  const handleSubmit = () => {
    setError(null);
    const includesOther = otherSkillEntries.length > 0;
    if (
      (skillCategories.length === 0 && !includesOther) ||
      !experienceYears.trim() ||
      !location.address.trim()
    ) {
      setError(t('errors.VALIDATION_ERROR'));
      return;
    }

    createProfile.mutate(
      {
        skillCategories: includesOther ? [...skillCategories, 'other'] : skillCategories,
        otherSkillDescription: includesOther ? otherSkillEntries.join(', ') : undefined,
        experienceYears: Number(experienceYears),
        latitude: location.latitude,
        longitude: location.longitude,
        locationAddress: location.address,
        portfolioPhotos: photos,
      },
      {
        onSuccess: () => {
          resetAndClose();
          Alert.alert(t('workerProfile.successTitle'), t('workerProfile.successMessage'));
        },
        onError: (err) => setError(getLocalizedErrorMessage(err, t)),
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 14 }]}
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel={t('common.cancel')} hitSlop={8}>
              <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
            </Pressable>
            <View style={styles.titleGroup}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {t('workerProfile.title')}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {t('workerProfile.subtitle')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: colors.textMuted }]}>{t('workerProfile.skillLabel')}</Text>
          <View style={styles.chipRow}>
            {SKILL_CATEGORIES.map((skill) => {
              const isActive =
                skill.key === 'other' ? otherSkillEntries.length > 0 : skillCategories.includes(skill.key);
              return (
                <Pressable key={skill.key} onPress={() => toggleSkill(skill.key)}>
                  {isActive ? (
                    <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
                      <FontAwesome6 name={skill.icon} size={12} color="#FFFFFF" solid />
                      <Text style={[styles.chipLabel, { color: '#FFFFFF' }]}>{t(`workerProfile.skills.${skill.key}`)}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.chip, styles.chipInactive, { borderColor: colors.border }]}>
                      <FontAwesome6 name={skill.icon} size={12} color={colors.textMuted} solid />
                      <Text style={[styles.chipLabel, { color: colors.text }]}>{t(`workerProfile.skills.${skill.key}`)}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
            {otherSkillEntries.map((entry, index) => (
              <Pressable key={`other-${entry}-${index}`} onPress={() => removeOtherEntry(index)}>
                <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
                  <Text style={[styles.chipLabel, { color: '#FFFFFF' }]} numberOfLines={1}>
                    {entry}
                  </Text>
                  <FontAwesome6 name="xmark" size={10} color="#FFFFFF" solid />
                </LinearGradient>
              </Pressable>
            ))}
          </View>

          {showOtherInput ? (
            <View style={styles.otherInputRow}>
              <View style={styles.otherInputField}>
                <TextField
                  label={t('workerProfile.otherSkillLabel')}
                  value={otherInputValue}
                  onChangeText={setOtherInputValue}
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={commitOtherEntry}
                  autoFocus
                />
              </View>
              <Pressable
                style={[styles.otherDoneButton, { opacity: otherInputValue.trim() ? 1 : 0.5 }]}
                onPress={commitOtherEntry}
                disabled={!otherInputValue.trim()}
                accessibilityLabel={t('common.done')}
              >
                <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.otherDoneGradient}>
                  <FontAwesome6 name="check" size={16} color="#FFFFFF" solid />
                </LinearGradient>
              </Pressable>
            </View>
          ) : null}

          <TextField
            label={t('workerProfile.experienceLabel')}
            value={experienceYears}
            onChangeText={setExperienceYears}
            keyboardType="number-pad"
            maxLength={2}
          />

          <LocationPicker value={location} onChange={setLocation} />

          <ImagePickerField label={t('workerProfile.portfolioLabel')} images={photos} onChange={setPhotos} />

          {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

          <Button label={t('common.submit')} onPress={handleSubmit} loading={createProfile.isPending} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  titleGroup: { marginLeft: 14, flex: 1 },
  headerTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', lineHeight: 20 },
  headerSubtitle: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)', lineHeight: 14, marginTop: 2 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: { padding: 20, paddingBottom: 40 },
  label: { ...typography.caption, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipInactive: { borderWidth: 1 },
  chipLabel: { ...typography.caption, fontFamily: fonts.medium },
  otherInputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  otherInputField: { flex: 1 },
  otherDoneButton: { marginTop: 22 },
  otherDoneGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { ...typography.caption, marginBottom: 12 },
});
