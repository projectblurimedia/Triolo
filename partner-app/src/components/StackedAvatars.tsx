import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemeColors } from '@/theme';

/**
 * Several profiles' avatars as one compact cluster (Profile's shops / job posts card): two
 * overlap side by side, three (or more — only three are drawn) sit as a triangle overlapping
 * each other. `renderItem` draws one avatar at the given size (ringed in the card colour).
 */
export function StackedAvatars<T>({
  items,
  size = 30,
  renderItem,
}: {
  items: T[];
  size?: number;
  renderItem: (item: T, size: number) => React.ReactNode;
}) {
  const { colors } = useThemeColors();
  const shown = items.slice(0, 3);
  const ring = 2;
  const box = size + ring * 2;
  // Where each avatar sits (left, top) inside the cluster.
  const spots =
    shown.length >= 3
      ? [
          { left: box * 0.4, top: 0 },
          { left: 0, top: box * 0.62 },
          { left: box * 0.8, top: box * 0.62 },
        ]
      : shown.length === 2
        ? [
            { left: 0, top: box * 0.1 },
            { left: box * 0.62, top: box * 0.1 },
          ]
        : [{ left: 0, top: 0 }];
  const width = Math.max(...spots.map((spot) => spot.left)) + box;
  const height = Math.max(...spots.map((spot) => spot.top)) + box;

  return (
    <View>
      <View style={{ width, height }}>
        {shown.map((item, index) => (
          <View
            key={index}
            style={[
              styles.ring,
              { left: spots[index].left, top: spots[index].top, width: box, height: box, borderRadius: box / 2, backgroundColor: colors.surface, padding: ring },
            ]}
          >
            {renderItem(item, size)}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', overflow: 'hidden' },
});
