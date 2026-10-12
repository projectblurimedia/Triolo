import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { typography, useThemeColors } from '@/theme';
import { showToast } from '@/state/toastStore';

export interface PickedImage {
  uri: string;
  name: string;
  type: string;
}

interface ImagePickerFieldProps {
  label: string;
  images: PickedImage[];
  onChange: (images: PickedImage[]) => void;
  maxImages?: number;
  /** Shows separate Camera/Gallery tiles instead of the single gallery-only "+" tile. */
  allowCamera?: boolean;
}

const THUMB_SIZE = 72;

// Android gallery picks are often content:// URIs with no real file extension —
// asset.uri.split('.').pop() on those returns garbage (the whole URI), which would corrupt
// the multipart file's type/name. Trust asset.mimeType first; fall back to a safe,
// always-valid default rather than guessing from the URI.
function toPickedImages(assets: ImagePicker.ImagePickerAsset[]): PickedImage[] {
  return assets.map((asset, index) => {
    const type = asset.mimeType ?? 'image/jpeg';
    const extension = type.split('/').pop() ?? 'jpg';
    return {
      uri: asset.uri,
      name: asset.fileName ?? `photo_${Date.now()}_${index}.${extension}`,
      type,
    };
  });
}

/** Multi-image picker (gallery, plus camera when `allowCamera`) — images upload as multipart FormData on submit, not at pick time. */
export function ImagePickerField({ label, images, onChange, maxImages = 6, allowCamera = false }: ImagePickerFieldProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();

  const handlePick = async () => {
    const remaining = maxImages - images.length;
    if (remaining <= 0) return;

    try {
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
        allowsMultipleSelection: true,
        selectionLimit: remaining,
      });

      if (!result.canceled) {
        onChange([...images, ...toPickedImages(result.assets)].slice(0, maxImages));
      }
    } catch {
      showToast({ variant: 'error', title: t('imagePicker.pickFailedTitle'), message: t('imagePicker.pickFailedMessage') });
    }
  };

  const handleCamera = async () => {
    if (images.length >= maxImages) return;

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showToast({
          variant: 'error',
          title: t('imagePicker.cameraPermissionDeniedTitle'),
          message: t('imagePicker.cameraPermissionDeniedMessage'),
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled) {
        onChange([...images, ...toPickedImages(result.assets)].slice(0, maxImages));
      }
    } catch {
      showToast({ variant: 'error', title: t('imagePicker.cameraFailedTitle'), message: t('imagePicker.cameraFailedMessage') });
    }
  };

  const handleRemove = (uri: string) => {
    onChange(images.filter((img) => img.uri !== uri));
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.row}>
        {images.map((img) => (
          <View key={img.uri} style={styles.thumbWrap}>
            <Image source={{ uri: img.uri }} style={styles.thumb} />
            <Pressable
              style={styles.removeButton}
              onPress={() => handleRemove(img.uri)}
              accessibilityLabel={t('common.cancel')}
              hitSlop={6}
            >
              <FontAwesome6 name="xmark" size={10} color="#FFFFFF" solid />
            </Pressable>
          </View>
        ))}
        {images.length < maxImages && allowCamera ? (
          <>
            <Pressable
              style={[styles.addButton, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={handleCamera}
              accessibilityLabel={t('imagePicker.camera')}
            >
              <FontAwesome6 name="camera" size={18} color={colors.textMuted} solid />
              <Text style={[styles.addLabel, { color: colors.textMuted }]}>{t('imagePicker.camera')}</Text>
            </Pressable>
            <Pressable
              style={[styles.addButton, { borderColor: colors.border, backgroundColor: colors.background }]}
              onPress={handlePick}
              accessibilityLabel={t('imagePicker.gallery')}
            >
              <FontAwesome6 name="images" size={18} color={colors.textMuted} solid />
              <Text style={[styles.addLabel, { color: colors.textMuted }]}>{t('imagePicker.gallery')}</Text>
            </Pressable>
          </>
        ) : null}
        {images.length < maxImages && !allowCamera ? (
          <Pressable
            style={[styles.addButton, { borderColor: colors.border, backgroundColor: colors.background }]}
            onPress={handlePick}
          >
            <FontAwesome6 name="plus" size={18} color={colors.textMuted} solid />
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t('imagePicker.hint', { count: images.length, max: maxImages })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { ...typography.caption, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrap: { width: THUMB_SIZE, height: THUMB_SIZE },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 10 },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: { ...typography.caption, fontSize: 10, marginTop: 4 },
  hint: { ...typography.caption, marginTop: 8 },
});
