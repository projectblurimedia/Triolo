import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { LoadingIndicator } from './LoadingIndicator';
import { ToastHost } from './ToastHost';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { PlaceValue, placeFromCoords } from '@/utils/place';
import { ensureLocationOn } from '@/utils/ensureLocationOn';
import { showToast } from '@/state/toastStore';

interface MapPickerModalProps {
  visible: boolean;
  /** Where the map opens; falls back to the phone's last known position, then a wide view. */
  initial: PlaceValue | null;
  onClose: () => void;
  onPick: (place: PlaceValue) => void;
}

interface Center {
  latitude: number;
  longitude: number;
  zoom: number;
}

const MAPLIBRE_VERSION = '4.7.1';
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
// Andhra Pradesh / Telangana, the launch region — only used when nothing better is known.
const FALLBACK_CENTER: Center = { latitude: 16.9, longitude: 80.4, zoom: 6 };

function buildHtml(center: Center): string {
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link href="https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js"></script>
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #e8eef7; }
  .maplibregl-ctrl-attrib { font-size: 9px; }
</style>
</head><body><div id="map"></div>
<script>
  function post(msg) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  function hasWebGL() {
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); }
    catch (e) { return false; }
  }
  if (typeof maplibregl === 'undefined' || !hasWebGL()) {
    post({ type: 'error' });
  } else {
    var map = new maplibregl.Map({
      container: 'map',
      style: '${MAP_STYLE_URL}',
      center: [${center.longitude}, ${center.latitude}],
      zoom: ${center.zoom},
      attributionControl: { compact: true },
    });
    function sendCenter(type) { var c = map.getCenter(); post({ type: type, latitude: c.lat, longitude: c.lng }); }
    map.on('load', function () { sendCenter('ready'); });
    map.on('movestart', function () { post({ type: 'moving' }); });
    map.on('moveend', function () { sendCenter('center'); });
    map.on('error', function () { if (!map.loaded()) post({ type: 'error' }); });
    window.__flyTo = function (lat, lng) { map.flyTo({ center: [lng, lat], zoom: 16, duration: 900 }); };
  }
</script></body></html>`;
}

/**
 * "Select on map": a full-screen free OpenStreetMap map (same MapLibre + OpenFreeMap setup as
 * LiveMap, no API key) with a pin fixed in the middle. The person drags the map under the pin;
 * the place name under it updates as they go, and Confirm returns that spot with its address.
 */
export function MapPickerModal({ visible, initial, onClose, onPick }: MapPickerModalProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [start, setStart] = useState<Center | null>(null);
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [moving, setMoving] = useState(false);
  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [preview, setPreview] = useState<PlaceValue | null>(null);
  const [locating, setLocating] = useState(false);
  const lookupId = useRef(0);
  // Read when the map opens only — a new object from the parent mustn't reset the map mid-use.
  const initialRef = useRef(initial);
  initialRef.current = initial;

  // Pick where the map opens each time it's shown.
  useEffect(() => {
    if (!visible) {
      setStart(null);
      return;
    }
    setMapState('loading');
    setPreview(null);
    setCenter(null);
    const initial = initialRef.current;
    if (initial) {
      setStart({ latitude: initial.latitude, longitude: initial.longitude, zoom: 16 });
      return;
    }
    let cancelled = false;
    Location.getLastKnownPositionAsync()
      .then((last) => {
        if (cancelled) return;
        setStart(last ? { latitude: last.coords.latitude, longitude: last.coords.longitude, zoom: 15 } : FALLBACK_CENTER);
      })
      .catch(() => !cancelled && setStart(FALLBACK_CENTER));
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const html = useMemo(() => (start ? buildHtml(start) : null), [start]);

  // Name the spot under the pin once the map stops moving.
  useEffect(() => {
    if (!center) return;
    const id = ++lookupId.current;
    const timer = setTimeout(() => {
      placeFromCoords(center.latitude, center.longitude).then((place) => {
        if (id === lookupId.current) setPreview(place);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [center]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type: string; latitude?: number; longitude?: number };
      if (message.type === 'error') setMapState('error');
      if (message.type === 'moving') {
        setMoving(true);
        setPreview(null);
      }
      if ((message.type === 'ready' || message.type === 'center') && message.latitude != null && message.longitude != null) {
        if (message.type === 'ready') setMapState('ready');
        setMoving(false);
        setCenter({ latitude: message.latitude, longitude: message.longitude });
      }
    } catch {
      // Ignore anything that isn't ours.
    }
  };

  const goToMyLocation = async () => {
    setLocating(true);
    try {
      if (!(await ensureLocationOn())) {
        showToast({ variant: 'error', title: t('location.permissionDeniedTitle'), message: t('location.turnOnMessage') });
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      webViewRef.current?.injectJavaScript(
        `window.__flyTo && window.__flyTo(${position.coords.latitude}, ${position.coords.longitude}); true;`,
      );
    } catch {
      showToast({ variant: 'error', title: t('location.detectFailedTitle'), message: t('location.detectFailedMessage') });
    } finally {
      setLocating(false);
    }
  };

  const confirm = () => {
    if (!preview || moving) return;
    onPick(preview);
  };

  const pinLift = moving ? -10 : 0;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 14 }]}
        >
          <Pressable style={styles.backButton} onPress={onClose} hitSlop={8} accessibilityLabel={t('common.close')}>
            <FontAwesome6 name="chevron-left" size={18} color="#FFFFFF" solid />
          </Pressable>
          <View style={styles.flex}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {t('location.mapTitle')}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {t('location.mapSubtitle')}
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.flex}>
          {html && mapState !== 'error' ? (
            <WebView
              ref={webViewRef}
              source={{ html, baseUrl: 'https://localhost/' }}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              onMessage={onMessage}
              onError={() => setMapState('error')}
              style={styles.webview}
              overScrollMode="never"
              setSupportMultipleWindows={false}
            />
          ) : null}

          {mapState === 'error' ? (
            <View style={[styles.overlay, { backgroundColor: `${colors.primary}0D` }]}>
              <FontAwesome6 name="map-location-dot" size={30} color={colors.primary} solid />
              <Text style={[styles.overlayText, { color: colors.textMuted }]}>{t('location.mapUnavailable')}</Text>
            </View>
          ) : mapState === 'loading' ? (
            <View style={[styles.overlay, { backgroundColor: colors.background }]} pointerEvents="none">
              <LoadingIndicator size={34} color={colors.primary} />
              <Text style={[styles.overlayText, { color: colors.textMuted }]}>{t('location.mapLoading')}</Text>
            </View>
          ) : (
            <View style={styles.pinWrap} pointerEvents="none">
              <View style={{ transform: [{ translateY: pinLift }], alignItems: 'center' }}>
                <View style={[styles.pinHead, { backgroundColor: colors.primary }]}>
                  <FontAwesome6 name="house" size={14} color="#FFFFFF" solid />
                </View>
                <View style={[styles.pinStem, { backgroundColor: colors.primary }]} />
              </View>
              <View style={styles.pinShadow} />
            </View>
          )}

          {mapState === 'ready' ? (
            <Pressable
              style={[styles.locateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={goToMyLocation}
              disabled={locating}
              accessibilityLabel={t('location.useCurrent')}
              hitSlop={6}
            >
              {locating ? (
                <LoadingIndicator size={18} dotSize={3} color={colors.primary} />
              ) : (
                <FontAwesome6 name="location-crosshairs" size={18} color={colors.primary} solid />
              )}
            </Pressable>
          ) : null}
        </View>

        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <View style={styles.placeRow}>
            <View style={[styles.placeIcon, { backgroundColor: `${colors.primary}14` }]}>
              <FontAwesome6 name="location-dot" size={16} color={colors.primary} solid />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.placeCaption, { color: colors.textMuted }]}>{t('location.pinCaption')}</Text>
              {preview && !moving ? (
                <Text style={[styles.placeName, { color: colors.text }]} numberOfLines={2}>
                  {preview.locationName}
                </Text>
              ) : (
                <Text style={[styles.placeName, { color: colors.textMuted }]}>
                  {mapState === 'ready' ? t('location.findingPlace') : '…'}
                </Text>
              )}
            </View>
          </View>
          <Button label={t('location.confirmPlace')} onPress={confirm} disabled={!preview || moving || mapState !== 'ready'} />
        </View>
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
  webview: { flex: 1, backgroundColor: 'transparent' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  overlayText: { ...typography.body, textAlign: 'center' },
  // The pin's tip sits exactly on the map's centre point.
  pinWrap: { position: 'absolute', left: '50%', top: '50%', width: 40, marginLeft: -20, marginTop: -54, alignItems: 'center' },
  pinHead: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  pinStem: { width: 3, height: 14, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  pinShadow: { width: 12, height: 5, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.25)', marginTop: 1 },
  locateButton: {
    position: 'absolute',
    right: 16,
    bottom: 34,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 16,
    marginTop: -18,
  },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  placeCaption: { ...typography.caption, fontSize: 12 },
  placeName: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 16, marginTop: 1 },
});
