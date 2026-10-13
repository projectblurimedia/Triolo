import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { fonts, typography, useThemeColors } from '@/theme';

export interface MapPoint {
  latitude: number;
  longitude: number;
}

interface LiveMapProps {
  /** The job's location (the customer's place). */
  customer: MapPoint | null;
  /** The worker's latest position, when known. */
  worker: MapPoint | null;
  height: number;
}

// Pinned so a new MapLibre release can never change behaviour underneath us.
const MAPLIBRE_VERSION = '4.7.1';
// OpenFreeMap: free OpenStreetMap vector tiles — no account, no API key, no usage limits.
// Attribution (OpenFreeMap / OpenMapTiles / OpenStreetMap) is shown by the style itself.
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

function buildHtml(initial: MapPoint): string {
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link href="https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js"></script>
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #e8eef7; }
  .pin { width: 22px; height: 22px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.35); }
  .customer { background: #0055D3; }
  .worker { width: 26px; height: 26px; background: #16A34A; display: flex; align-items: center; justify-content: center; }
  .worker::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: #fff; }
  .pulse { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%;
           background: rgba(0,85,211,.35); animation: pulse 2s ease-out infinite; }
  @keyframes pulse { from { transform: scale(1); opacity: .9; } to { transform: scale(3.2); opacity: 0; } }
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
      center: [${initial.longitude}, ${initial.latitude}],
      zoom: 14,
      attributionControl: { compact: true },
    });
    var markers = {};
    var fittedOnce = false;
    var last = { customer: null, worker: null };

    function makeEl(kind) {
      var wrap = document.createElement('div');
      if (kind === 'customer') {
        var pulse = document.createElement('div'); pulse.className = 'pulse'; wrap.appendChild(pulse);
      }
      var pin = document.createElement('div'); pin.className = 'pin ' + kind; wrap.appendChild(pin);
      return wrap;
    }
    function place(kind, point) {
      if (!point) {
        if (markers[kind]) { markers[kind].remove(); delete markers[kind]; }
        return;
      }
      var lngLat = [point.longitude, point.latitude];
      if (!markers[kind]) {
        markers[kind] = new maplibregl.Marker({ element: makeEl(kind) }).setLngLat(lngLat).addTo(map);
      } else {
        markers[kind].setLngLat(lngLat);
      }
    }
    window.__fit = function () {
      var pts = [last.customer, last.worker].filter(Boolean);
      if (pts.length === 0) return;
      if (pts.length === 1) { map.easeTo({ center: [pts[0].longitude, pts[0].latitude], zoom: 15, duration: 600 }); return; }
      var b = new maplibregl.LngLatBounds();
      pts.forEach(function (p) { b.extend([p.longitude, p.latitude]); });
      map.fitBounds(b, { padding: 70, maxZoom: 16, duration: 600 });
    };
    window.__setPoints = function (data) {
      var first = !fittedOnce;
      var workerAppeared = !last.worker && data.worker;
      last = data;
      place('customer', data.customer);
      place('worker', data.worker);
      if (first || workerAppeared) { fittedOnce = true; window.__fit(); }
    };
    map.on('load', function () { post({ type: 'ready' }); });
    map.on('error', function (e) { if (!map.loaded()) post({ type: 'error' }); });
  }
</script></body></html>`;
}

/**
 * The live job map — MapLibre GL JS with free OpenStreetMap tiles (OpenFreeMap) inside a
 * WebView: no Google account, card or API key. Shows the job's location (blue, pulsing) and
 * the worker (green); fits both on first load and when the worker first appears, then lets the
 * user pan freely (the button re-centres). Points update in place via injected JS — the page
 * is never reloaded. If the device can't draw it (no WebGL / offline), a plain fallback card
 * shows instead; the rest of the tracking screen never depends on the map.
 */
export function LiveMap({ customer, worker, height }: LiveMapProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const webViewRef = useRef<WebView>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // The page is built once, centred on whichever point is known first.
  const initialCenter = useRef<MapPoint | null>(customer ?? worker);
  if (!initialCenter.current) initialCenter.current = customer ?? worker;
  const html = useMemo(
    () => (initialCenter.current ? buildHtml(initialCenter.current) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialCenter.current !== null],
  );

  const pointsJson = JSON.stringify({ customer, worker });
  useEffect(() => {
    if (status !== 'ready') return;
    webViewRef.current?.injectJavaScript(`window.__setPoints && window.__setPoints(${pointsJson}); true;`);
  }, [pointsJson, status]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type: string };
      if (message.type === 'ready') setStatus('ready');
      if (message.type === 'error') setStatus('error');
    } catch {
      // Ignore anything that isn't ours.
    }
  };

  if (!html || status === 'error') {
    return (
      <View style={[styles.fallback, { height, backgroundColor: `${colors.primary}0D`, borderColor: colors.border }]}>
        <FontAwesome6 name="map-location-dot" size={26} color={colors.primary} solid />
        <Text style={[styles.fallbackText, { color: colors.textMuted }]}>{t('liveMap.unavailable')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        source={{ html, baseUrl: 'https://localhost/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        onError={() => setStatus('error')}
        style={styles.webview}
        // The map handles its own pan/zoom gestures.
        nestedScrollEnabled
        overScrollMode="never"
        setSupportMultipleWindows={false}
      />
      {status === 'loading' ? (
        <View style={[styles.loadingOverlay, { backgroundColor: `${colors.primary}0D` }]} pointerEvents="none">
          <FontAwesome6 name="map" size={22} color={colors.primary} solid />
          <Text style={[styles.fallbackText, { color: colors.textMuted }]}>{t('liveMap.loading')}</Text>
        </View>
      ) : null}
      {status === 'ready' ? (
        <Pressable
          style={[styles.recenter, { backgroundColor: colors.surface }]}
          onPress={() => webViewRef.current?.injectJavaScript('window.__fit && window.__fit(); true;')}
          accessibilityLabel={t('liveMap.recenter')}
          hitSlop={6}
        >
          <FontAwesome6 name="location-crosshairs" size={16} color={colors.primary} solid />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 8 },
  fallback: { alignItems: 'center', justifyContent: 'center', gap: 8, borderBottomWidth: 1 },
  fallbackText: { ...typography.caption, fontFamily: fonts.medium, textAlign: 'center', paddingHorizontal: 24 },
  recenter: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
