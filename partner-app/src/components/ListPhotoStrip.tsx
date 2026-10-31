import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { SmartImage } from './SmartImage';
import { PhotoViewer } from './PhotoViewer';
import { useThemeColors } from '@/theme';

/*
 * (Copied between user-app and partner-app — keep in sync.)
 */

/**
 * Photos of a written (paper) list, in one sideways row; tapping one opens them full screen to
 * read. Shown wherever a list's items would be: sending it, the order, and the shop's side.
 */
export function ListPhotoStrip({ photos, size = 72 }: { photos: string[]; size?: number }) {
  const { colors } = useThemeColors();
  const [openAt, setOpenAt] = useState<number | null>(null);
  if (photos.length === 0) return null;
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll}>
        {photos.map((uri, index) => (
          <Pressable key={`${uri}-${index}`} onPress={() => setOpenAt(index)} style={[styles.thumb, { width: size, height: size, borderColor: `${colors.primary}26` }]}>
            <SmartImage source={{ uri }} style={StyleSheet.absoluteFill} />
            <FontAwesome6 name="expand" size={11} color="#FFFFFF" solid style={styles.zoom} />
          </Pressable>
        ))}
      </ScrollView>
      <PhotoViewer photos={photos} startIndex={openAt} onClose={() => setOpenAt(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { gap: 8 },
  thumb: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  zoom: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
});
