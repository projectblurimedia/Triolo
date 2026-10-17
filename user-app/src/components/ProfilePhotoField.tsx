import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { PickedImage } from './ImagePickerField';
import { SmartImage } from './SmartImage';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { showToast } from '@/state/toastStore';

interface ProfilePhotoFieldProps {
  /** The photo to show — a newly picked local one or the saved URL — or null for none. */
  uri: string | null;
  /** Initials are drawn from this when there's no photo. */
  name?: string;
  title: string;
  /** Optional line under the title (registration forms keep tips in their Info card instead). */
  hint?: string;
  onPick: (image: PickedImage) => void;
  onRemove: () => void;
}

const PHOTO_SIZE = 96;

function initialsOf(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.length === 1 ? parts[0][0].toUpperCase() : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * The round profile photo, centred at the top of each registration (worker, shop, job post, customer): tap to pick
 * a square photo from the gallery; Change / Remove beside it. The caller uploads it after saving.
 */
export function ProfilePhotoField({ uri, name, title, hint, onPick, onRemove }: ProfilePhotoFieldProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast({
        variant: 'error',
        title: t('imagePicker.permissionDeniedTitle'),
        message: t('imagePicker.permissionDeniedMessage'),
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    onPick({ uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.mimeType ?? 'image/jpeg' });
  };

  return (
    <View style={styles.section}>
      <Pressable onPress={pick} accessibilityLabel={title}>
        <View style={[styles.ring, { borderColor: `${colors.primary}40` }]}>
          {uri ? (
            <SmartImage source={{ uri }} style={styles.photo} />
          ) : (
            <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.photo}>
              <Text style={styles.initials}>{initialsOf(name)}</Text>
            </LinearGradient>
          )}
        </View>
        <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
          <FontAwesome6 name="camera" size={12} color="#FFFFFF" solid />
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {hint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
        <View style={styles.buttons}>
          <Pressable onPress={pick} hitSlop={6}>
            <Text style={[styles.link, { color: colors.primary }]}>{t(uri ? 'profilePhoto.change' : 'profilePhoto.add')}</Text>
          </Pressable>
          {uri ? (
            <Pressable onPress={onRemove} hitSlop={6}>
              <Text style={[styles.link, { color: colors.error }]}>{t('profilePhoto.remove')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { alignItems: 'center', marginBottom: 24 },
  ring: { width: PHOTO_SIZE + 8, height: PHOTO_SIZE + 8, borderRadius: (PHOTO_SIZE + 8) / 2, borderWidth: 2, padding: 2 },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: PHOTO_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 30, lineHeight: 38 },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { alignItems: 'center', marginTop: 12 },
  title: { ...typography.body, fontFamily: fonts.semiBold, textAlign: 'center' },
  hint: { ...typography.caption, fontSize: 12, marginTop: 2, lineHeight: 17, textAlign: 'center', paddingHorizontal: 24 },
  buttons: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 8 },
  link: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 13 },
});
