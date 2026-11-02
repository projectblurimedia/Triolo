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
  /** The worker's (or delivery person's) latest position, when known. */
  worker: MapPoint | null;
  height: number;
  /** Who is moving: a worker on a bike (bookings) or a shop delivery (orders). */
  mover?: 'worker' | 'delivery';
  /** Shown above each pin: "You", or the other person's first name. */
  customerLabel?: string;
  moverLabel?: string;
}

// Pinned so a new MapLibre release can never change behaviour underneath us.
const MAPLIBRE_VERSION = '4.7.1';
// OpenFreeMap: free OpenStreetMap vector tiles — no account, no API key, no usage limits.
// Attribution (OpenFreeMap / OpenMapTiles / OpenStreetMap) is shown by the style itself.
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
/** Within this distance the line under the map says "almost here" (the backend also notifies). */
const NEAR_METRES = 100;

/** Straight-line distance in metres. */
function metresBetween(a: MapPoint, b: MapPoint): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatMetres(m: number): string {
  return m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(1)} km`;
}

// The moving pin's icon (Font Awesome 6 solid, as inline SVG — no icon font to load in the page).
const MOVER_ICONS = {
  // motorcycle
  worker:
    '<svg viewBox="0 0 640 512"><path fill="#fff" d="M280 32c-13.3 0-24 10.7-24 24s10.7 24 24 24h57.7l16.4 30.3L256 192l-45.3-45.3c-12-12-28.3-18.7-45.3-18.7H64c-17.7 0-32 14.3-32 32v32h96c88.4 0 160 71.6 160 160c0 11-1.1 21.7-3.2 32h70.4c-2.1-10.3-3.2-21-3.2-32c0-52.2 25-98.6 63.7-127.8l15.4 28.6C402.4 276.3 384 312 384 352c0 70.7 57.3 128 128 128s128-57.3 128-128s-57.3-128-128-128c-13.5 0-26.5 2.1-38.7 6L418.2 128H480c17.7 0 32-14.3 32-32V64c0-17.7-14.3-32-32-32H459.6c-7.5 0-14.7 2.6-20.5 7.4L391.7 78.9l-14-26c-7-12.9-20.5-21-35.2-21H280zM462.7 311.2l28.2 52.2c6.3 11.7 20.9 16 32.5 9.7s16-20.9 9.7-32.5l-28.2-52.2c2.3-.3 4.7-.4 7.1-.4c35.3 0 64 28.7 64 64s-28.7 64-64 64s-64-28.7-64-64c0-15.5 5.5-29.7 14.7-40.8zM187.3 376c-9.5 23.5-32.5 40-59.3 40c-35.3 0-64-28.7-64-64s28.7-64 64-64c26.9 0 49.9 16.5 59.3 40h66.4C242.5 268.8 190.5 224 128 224C57.3 224 0 281.3 0 352s57.3 128 128 128c62.5 0 114.5-44.8 125.8-104H187.3zM128 384a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"/></svg>',
  // truck-fast
  delivery:
    '<svg viewBox="0 0 640 512"><path fill="#fff" d="M112 0C85.5 0 64 21.5 64 48V96H16c-8.8 0-16 7.2-16 16s7.2 16 16 16H64 272c8.8 0 16 7.2 16 16s-7.2 16-16 16H64 48c-8.8 0-16 7.2-16 16s7.2 16 16 16H64 240c8.8 0 16 7.2 16 16s-7.2 16-16 16H64 16c-8.8 0-16 7.2-16 16s7.2 16 16 16H64 208c8.8 0 16 7.2 16 16s-7.2 16-16 16H64V416c0 53 43 96 96 96s96-43 96-96H384c0 53 43 96 96 96s96-43 96-96h32c17.7 0 32-14.3 32-32s-14.3-32-32-32V288 256 237.3c0-17-6.7-33.3-18.7-45.3L512 114.7c-12-12-28.3-18.7-45.3-18.7H416V48c0-26.5-21.5-48-48-48H112zM544 237.3V256H416V160h50.7L544 237.3zM160 368a48 48 0 1 1 0 96 48 48 0 1 1 0-96zm272 48a48 48 0 1 1 96 0 48 48 0 1 1 -96 0z"/></svg>',
};
// A person (the customer).
const HOME_ICON =
  '<svg viewBox="0 0 448 512"><path fill="#fff" d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"/></svg>';

function buildHtml(initial: MapPoint, mover: 'worker' | 'delivery'): string {
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link href="https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js"></script>
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #e8eef7; }
  .pin { width: 30px; height: 30px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.35);
         display: flex; align-items: center; justify-content: center; }
  .pin svg { width: 15px; height: 15px; }
  .customer { background: #0055D3; }
  /* The worker on a bike / the shop's delivery: bigger, green, with a little pointer below. */
  .worker { width: 38px; height: 38px; background: #16A34A; position: relative; }
  .worker svg { width: 22px; height: 22px; }
  .worker::after { content: ''; position: absolute; bottom: -9px; left: 50%; margin-left: -6px; border: 6px solid transparent;
                   border-top-color: #16A34A; }
  .pulse { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%;
           background: rgba(0,85,211,.35); animation: pulse 2s ease-out infinite; }
  @keyframes pulse { from { transform: scale(1); opacity: .9; } to { transform: scale(3.2); opacity: 0; } }
  .maplibregl-ctrl-attrib { font-size: 9px; }
  /* The name above a pin ("You" / a first name): it never changes where the pin sits. */
  .tag { position: absolute; left: 50%; bottom: calc(100% + 8px); transform: translateX(-50%); white-space: nowrap;
         background: #fff; color: #0f172a; font: 600 11px/1 -apple-system, Roboto, sans-serif; padding: 5px 8px;
         border-radius: 999px; box-shadow: 0 2px 6px rgba(0,0,0,.25); max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
  .tag:empty { display: none; }
  .tag.me { background: #0055D3; color: #fff; }
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
    var HOME = '${HOME_ICON}';
    var MOVER = '${MOVER_ICONS[mover]}';
    var markers = {};
    var tags = {};
    var fittedOnce = false;
    var last = { customer: null, worker: null };

    function makeEl(kind) {
      var wrap = document.createElement('div'); wrap.className = 'wrap';
      var tag = document.createElement('div'); tag.className = 'tag'; wrap.appendChild(tag);
      tags[kind] = tag;
      if (kind === 'customer') {
        var pulse = document.createElement('div'); pulse.className = 'pulse'; wrap.appendChild(pulse);
      }
      var pin = document.createElement('div'); pin.className = 'pin ' + kind;
      pin.innerHTML = kind === 'customer' ? HOME : MOVER;
      wrap.appendChild(pin);
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
      var labels = data.labels || {};
      ['customer', 'worker'].forEach(function (k) {
        if (!tags[k]) return;
        tags[k].textContent = labels[k] || '';
        tags[k].className = 'tag' + (labels[k] && labels[k] === labels.me ? ' me' : '');
      });
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
export function LiveMap({ customer, worker, height, mover = 'worker', customerLabel, moverLabel }: LiveMapProps) {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const webViewRef = useRef<WebView>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // The page is built once, centred on whichever point is known first.
  const initialCenter = useRef<MapPoint | null>(customer ?? worker);
  if (!initialCenter.current) initialCenter.current = customer ?? worker;
  const html = useMemo(
    () => (initialCenter.current ? buildHtml(initialCenter.current, mover) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialCenter.current !== null],
  );

  // "You" is drawn in blue so it stands out from the other person's name.
  const pointsJson = JSON.stringify({
    customer,
    worker,
    labels: { customer: customerLabel ?? '', worker: moverLabel ?? '', me: t('liveMap.you') },
  });
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

  // Under the map: how far the worker / delivery is from the customer.
  const metres = customer && worker ? metresBetween(customer, worker) : null;
  const isMe = moverLabel === t('liveMap.you');
  const near = metres !== null && metres <= NEAR_METRES;
  const distanceText =
    metres === null
      ? null
      : near
        ? t(isMe ? 'liveMap.youAlmostThere' : 'liveMap.almostHere', { name: moverLabel || t('liveMap.someone') })
        : t(isMe ? 'liveMap.youAway' : 'liveMap.away', { name: moverLabel || t('liveMap.someone'), distance: formatMetres(metres) });

  return (
    <View>
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
    {distanceText ? (
      <View style={[styles.distance, { backgroundColor: near ? '#16A34A' : colors.surface, borderColor: near ? '#16A34A' : colors.border }]}>
        <FontAwesome6 name={near ? 'location-dot' : mover === 'delivery' ? 'truck-fast' : 'motorcycle'} size={14} color={near ? '#FFFFFF' : '#16A34A'} solid />
        <Text style={[styles.distanceText, { color: near ? '#FFFFFF' : colors.text }]} numberOfLines={1}>
          {distanceText}
        </Text>
      </View>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  distance: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, height: 44, borderBottomWidth: 1 },
  distanceText: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 14, flex: 1 },
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
