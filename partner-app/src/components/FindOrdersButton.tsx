import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { LoadingIndicator } from './LoadingIndicator';
import { shopOrdersService } from '@/services/shopOrdersService';
import { SHOP_ORDERS_QUERY_KEY } from '@/hooks/useShopOrders';
import { useLocationGatedMutation } from '@/hooks/useLocationGatedMutation';
import { useIncomingStore } from '@/state/incomingStore';
import { showToast } from '@/state/toastStore';
import { getLocalizedErrorMessage } from '@/localization/errorMessages';
import { fonts, headerGradient, typography } from '@/theme';

/**
 * "Find Orders Now" on My Shop — the shop's Find Jobs Now: asks the server for every Quick
 * Order still looking for a shop near this shop that it can take (its kind of shop; delivery
 * only if it delivers), even one whose notification never came or that it declined. They join
 * the shop's New orders; with any found, Bookings → Shop Orders opens on New.
 */
export function FindOrdersButton() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // Location is asked for first, as for every partner action.
  const search = useLocationGatedMutation({
    mutationFn: async (_: void) => shopOrdersService.searchQuick(),
    onSuccess: (orders) => {
      const open = orders.filter((order) => order.quick && order.status === 'placed' && !order.businessId).length;
      // Found some: they open in the New requests list, not Activity (which is a record).
      if (open > 0) useIncomingStore.getState().openList();
      queryClient.setQueryData(SHOP_ORDERS_QUERY_KEY, orders);
      if (open > 0) {
        showToast({ variant: 'success', title: t('findOrders.foundTitle', { count: open }), message: t('findOrders.foundMessage') });
      } else {
        showToast({ variant: 'info', title: t('findOrders.noneTitle'), message: t('findOrders.noneMessage') });
      }
    },
    onError: (error) =>
      showToast({ variant: 'error', title: t('common.errorTitle'), message: getLocalizedErrorMessage(error, t) }),
  });

  return (
    <Pressable
      onPress={() => search.mutate()}
      disabled={search.isPending}
      style={({ pressed }) => [styles.wrap, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <FontAwesome6 name="basket-shopping" size={70} color="rgba(255,255,255,0.14)" solid style={styles.watermark} />
        <View style={styles.icon}>
          {search.isPending ? (
            <LoadingIndicator size={22} dotSize={4} color="#FFFFFF" />
          ) : (
            <FontAwesome6 name="magnifying-glass-location" size={19} color="#FFFFFF" solid />
          )}
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>{t(search.isPending ? 'findOrders.searching' : 'findOrders.button')}</Text>
          <Text style={styles.hint} numberOfLines={2}>
            {t('findOrders.hint')}
          </Text>
        </View>
        <FontAwesome6 name="chevron-right" size={14} color="#FFFFFF" solid />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 6 },
  card: { borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -8, bottom: -14 },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  title: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  hint: { ...typography.caption, color: 'rgba(255,255,255,0.88)', lineHeight: 16 },
});
