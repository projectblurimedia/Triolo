import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassBackdrop, GlassCard } from './Glass';
import { MapPickerModal } from './MapPickerModal';
import { useDeviceLocation } from '@/hooks/useDeviceLocation';
import { AddressKind, SavedAddress, useAddressStore } from '@/state/addressStore';
import { useLocationStore } from '@/state/locationStore';
import { PlaceValue, placeFromCoords } from '@/utils/place';
import { placeName } from '@/utils/formatAddress';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

/*
 * (Copied between user-app and partner-app — keep in sync.)
 */

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];
const KIND_ICON: Record<AddressKind, IconName> = { home: 'house', work: 'briefcase', other: 'location-dot' };
const KINDS: AddressKind[] = ['home', 'work', 'other'];

// The current place's name, looked up once per spot (≈100 m) rather than on every render.
let cachedName: { key: string; name: string } | null = null;

/**
 * Under Home's greeting: the village / town you're in (or the saved address you chose), with a
 * sheet to switch between Current location and saved addresses, and to add, rename, move or
 * delete them on the map.
 */
export function HomeLocationBar() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { location } = useDeviceLocation();
  const saved = useAddressStore((state) => state.saved);
  const selectedId = useAddressStore((state) => state.selectedId);
  const storeSelect = useAddressStore((state) => state.select);
  const storeRemove = useAddressStore((state) => state.remove);
  const storeSave = useAddressStore((state) => state.save);
  // Nearby lists, bookings and orders read the shared position: update it at once.
  const reread = () => {
    useLocationStore
      .getState()
      .refresh()
      .catch(() => undefined);
  };
  const select = (id: string | null) => {
    storeSelect(id);
    reread();
  };
  const remove = (id: string) => {
    storeRemove(id);
    reread();
  };
  const save = (address: Parameters<typeof storeSave>[0]) => {
    const id = storeSave(address);
    reread();
    return id;
  };
  const [currentName, setCurrentName] = useState<string | null>(cachedName?.name ?? null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  // The address being added or changed: its place (after the map) and its label.
  const [draft, setDraft] = useState<{ id?: string; kind: AddressKind; name: string; place: PlaceValue | null } | null>(null);

  const ready = location.status === 'ready';
  const lat = ready ? location.latitude : null;
  const lng = ready ? location.longitude : null;
  const choosing = selectedId !== null;
  useEffect(() => {
    if (choosing || lat == null || lng == null) return;
    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    if (cachedName?.key === key) {
      setCurrentName(cachedName.name);
      return;
    }
    let alive = true;
    placeFromCoords(lat, lng)
      .then((place) => {
        const name = placeName(place.locationName) || place.locationName;
        cachedName = { key, name };
        if (alive) setCurrentName(name);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [lat, lng, choosing]);

  const selected = saved.find((item) => item.id === selectedId) ?? null;
  const labelOf = (item: SavedAddress) => (item.kind === 'other' && item.name ? item.name : t(`homeLocation.kinds.${item.kind}`));
  const shownName = selected
    ? placeName(selected.place.locationName) || selected.place.locationName
    : (currentName ?? (location.status === 'loading' ? t('homeLocation.finding') : t('homeLocation.unknown')));

  const startAdd = () => {
    setDraft({ kind: 'home', name: '', place: null });
    setMapOpen(true);
  };
  const startEdit = (item: SavedAddress) => {
    setDraft({ id: item.id, kind: item.kind, name: item.name, place: item.place });
    setMapOpen(true);
  };
  const finish = () => {
    if (!draft?.place) return;
    save({ id: draft.id, kind: draft.kind, name: draft.name, place: draft.place });
    setDraft(null);
    setSheetOpen(false);
  };

  const row = (opts: { key: string; icon: IconName; title: string; place: string; active: boolean; onPress: () => void; item?: SavedAddress }) => (
    <Pressable
      key={opts.key}
      onPress={opts.onPress}
      style={({ pressed }) => [
        styles.row,
        { borderColor: opts.active ? colors.primary : colors.border, backgroundColor: opts.active ? `${colors.primary}10` : colors.surface, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: opts.active ? colors.primary : `${colors.primary}14` }]}>
        <FontAwesome6 name={opts.icon} size={13} color={opts.active ? '#FFFFFF' : colors.primary} solid />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
          {opts.title}
        </Text>
        <Text style={[styles.rowPlace, { color: colors.textMuted }]} numberOfLines={1}>
          {opts.place}
        </Text>
      </View>
      {opts.item ? (
        <>
          <Pressable onPress={() => startEdit(opts.item as SavedAddress)} hitSlop={6} style={[styles.small, { borderColor: colors.border }]}>
            <FontAwesome6 name="pen" size={11} color={colors.primary} solid />
          </Pressable>
          <Pressable onPress={() => remove((opts.item as SavedAddress).id)} hitSlop={6} style={[styles.small, { borderColor: colors.border }]}>
            <FontAwesome6 name="trash" size={11} color="#DC2626" solid />
          </Pressable>
        </>
      ) : null}
      {opts.active ? <FontAwesome6 name="circle-check" size={16} color={colors.primary} solid /> : null}
    </Pressable>
  );

  return (
    <>
      <Pressable
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('homeLocation.change')}
        style={({ pressed }) => [styles.bar, { borderColor: `${colors.primary}40`, opacity: pressed ? 0.85 : 1 }]}
      >
        <LinearGradient
          colors={[`${colors.primary}1F`, `${colors.primary}08`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Left: which address it is. Right: the place, with the arrow to change it. */}
        <View style={styles.barLeft}>
          <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pin}>
            <FontAwesome6 name={selected ? KIND_ICON[selected.kind] : 'location-crosshairs'} size={11} color="#FFFFFF" solid />
          </LinearGradient>
          <Text style={[styles.barLabel, { color: colors.primary }]} numberOfLines={1}>
            {selected ? labelOf(selected) : t('homeLocation.current')}
          </Text>
        </View>
        <View style={styles.barRight}>
          <Text style={[styles.barName, { color: colors.text }]} numberOfLines={1}>
            {shownName}
          </Text>
          <FontAwesome6 name="chevron-down" size={11} color={colors.primary} solid />
        </View>
      </Pressable>

      <Modal visible={sheetOpen} transparent animationType="fade" onRequestClose={() => setSheetOpen(false)} statusBarTranslucent>
        <GlassBackdrop onPress={() => setSheetOpen(false)} style={styles.overlay}>
          <GlassCard style={styles.sheet}>
            <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.head}>
              <View style={styles.headIcon}>
                <FontAwesome6 name="map-location-dot" size={15} color="#FFFFFF" solid />
              </View>
              <View style={styles.flex}>
                <Text style={styles.headTitle}>{t(draft ? 'homeLocation.saveTitle' : 'homeLocation.title')}</Text>
                <Text style={styles.headText} numberOfLines={1}>
                  {draft?.place ? placeName(draft.place.locationName) || draft.place.locationName : t('homeLocation.subtitle')}
                </Text>
              </View>
              <Pressable
                onPress={() => (draft ? setDraft(null) : setSheetOpen(false))}
                hitSlop={8}
                style={styles.close}
                accessibilityLabel={t('common.close')}
              >
                <FontAwesome6 name="xmark" size={14} color="#FFFFFF" solid />
              </Pressable>
            </LinearGradient>

            {draft?.place ? (
              // Naming the address picked on the map.
              <View style={styles.body}>
                <Text style={[styles.section, { color: colors.textMuted }]}>{t('homeLocation.saveAs')}</Text>
                <View style={styles.kinds}>
                  {KINDS.map((kind) => {
                    const active = draft.kind === kind;
                    return (
                      <Pressable
                        key={kind}
                        onPress={() => setDraft({ ...draft, kind })}
                        style={[styles.kind, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.surface }]}
                      >
                        <FontAwesome6 name={KIND_ICON[kind]} size={12} color={active ? '#FFFFFF' : colors.primary} solid />
                        <Text style={[styles.kindText, { color: active ? '#FFFFFF' : colors.text }]}>{t(`homeLocation.kinds.${kind}`)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {draft.kind === 'other' ? (
                  <TextInput
                    value={draft.name}
                    onChangeText={(name) => setDraft({ ...draft, name: name.slice(0, 30) })}
                    placeholder={t('homeLocation.namePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, { color: colors.text, borderColor: `${colors.primary}40`, backgroundColor: colors.surface }]}
                  />
                ) : null}
                <Pressable onPress={() => setMapOpen(true)} style={[styles.outline, { borderColor: colors.primary }]}>
                  <FontAwesome6 name="map" size={12} color={colors.primary} solid />
                  <Text style={[styles.outlineText, { color: colors.primary }]}>{t('homeLocation.moveOnMap')}</Text>
                </Pressable>
                <Pressable onPress={finish} style={styles.saveWrap}>
                  <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.save}>
                    <FontAwesome6 name="check" size={13} color="#FFFFFF" solid />
                    <Text style={styles.saveText}>{t('homeLocation.save')}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            ) : (
              <ScrollView style={styles.list} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                {row({
                  key: 'current',
                  icon: 'location-crosshairs',
                  title: t('homeLocation.current'),
                  place: currentName ?? t('homeLocation.unknown'),
                  active: !selected,
                  onPress: () => {
                    select(null);
                    setSheetOpen(false);
                  },
                })}
                {saved.length > 0 ? <Text style={[styles.section, { color: colors.textMuted }]}>{t('homeLocation.savedTitle')}</Text> : null}
                {saved.map((item) =>
                  row({
                    key: item.id,
                    icon: KIND_ICON[item.kind],
                    title: labelOf(item),
                    place: placeName(item.place.locationName) || item.place.locationName,
                    active: item.id === selectedId,
                    item,
                    onPress: () => {
                      select(item.id);
                      setSheetOpen(false);
                    },
                  }),
                )}
                <Pressable onPress={startAdd} style={[styles.add, { borderColor: `${colors.primary}55`, backgroundColor: `${colors.primary}0A` }]}>
                  <FontAwesome6 name="plus" size={13} color={colors.primary} solid />
                  <Text style={[styles.addText, { color: colors.primary }]}>{t('homeLocation.add')}</Text>
                </Pressable>
              </ScrollView>
            )}
          </GlassCard>
        </GlassBackdrop>
        <MapPickerModal
          visible={mapOpen}
          initial={draft?.place ?? null}
          onClose={() => {
            setMapOpen(false);
            // Backing out of the map before any place was picked cancels the new address.
            setDraft((current) => (current?.place ? current : null));
          }}
          onPick={(place) => {
            setMapOpen(false);
            setDraft((current) => ({ ...(current ?? { kind: 'home', name: '' }), place }));
          }}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    height: 46,
    borderRadius: 15,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    marginBottom: 14,
    overflow: 'hidden',
  },
  barLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0, maxWidth: '50%' },
  pin: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  barLabel: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12.5, lineHeight: 16, flexShrink: 1 },
  barRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flex: 1 },
  barName: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14, lineHeight: 19, flexShrink: 1, textAlign: 'right' },
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  sheet: { borderRadius: 22, overflow: 'hidden', maxHeight: '82%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 12 },
  headIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  headTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 15.5, color: '#FFFFFF' },
  headText: { ...typography.caption, fontSize: 12, color: 'rgba(255,255,255,0.88)' },
  close: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 0 },
  body: { padding: 12, gap: 8 },
  section: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 14, borderWidth: 1.5, padding: 10 },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  rowPlace: { ...typography.caption, fontSize: 12 },
  small: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', marginTop: 2 },
  addText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14 },
  kinds: { flexDirection: 'row', gap: 8 },
  kind: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 12, borderWidth: 1.5 },
  kindText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12.5 },
  input: { height: 46, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 14 },
  outline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 42, borderRadius: 12, borderWidth: 1.5 },
  outlineText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 13.5 },
  saveWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 2 },
  save: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46 },
  saveText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14, color: '#FFFFFF' },
});
