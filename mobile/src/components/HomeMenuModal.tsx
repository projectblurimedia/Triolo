import React, { useEffect, useRef } from 'react';
import { Alert, Animated, Dimensions, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.85;

interface HomeMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Right-side sliding drawer triggered from Home's header menu icon — entry points for onboarding into Worker/Business. */
export function HomeMenuModal({ visible, onClose }: HomeMenuModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const translateX = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: visible ? 0 : DRAWER_WIDTH,
        useNativeDriver: true,
        tension: 60,
        friction: 12,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? 300 : 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  // Worker/Business registration for an already-logged-in User account isn't built
  // yet (see .cloud/project-context.md — Worker/Business modules are still pending),
  // so these entries surface the intent now and tell the user it's on the way.
  const handleComingSoon = () => {
    onClose();
    Alert.alert(t('homeMenu.comingSoonTitle'), t('homeMenu.comingSoonMessage'));
  };

  const items = [
    {
      key: 'worker',
      icon: 'screwdriver-wrench' as const,
      gradient: headerGradient,
      title: t('homeMenu.registerWorkerTitle'),
      subtitle: t('homeMenu.registerWorkerSubtitle'),
    },
    {
      key: 'business',
      icon: 'store' as const,
      gradient: [colors.secondary, colors.warning] as const,
      title: t('homeMenu.registerBusinessTitle'),
      subtitle: t('homeMenu.registerBusinessSubtitle'),
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.container}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]} />
        </Pressable>

        <Animated.View
          style={[styles.drawer, { backgroundColor: colors.surface, transform: [{ translateX }] }]}
        >
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <FontAwesome6 name="shapes" size={28} color={colors.white} solid />
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {t('homeMenu.title')}
                  </Text>
                  <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {t('homeMenu.subtitle')}
                  </Text>
                </View>
              </View>
              <Pressable style={styles.closeButton} onPress={onClose} accessibilityLabel={t('common.cancel')} hitSlop={8}>
                <FontAwesome6 name="xmark" size={18} color={colors.white} solid />
              </Pressable>
            </View>
          </LinearGradient>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('homeMenu.growSection')}</Text>
            {items.map((item) => (
              <Pressable
                key={item.key}
                style={[styles.item, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={handleComingSoon}
              >
                <LinearGradient colors={item.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.itemIcon}>
                  <FontAwesome6 name={item.icon} size={18} color={colors.white} solid />
                </LinearGradient>
                <View style={styles.itemText}>
                  <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.itemSubtitle, { color: colors.textMuted }]} numberOfLines={2}>
                    {item.subtitle}
                  </Text>
                </View>
                <FontAwesome6 name="chevron-right" size={14} color={colors.textMuted} solid />
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: DRAWER_WIDTH,
    height: SCREEN_HEIGHT,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.2, shadowRadius: 20 },
      android: { elevation: 20 },
    }),
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 64 : 44,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  headerText: { marginLeft: 12, flex: 1 },
  headerTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  headerSubtitle: { ...typography.caption, color: 'rgba(255, 255, 255, 0.85)', marginTop: 2 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: { padding: 16, paddingBottom: 32 },
  sectionTitle: { ...typography.caption, fontFamily: fonts.medium, marginBottom: 10, marginLeft: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemText: { flex: 1, marginRight: 8 },
  itemTitle: { ...typography.body, fontFamily: fonts.semiBold },
  itemSubtitle: { ...typography.caption, marginTop: 2 },
});
