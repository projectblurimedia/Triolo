import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingIndicator } from './LoadingIndicator';
import { RatingStars } from './RatingStars';
import { Avatar } from './WorkerMiniCard';
import { NearbyResultDetailModal } from './NearbyResultDetailModal';
import { useFavoriteToggle, useFavorites } from '@/hooks/useFavorites';
import { useDeviceLocation } from '@/hooks/useDeviceLocation';
import { FavoriteType } from '@/services/favoritesService';
import { WorkerNearbyResult } from '@/services/workersService';
import { BusinessNearbyResult } from '@/services/businessesService';
import { distanceBetween } from '@/utils/tripLinks';
import { NearbyResult } from '@/utils/nearbyResult';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';

interface FavoritesModalProps {
  visible: boolean;
  onClose: () => void;
  type: FavoriteType;
}

function HeartButton({ type, id }: { type: FavoriteType; id: string }) {
  const { saved, toggle, pending } = useFavoriteToggle(type, id);
  return (
    <Pressable onPress={toggle} disabled={pending} hitSlop={10} style={styles.heart}>
      <FontAwesome6 name="heart" size={18} color={saved ? '#E11D48' : '#94A3B8'} solid={saved} />
    </Pressable>
  );
}

/** The Services menu's Favorite Workers and the Bazaar menu's Favorite Shops. */
export function FavoritesModal({ visible, onClose, type }: FavoritesModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const favorites = useFavorites();
  const { location } = useDeviceLocation();
  const [selected, setSelected] = useState<NearbyResult | null>(null);
  const isWorker = type === 'worker';

  // Saved items carry no distance — work it out from where the customer is, when known.
  const distanceTo = (latitude: number | null, longitude: number | null) =>
    location.status === 'ready' && latitude != null && longitude != null
      ? distanceBetween({ latitude: location.latitude, longitude: location.longitude }, { latitude, longitude })
      : 0;

  const items: NearbyResult[] = isWorker
    ? (favorites.data?.workers ?? []).map((worker) => ({
        ...worker,
        distanceMeters: distanceTo(worker.latitude, worker.longitude),
      }))
    : (favorites.data?.businesses ?? []).map((shop) => ({ ...shop, distanceMeters: distanceTo(shop.latitude, shop.longitude) }));

  const renderItem = ({ item }: { item: NearbyResult }) => {
    const worker = isWorker ? (item as WorkerNearbyResult) : null;
    const shop = !isWorker ? (item as BusinessNearbyResult) : null;
    const name = worker ? worker.accountFullName : (shop as BusinessNearbyResult).shopName;
    const photo = worker
      ? (worker.profilePhotoUrl ?? worker.portfolioPhotoUrls[0])
      : ((shop as BusinessNearbyResult).shopPhotoUrls[0] ?? (shop as BusinessNearbyResult).profilePhotoUrl);
    const tags = worker
      ? worker.skillCategories.filter((key) => key !== 'other').map((key) => t(`workerProfile.skills.${key}`))
      : (shop as BusinessNearbyResult).shopCategories
          .filter((key) => key !== 'other')
          .map((key) => t(`businessProfile.categories.${key}`));
    return (
      <Pressable
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setSelected(item)}
      >
        <Avatar photoUrl={photo} name={name} size={50} />
        <View style={styles.flex}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
            {tags.join(', ')}
          </Text>
          <View style={styles.metaRow}>
            <RatingStars average={item.ratingAverage} count={item.ratingCount} />
            {shop ? (
              <Text style={[styles.meta, { color: shop.deliveryAvailable ? brandColors.success : colors.textMuted }]}>
                · {t(shop.deliveryAvailable ? 'sendList.delivers' : 'sendList.pickupOnly')}
              </Text>
            ) : null}
          </View>
        </View>
        <HeartButton type={type} id={item.id} />
      </Pressable>
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
          <Pressable style={styles.backButton} onPress={onClose} accessibilityLabel={t('common.close')} hitSlop={8}>
            <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.headerTitle}>{t(isWorker ? 'favorites.workersTitle' : 'favorites.shopsTitle')}</Text>
            <Text style={styles.headerSubtitle}>{t('favorites.subtitle')}</Text>
          </View>
        </LinearGradient>

        {favorites.isLoading ? (
          <View style={styles.state}>
            <LoadingIndicator size={36} dotSize={5} color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
            ListEmptyComponent={
              <View style={styles.state}>
                <FontAwesome6 name="heart" size={26} color={colors.textMuted} />
                <Text style={[styles.stateTitle, { color: colors.text }]}>{t('favorites.emptyTitle')}</Text>
                <Text style={[styles.meta, styles.center, { color: colors.textMuted }]}>
                  {t(isWorker ? 'favorites.emptyWorkers' : 'favorites.emptyShops')}
                </Text>
              </View>
            }
          />
        )}
      </View>

      <NearbyResultDetailModal
        visible={selected !== null}
        onClose={() => setSelected(null)}
        mode={isWorker ? 'worker' : 'business'}
        result={selected}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, gap: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 16 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 18 },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 12 },
  name: { ...typography.body, fontFamily: fonts.semiBold },
  meta: { ...typography.caption, fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heart: { padding: 6 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
  stateTitle: { ...typography.body, fontFamily: fonts.semiBold, textAlign: 'center' },
  center: { textAlign: 'center' },
});
