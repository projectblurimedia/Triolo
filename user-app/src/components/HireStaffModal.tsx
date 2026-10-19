import React, { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Button } from './Button';
import { LoadingIndicator } from './LoadingIndicator';
import { PullToRefresh } from './PullToRefresh';
import { ToastHost } from './ToastHost';
import { Avatar } from './WorkerMiniCard';
import { JobSeekerDetailModal, jobSeekerTitle } from './JobSeekerDetailModal';
import { locationActionLabel, useDeviceLocation } from '@/hooks/useDeviceLocation';
import { SERVICES_RADIUS_KM } from '@/hooks/useNearbyWorkers';
import {
  JOB_CATEGORIES,
  JobCategory,
  JobSeeker,
  jobSeekersService,
  JobSeekerSort,
  PayPeriod,
} from '@/services/jobSeekersService';
import { formatRupees } from '@/services/ordersService';
import { formatDistanceValue } from '@/utils/nearbyResult';
import { callPhone } from '@/utils/tripLinks';
import { colors as brandColors, fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { showAdBefore } from './Ads';

const CALL_GRADIENT = ['#16A34A', '#22C55E'] as const;
const SEARCH_DEBOUNCE_MS = 350;
const SKILLS_SHOWN = 4;

interface HireStaffModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * "Hire Staff": people nearby looking for regular work — a home cook, a tutor, a driver, a
 * nanny… (posted from the partner app). Filter by kind of work and daily / monthly pay, sort
 * nearest or lowest pay, search by name / work / skill, and call them straight away.
 */
export function HireStaffModal({ visible, onClose }: HireStaffModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { location, refresh: refreshLocation } = useDeviceLocation();
  const coords = location.status === 'ready' ? location : null;

  const [category, setCategory] = useState<JobCategory | null>(null);
  const [payPeriod, setPayPeriod] = useState<PayPeriod | null>(null);
  const [sort, setSort] = useState<JobSeekerSort>('distance');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<JobSeeker | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useQuery({
    queryKey: ['job-seekers', coords?.latitude, coords?.longitude, category, payPeriod, sort, debouncedQuery],
    queryFn: () =>
      jobSeekersService.search({
        latitude: coords!.latitude,
        longitude: coords!.longitude,
        radiusKm: SERVICES_RADIUS_KM,
        category,
        payPeriod,
        query: debouncedQuery || undefined,
        sort,
      }),
    enabled: visible && coords !== null,
    staleTime: 30_000,
  });

  const chip = (key: string, label: string, active: boolean, onPress: () => void, icon?: string) => (
    <Pressable key={key} onPress={onPress}>
      {active ? (
        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.chip}>
          {icon ? <FontAwesome6 name={icon as never} size={11} color="#FFFFFF" solid /> : null}
          <Text style={[styles.chipText, { color: '#FFFFFF' }]}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={[styles.chip, { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }]}>
          {icon ? <FontAwesome6 name={icon as never} size={11} color={colors.textMuted} solid /> : null}
          <Text style={[styles.chipText, { color: colors.text }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );

  const renderPerson = ({ item }: { item: JobSeeker }) => {
    const extraSkills = item.skills.length - SKILLS_SHOWN;
    const categoryIcon = JOB_CATEGORIES.find((entry) => entry.key === item.category)?.icon ?? 'user-tie';
    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
        ]}
        onPress={() => setSelected(item)}
      >
        <View style={styles.cardTop}>
          <Avatar photoUrl={item.photoUrl ?? undefined} name={item.fullName} size={50} />
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {item.fullName}
            </Text>
            <Text style={[styles.jobTitle, { color: colors.textMuted }]} numberOfLines={1}>
              {jobSeekerTitle(item, t)}
            </Text>
          </View>
          <View style={[styles.distancePill, { backgroundColor: `${colors.primary}12` }]}>
            <FontAwesome6 name="location-arrow" size={10} color={colors.primary} solid />
            <Text style={[styles.distanceText, { color: colors.primary }]}>{formatDistanceValue(item.distanceMeters)}</Text>
          </View>
        </View>

        <View style={styles.payRow}>
          <Text style={[styles.pay, { color: colors.text }]}>{formatRupees(item.payAmount)}</Text>
          <Text style={[styles.per, { color: colors.textMuted }]}> / {t(`hireStaff.per.${item.payPeriod}`)}</Text>
        </View>

        <View style={styles.tags}>
          <View style={[styles.tag, { backgroundColor: `${colors.primary}12` }]}>
            <FontAwesome6 name={categoryIcon as never} size={10} color={colors.primary} solid />
            <Text style={[styles.tagText, { color: colors.primary }]}>{t(`hireStaff.categories.${item.category}`)}</Text>
          </View>
          <View style={[styles.tag, { backgroundColor: `${brandColors.success}14` }]}>
            <FontAwesome6 name="clock" size={10} color={brandColors.success} solid />
            <Text style={[styles.tagText, { color: brandColors.success }]}>
              {t(`hireStaff.availability.${item.availability}`)}
            </Text>
          </View>
          {item.experienceYears > 0 ? (
            <View style={[styles.tag, { backgroundColor: `${colors.text}0D` }]}>
              <FontAwesome6 name="briefcase" size={10} color={colors.textMuted} solid />
              <Text style={[styles.tagText, { color: colors.textMuted }]}>
                {t('hireStaff.experience', { count: item.experienceYears })}
              </Text>
            </View>
          ) : null}
        </View>

        {item.skills.length > 0 ? (
          <Text style={[styles.skills, { color: colors.text }]} numberOfLines={1}>
            {item.skills.slice(0, SKILLS_SHOWN).join(' · ')}
            {extraSkills > 0 ? `  +${extraSkills}` : ''}
          </Text>
        ) : null}

        {item.description ? (
          <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        <View style={styles.locationRow}>
          <FontAwesome6 name="location-dot" size={11} color={colors.textMuted} solid />
          <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
            {item.locationAddress}
          </Text>
        </View>

        <View style={styles.viewProfile}>
          <Text style={[styles.more, { color: colors.primary }]}>{t('hireStaff.viewProfile')}</Text>
          <FontAwesome6 name="chevron-right" size={10} color={colors.primary} solid />
        </View>

        <View style={[styles.contactRow, { borderTopColor: colors.border }]}>
          <View style={styles.phoneGroup}>
            <View style={[styles.phoneIcon, { backgroundColor: `${brandColors.success}14` }]}>
              <FontAwesome6 name="phone" size={12} color={brandColors.success} solid />
            </View>
            <Text style={[styles.phone, { color: colors.text }]} selectable>
              {item.mobileNumber}
            </Text>
          </View>
          <Pressable
            onPress={() => showAdBefore(() => callPhone(item.mobileNumber))}
            accessibilityLabel={`${t('hireStaff.call')} ${item.fullName}`}
          >
            <LinearGradient colors={CALL_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.callButton}>
              <FontAwesome6 name="phone" size={13} color="#FFFFFF" solid />
              <Text style={styles.callText}>{t('hireStaff.call')}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const renderBody = () => {
    if (!coords) {
      const blocked = location.status === 'denied' || location.status === 'disabled' || location.status === 'error';
      return (
        <View style={styles.state}>
          {blocked ? (
            <>
              <FontAwesome6 name="location-crosshairs" size={24} color={colors.textMuted} solid />
              <Text style={[styles.stateTitle, { color: colors.text }]}>{t('location.disabledTitle')}</Text>
              <View style={styles.stateAction}>
                <Button label={locationActionLabel(location, t)} onPress={refreshLocation} />
              </View>
            </>
          ) : (
            <LoadingIndicator size={36} dotSize={5} color={colors.primary} />
          )}
        </View>
      );
    }
    if (results.isLoading) {
      return (
        <View style={styles.state}>
          <LoadingIndicator size={36} dotSize={5} color={colors.primary} />
        </View>
      );
    }
    return (
      <PullToRefresh refreshing={results.isRefetching} onRefresh={() => results.refetch()}>
        <FlatList
          data={results.data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderPerson}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={
            <View style={styles.state}>
              <FontAwesome6
                name={results.isError ? 'triangle-exclamation' : 'user-slash'}
                size={24}
                color={colors.textMuted}
                solid
              />
              <Text style={[styles.stateTitle, { color: colors.text }]}>
                {t(results.isError ? 'hireStaff.loadFailed' : 'hireStaff.emptyTitle')}
              </Text>
              {results.isError ? null : (
                <Text style={[styles.stateText, { color: colors.textMuted }]}>{t('hireStaff.emptyMessage')}</Text>
              )}
            </View>
          }
        />
      </PullToRefresh>
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
            <Text style={styles.headerTitle}>{t('hireStaff.title')}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {t('hireStaff.subtitle')}
            </Text>
          </View>
        </LinearGradient>

        {/* Search and filters sit below the header — headers carry only the title. */}
        <View style={styles.filters}>
          <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FontAwesome6 name="magnifying-glass" size={14} color={colors.textMuted} solid />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={query}
              onChangeText={setQuery}
              placeholder={t('hireStaff.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              maxLength={60}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <FontAwesome6 name="circle-xmark" size={15} color={colors.textMuted} solid />
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {chip('all', t('hireStaff.all'), category === null, () => setCategory(null))}
            {JOB_CATEGORIES.map((entry) =>
              chip(
                entry.key,
                t(`hireStaff.categories.${entry.key}`),
                category === entry.key,
                () => setCategory(entry.key),
                entry.icon,
              ),
            )}
          </ScrollView>
          <View style={styles.optionRow}>
            <View style={[styles.segment, { backgroundColor: `${colors.primary}10` }]}>
              {([null, 'daily', 'monthly'] as (PayPeriod | null)[]).map((value) => (
                <Pressable
                  key={value ?? 'any'}
                  onPress={() => setPayPeriod(value)}
                  style={[styles.segmentItem, payPeriod === value ? { backgroundColor: colors.surface } : null]}
                >
                  <Text style={[styles.segmentText, { color: payPeriod === value ? colors.primary : colors.textMuted }]}>
                    {value ? t(`hireStaff.period.${value}`) : t('hireStaff.anyPay')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={[styles.segment, { backgroundColor: `${colors.primary}10` }]}>
              {(['distance', 'pay'] as JobSeekerSort[]).map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setSort(value)}
                  style={[styles.segmentItem, sort === value ? { backgroundColor: colors.surface } : null]}
                >
                  <Text style={[styles.segmentText, { color: sort === value ? colors.primary : colors.textMuted }]}>
                    {t(value === 'distance' ? 'hireStaff.sortNearest' : 'hireStaff.sortPay')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {renderBody()}
        <JobSeekerDetailModal person={selected} onClose={() => setSelected(null)} />
        <ToastHost />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
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
  filters: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
  },
  searchInput: { flex: 1, ...typography.body, fontSize: 14, padding: 0 },
  chips: { gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { ...typography.caption, fontFamily: fonts.medium, fontSize: 12 },
  optionRow: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, flexDirection: 'row', borderRadius: 14, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 32, borderRadius: 11 },
  segmentText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11.5 },
  list: { padding: 16, gap: 14, flexGrow: 1 },
  card: { borderRadius: 18, borderWidth: 1, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 16 },
  jobTitle: { ...typography.caption, fontSize: 12.5, marginTop: 1 },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  distanceText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  payRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 12 },
  pay: { fontFamily: fonts.semiBold, fontSize: 22, lineHeight: 28 },
  per: { ...typography.body, fontSize: 13 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  tagText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11 },
  skills: { ...typography.body, fontSize: 13, marginTop: 10 },
  description: { ...typography.caption, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  locationText: { ...typography.caption, fontSize: 12, flex: 1 },
  more: { ...typography.caption, fontFamily: fonts.semiBold },
  viewProfile: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 12,
  },
  phoneGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  phoneIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  phone: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15, letterSpacing: 0.3 },
  callButton: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 18, borderRadius: 20 },
  callText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14, color: '#FFFFFF' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 24 },
  stateTitle: { ...typography.body, fontFamily: fonts.semiBold, textAlign: 'center' },
  stateText: { ...typography.caption, textAlign: 'center', lineHeight: 18 },
  stateAction: { alignSelf: 'stretch', marginTop: 4 },
});
