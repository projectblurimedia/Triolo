import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Linking, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { create } from 'zustand';
import { Ad, adsService } from '@/services/adsService';
import { useAuthStore } from '@/state/authStore';
import { useLocationStore } from '@/state/locationStore';
import { fonts, headerGradient, typography } from '@/theme';
import { SmartImage } from './SmartImage';

/*
 * (Copied between user-app and partner-app — keep in sync. Only `AD_APP` in adsService differs.)
 *
 * Local businesses' ads, booked by the Triolo admin: one image or one video, vertical (a reel
 * or poster, 9:16) or horizontal (16:9), with an optional link. Shown full screen:
 *  - once when the app opens (`AdLaunchBanner`), and
 *  - before key actions (`showAdBefore`: the customer app's quick actions; the partner app's
 *    Mark Work Done and order handover), the action going ahead once the ad is closed.
 * An ad can only be closed after its time — an image's set seconds, or the whole video — and
 * a progress bar shows how long is left. Tapping it (or Visit) opens its link, if it has one. Ads are local,
 * so nothing is asked for until the device location is known; each is admin-switchable.
 */

// How long a key action waits for an ad before going ahead without one.
const ACTION_AD_WAIT_MS = 2500;
// If the picture / video hasn't started by then, the timer starts anyway.
const MEDIA_START_FALLBACK_MS = 8000;

/** The device position once it's known (location on and allowed), else null. */
function readyCoords(state: ReturnType<typeof useLocationStore.getState>) {
  return state.status === 'ready' && state.latitude != null && state.longitude != null
    ? { latitude: state.latitude, longitude: state.longitude }
    : null;
}

function useReadyCoords(): { latitude: number; longitude: number } | null {
  const latitude = useLocationStore((state) => (state.status === 'ready' ? state.latitude : null));
  const longitude = useLocationStore((state) => (state.status === 'ready' ? state.longitude : null));
  return latitude != null && longitude != null ? { latitude, longitude } : null;
}

/** Opens the ad's link (and counts the open). */
function openAdLink(ad: Ad) {
  if (!ad.linkUrl) return;
  adsService.recordOpen(ad.id);
  Linking.openURL(ad.linkUrl).catch(() => undefined);
}

// A tiny page around one <video>: plays by itself (muted to start, looping), takes commands
// from the app (mute / unmute), and tells the app when it starts playing or fails. The app's
// WebView (already used for maps) plays it, so no new APK is needed.
function videoPage(url: string): string {
  const src = JSON.stringify(url);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}video{width:100%;height:100%;object-fit:contain;background:#000}</style>
</head><body><video id="v" autoplay muted playsinline loop></video><script>
var v=document.getElementById('v');v.muted=true;v.defaultMuted=true;v.src=${src};
function send(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(m)}
var started=false;v.addEventListener('playing',function(){if(!started){started=true;send('playing')}});
v.addEventListener('error',function(){send('error')});
var p=v.play();if(p&&p.catch)p.catch(function(){send('error')});
window.__cmd=function(c){if(c==='mute')v.muted=true;else if(c==='unmute'){v.muted=false;v.volume=1;if(v.paused)v.play()}};
</script></body></html>`;
}

function AdVideo({
  url,
  width,
  height,
  muted,
  onStart,
}: {
  url: string;
  width: number;
  height: number;
  muted: boolean;
  /** It started playing (or failed) — the ad's timer can run. */
  onStart: () => void;
}) {
  const webview = useRef<WebView>(null);
  const loaded = useRef(false);
  const [html] = useState(() => videoPage(url));

  useEffect(() => {
    if (loaded.current) webview.current?.injectJavaScript(`window.__cmd&&window.__cmd('${muted ? 'mute' : 'unmute'}');true;`);
  }, [muted]);

  return (
    // Touches go to the ad around it (open its link), never to the video.
    <View style={{ width, height, backgroundColor: '#000' }} pointerEvents="none">
      <WebView
        ref={webview}
        source={{ html, baseUrl: 'https://triolo.app/' }}
        originWhitelist={['*']}
        style={{ width, height, backgroundColor: '#000' }}
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        scrollEnabled={false}
        onLoadEnd={() => {
          loaded.current = true;
        }}
        onMessage={(event) => {
          if (event.nativeEvent.data === 'playing' || event.nativeEvent.data === 'error') onStart();
        }}
        onError={onStart}
      />
    </View>
  );
}

/**
 * One full-screen ad. Vertical ads fill a tall reel-shaped card; horizontal ones a wide card,
 * each over a backdrop made from the ad itself. A bar fills over the ad's time; only then do
 * ✕ and Continue / Close appear. Tapping the ad or Visit opens its link.
 */
function AdPlayer({ ad, mode, onClose }: { ad: Ad; mode: 'launch' | 'action'; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(ad.durationSeconds);
  const progress = useRef(new Animated.Value(0)).current;
  const vertical = ad.orientation === 'vertical';
  const imageUrl = ad.imageUrl ?? ad.imageUrls?.[0] ?? null;

  // The card's size: as big as fits, keeping the ad's own shape.
  const room = { width: screenWidth - 32, height: screenHeight - insets.top - insets.bottom - 170 };
  const cardWidth = vertical ? Math.min(room.width, (room.height * 9) / 16) : room.width;
  const cardHeight = vertical ? (cardWidth * 16) / 9 : Math.min((cardWidth * 9) / 16, room.height);

  const start = () => setStarted(true);

  // Never wait forever for slow media: the timer starts on its own after a while.
  useEffect(() => {
    const timer = setTimeout(start, MEDIA_START_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, []);

  // The countdown, and the bar filling over the ad's time.
  useEffect(() => {
    if (!started) return;
    const total = Math.max(1, ad.durationSeconds);
    Animated.timing(progress, { toValue: 1, duration: total * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    const begun = Date.now();
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil(total - (Date.now() - begun) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(tick);
        setDone(true);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [started, ad.durationSeconds, progress]);

  const media = ad.videoUrl ? (
    <AdVideo url={ad.videoUrl} width={cardWidth} height={cardHeight} muted={muted} onStart={start} />
  ) : imageUrl ? (
    <View style={{ width: cardWidth, height: cardHeight }}>
      <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={22} />
      <View style={[StyleSheet.absoluteFill, styles.dim]} />
      <SmartImage
        source={{ uri: imageUrl }}
        style={{ width: cardWidth, height: cardHeight }}
        resizeMode="contain"
        onLoad={start}
        onError={start}
      />
    </View>
  ) : (
    <LinearGradient colors={headerGradient} style={[{ width: cardWidth, height: cardHeight }, styles.center]}>
      <FontAwesome6 name="bullhorn" size={40} color="#FFFFFF" solid />
    </LinearGradient>
  );

  const visit = (
    <Pressable onPress={() => openAdLink(ad)} style={styles.visitButton} accessibilityRole="link" hitSlop={6}>
      <Text style={styles.visitText}>{t('ads.visit')}</Text>
      <FontAwesome6 name="arrow-up-right-from-square" size={12} color="#0C0F14" solid />
    </Pressable>
  );

  const who = (
    <View style={styles.whoText}>
      <Text style={styles.whoName} numberOfLines={1}>
        {ad.advertiserName}
      </Text>
      {ad.locationText ? (
        <Text style={styles.whoPlace} numberOfLines={1}>
          {ad.locationText}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      // The phone's back button closes it only once its time is up.
      onRequestClose={() => done && onClose()}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.screen}>
        {/* The backdrop is the ad itself, blurred, so every ad gets its own colours. */}
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={40} />
        ) : null}
        <View style={[StyleSheet.absoluteFill, styles.backdropDim]} />

        <View style={[styles.stage, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
          {/* Top row: the time left, and ✕ once it's up. */}
          <View style={[styles.topRow, { width: cardWidth }]}>
            <View style={styles.sponsored}>
              <FontAwesome6 name="bullhorn" size={10} color="#FFFFFF" solid />
              <Text style={styles.sponsoredText}>{t('ads.tag')}</Text>
            </View>
            {done ? (
              <Pressable
                onPress={onClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                hitSlop={10}
              >
                <FontAwesome6 name="xmark" size={16} color="#FFFFFF" solid />
              </Pressable>
            ) : (
              <View style={styles.countdown} accessibilityLabel={t('ads.closeAfter', { count: secondsLeft })}>
                <Text style={styles.countdownText}>{secondsLeft}</Text>
              </View>
            )}
          </View>
          <View style={[styles.track, { width: cardWidth }]}>
            <Animated.View
              style={[styles.fill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
            />
          </View>

          {/* The ad. */}
          <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>
            <Pressable
              onPress={() => openAdLink(ad)}
              disabled={!ad.linkUrl}
              accessibilityRole={ad.linkUrl ? 'link' : undefined}
              accessibilityLabel={ad.advertiserName}
            >
              {media}
            </Pressable>
            {ad.videoUrl ? (
              <Pressable
                onPress={() => setMuted((value) => !value)}
                style={[styles.muteButton, vertical ? { top: 12 } : { bottom: 12 }]}
                accessibilityRole="button"
                accessibilityLabel={muted ? t('ads.unmute') : t('ads.mute')}
                hitSlop={8}
              >
                <FontAwesome6 name={muted ? 'volume-xmark' : 'volume-high'} size={15} color="#FFFFFF" solid />
              </Pressable>
            ) : null}
            {vertical ? (
              // On a reel the name and Visit sit over the bottom of the picture.
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.78)']} style={styles.reelFooter} pointerEvents="box-none">
                {who}
                {ad.linkUrl ? visit : null}
              </LinearGradient>
            ) : null}
          </View>

          {!vertical ? (
            <View style={[styles.wideFooter, { width: cardWidth }]}>
              {who}
              {ad.linkUrl ? visit : null}
            </View>
          ) : null}

          {/* Once the time is up: the way out (and on to the action). */}
          <View style={[styles.after, { width: cardWidth }]}>
            {done ? (
              <Pressable onPress={onClose} accessibilityRole="button" style={styles.continueButton}>
                <Text style={styles.continueText}>{mode === 'action' ? t('ads.continue') : t('common.close')}</Text>
                {mode === 'action' ? <FontAwesome6 name="arrow-right" size={13} color="#FFFFFF" solid /> : null}
              </Pressable>
            ) : (
              <Text style={styles.waitText}>{t('ads.closeAfter', { count: secondsLeft })}</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * The ad shown once each time the app opens (when the admin has it switched on). `hold` keeps
 * it back while something more important is on screen (the partner app's new job request).
 */
export function AdLaunchBanner({ hold = false }: { hold?: boolean }) {
  const signedIn = useAuthStore((state) => !!state.accessToken && !state.isCompletingRegistration);
  const coords = useReadyCoords();
  const [ad, setAd] = useState<Ad | null>(null);
  const [closed, setClosed] = useState(false);
  // A ref, not state: changing state here re-ran the effect, whose cleanup cancelled the timer.
  const requested = useRef(false);

  // Once per app launch, as soon as the user is signed in and their location is known.
  useEffect(() => {
    if (!signedIn || !coords || requested.current) return;
    requested.current = true;
    const here = coords;
    setTimeout(() => {
      adsService
        .serve('launch', here)
        .then(setAd)
        .catch(() => undefined);
    }, 700);
  }, [signedIn, coords]);

  if (!ad || closed || !signedIn || hold) return null;
  return <AdPlayer ad={ad} mode="launch" onClose={() => setClosed(true)} />;
}

// --- Ads before key actions ---

interface ActionAdState {
  ad: Ad | null;
  then: (() => void) | null;
}

const useActionAd = create<ActionAdState>(() => ({ ad: null, then: null }));
let actionPending = false;

/**
 * Runs `action` after an ad, when one is running nearby and ads before key actions are on;
 * otherwise straight away. Never holds the action up for long: if no ad arrives quickly, the
 * action just goes ahead.
 */
export function showAdBefore(action: () => void): void {
  const here = readyCoords(useLocationStore.getState());
  if (!here || actionPending || useActionAd.getState().ad) {
    action();
    return;
  }
  actionPending = true;
  let settled = false;
  const goAhead = () => {
    if (settled) return;
    settled = true;
    actionPending = false;
    action();
  };
  const waited = setTimeout(goAhead, ACTION_AD_WAIT_MS);
  adsService
    .serve('action', here)
    .then((ad) => {
      if (settled) return;
      clearTimeout(waited);
      if (!ad) {
        goAhead();
        return;
      }
      settled = true;
      actionPending = false;
      useActionAd.setState({ ad, then: action });
    })
    .catch(() => {
      clearTimeout(waited);
      goAhead();
    });
}

/** Mounted once at the app root: shows the ad `showAdBefore` found, then runs the action. */
export function AdActionHost() {
  const ad = useActionAd((state) => state.ad);
  if (!ad) return null;
  return (
    <AdPlayer
      key={ad.id}
      ad={ad}
      mode="action"
      onClose={() => {
        const { then } = useActionAd.getState();
        useActionAd.setState({ ad: null, then: null });
        // Let the ad fade out before the next screen or popup opens.
        setTimeout(() => then?.(), 250);
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  dim: { backgroundColor: 'rgba(0,0,0,0.15)' },
  screen: { flex: 1, backgroundColor: '#05070B' },
  backdropDim: { backgroundColor: 'rgba(5,7,11,0.72)' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sponsored: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  sponsoredText: { ...typography.caption, fontFamily: fonts.semiBold, color: '#FFFFFF', fontSize: 11 },
  countdown: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF', includeFontPadding: false },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  fill: { height: 3, backgroundColor: '#FFFFFF' },
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  muteButton: {
    position: 'absolute',
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 40,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wideFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  whoText: { flex: 1 },
  whoName: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  whoPlace: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
  visitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  visitText: { ...typography.caption, fontFamily: fonts.semiBold, color: '#0C0F14', fontSize: 13 },
  after: { height: 48, alignItems: 'center', justifyContent: 'center' },
  continueButton: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  waitText: { ...typography.caption, color: 'rgba(255,255,255,0.7)' },
});
