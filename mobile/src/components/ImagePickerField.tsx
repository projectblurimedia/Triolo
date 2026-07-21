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
}

const THUMB_SIZE = 72;

/** Multi-image picker (gallery only, no camera) — images upload as multipart FormData on submit, not at pick time. */
export function ImagePickerField({ label, images, onChange, maxImages = 6 }: ImagePickerFieldProps) {
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
        const picked: PickedImage[] = result.assets.map((asset, index) => {
          // Android gallery picks are often content:// URIs with no real file extension —
          // asset.uri.split('.').pop() on those returns garbage (the whole URI), which
          // would corrupt the multipart file's type/name. Trust asset.mimeType first;
          // fall back to a safe, always-valid default rather than guessing from the URI.
          const type = asset.mimeType ?? 'image/jpeg';
          const extension = type.split('/').pop() ?? 'jpg';
          return {
            uri: asset.uri,
            name: asset.fileName ?? `photo_${Date.now()}_${index}.${extension}`,
            type,
          };
        });
        onChange([...images, ...picked].slice(0, maxImages));
      }
    } catch {
      showToast({ variant: 'error', title: t('imagePicker.pickFailedTitle'), message: t('imagePicker.pickFailedMessage') });
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
        {images.length < maxImages ? (
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
  hint: { ...typography.caption, marginTop: 8 },
});
