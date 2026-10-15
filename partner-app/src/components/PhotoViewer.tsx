import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme';
import { SmartImage } from './SmartImage';

interface PhotoViewerProps {
  photos: string[];
  /** Index of the photo to open on; null keeps the viewer closed. */
  startIndex: number | null;
  onClose: () => void;
}

/**
 * Full-screen photo viewer: swipe left/right through the photos one at a time, each shown
 * whole (contain, never cropped) on black, with a "2 / 5" counter and dots. Copied in
 * user-app and partner-app — keep the two in sync.
 */
export function PhotoViewer({ photos, startIndex, onClose }: PhotoViewerProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get('window');
  const listRef = useRef<FlatList<string>>(null);
  const [index, setIndex] = useState(0);
  const visible = startIndex !== null && photos.length > 0;

  useEffect(() => {
    if (startIndex !== null) setIndex(startIndex);
  }, [startIndex]);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {visible ? <StatusBar style="light" /> : null}
      <View style={styles.container}>
        <FlatList
          ref={listRef}
          data={photos}
          keyExtractor={(url, position) => `${position}-${url}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          initialScrollIndex={startIndex ?? 0}
          getItemLayout={(_, position) => ({ length: width, offset: width * position, index: position })}
          onMomentumScrollEnd={onScrollEnd}
          renderItem={({ item }) => (
            <View style={{ width, height }}>
              <SmartImage source={{ uri: item }} style={styles.image} resizeMode="contain" />
            </View>
          )}
        />

        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.counter}>
            {index + 1} / {photos.length}
          </Text>
          <Pressable style={styles.closeButton} onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <FontAwesome6 name="xmark" size={18} color="#FFFFFF" solid />
          </Pressable>
        </View>

        {photos.length > 1 ? (
          <View style={[styles.dots, { bottom: insets.bottom + 28 }]}>
            {photos.map((url, position) => (
              <View key={`${position}-${url}`} style={[styles.dot, position === index ? styles.dotActive : null]} />
            ))}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  image: { flex: 1, width: '100%' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  counter: {
    color: '#FFFFFF',
    fontFamily: fonts.semiBold,
    fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 20, backgroundColor: '#FFFFFF' },
});
