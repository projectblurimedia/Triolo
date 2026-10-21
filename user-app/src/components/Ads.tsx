import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { create } from 'zustand';
import { Ad, AdPromoted, AdPromotedCard, AdSpot, adsService } from '@/services/adsService';
import { useLocationStore } from '@/state/locationStore';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';
import { LoadingIndicator } from './LoadingIndicator';
import { SmartImage } from './SmartImage';

/*
 * (Copied between user-app and partner-app — keep in sync. Only `AD_APP` in adsService differs.)
 *
 * Local businesses' ads, booked by the Triolo admin: one image or one video, vertical (a reel
 * or poster, 9:16) or horizontal (16:9), with an optional link. Shown full screen only before
 * key actions (`showAdBefore` / `adThen` / `useAdGate` with the action's spot — the
 * customer app's Book Nearby, booking a worker, sending a list, posting a problem, Hire Staff
 * search; the partner app's Mark Work Done and order PIN), the action going ahead once the ad
 * is closed. The admin switches each spot on or off and sets a minimum gap between ads. There
 * is no ad when an app opens any more, and none during a flow started from an ad's own button.
 * An ad can only be closed after its time — an image's set seconds, or the whole video — and
 * a progress bar shows how long is left. Tapping it (or Visit) opens its link, if it has one. Ads are local,
 * so nothing is asked for until the device location is known; each is admin-switchable.
 *
 * The time only runs while the app is on screen: in the background (or while the ad's link is
 * open) the timer, the bar and the video all pause, and carry on when the person comes back —
 * so leaving the app is never a way round watching it.
 */

// How long a key action waits for an ad before going ahead without one.
const ACTION_AD_WAIT_MS = 2500;
// If the picture / video hasn't started by then, the timer starts anyway.
const MEDIA_START_FALLBACK_MS = 8000;
// A picture gets this long to load before the ad shows, so it doesn't open on a blank card.
const IMAGE_PRELOAD_MS = 1500;

/** Whether the app is on screen (not in the background, not behind another app). */
function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  return active;
}

/** Waits (briefly) for a picture ad's image, so it opens already drawn. */
function preload(ad: Ad): Promise<void> {
  const url = ad.videoUrl ? null : (ad.imageUrl ?? ad.imageUrls?.[0] ?? ad.promotedCard?.photoUrl ?? null);
  if (!url) return Promise.resolve();
  return Promise.race([
    Image.prefetch(url).then(
      () => undefined,
      () => undefined,
    ),
    new Promise<void>((resolve) => setTimeout(resolve, IMAGE_PRELOAD_MS)),
  ]);
}

/** The device position once it's known (location on and allowed), else null. */
function readyCoords(state: ReturnType<typeof useLocationStore.getState>) {
  return state.status === 'ready' && state.latitude != null && state.longitude != null
    ? { latitude: state.latitude, longitude: state.longitude }
    : null;
}

/**
 * Opens a promoted profile in this app (Book Now / Order from this Shop / Contact). Each app
 * registers what it can open: the customer app all three, the partner app only Contact.
 */
type AdPromotionHandler = (promoted: AdPromoted) => void;
let promotionHandler: { open: AdPromotionHandler; kinds: AdPromoted['kind'][] } | null = null;

export function setAdPromotionHandler(open: AdPromotionHandler | null, kinds: AdPromoted['kind'][] = []): void {
  promotionHandler = open ? { open, kinds } : null;
}

type IconName = React.ComponentProps<typeof FontAwesome6>['name'];

const TEAL = ['#0D9488', '#2DD4BF'] as const;
const CALL_GRADIENT = ['#16A34A', '#22C55E'] as const;

/** Each kind of promoted profile has its own colour, icon and tag. */
const KIND_LOOK: Record<AdPromoted['kind'], { gradient: readonly [string, string]; icon: IconName; labelKey: string }> = {
  service: { gradient: headerGradient, icon: 'screwdriver-wrench', labelKey: 'ads.kindWorker' },
  business: { gradient: ['#16A34A', '#22C55E'], icon: 'store', labelKey: 'ads.kindShop' },
  job_post: { gradient: ['#7C3AED', '#A78BFA'], icon: 'user-tie', labelKey: 'ads.kindJob' },
};

/** The ad's button: what tapping the ad (or the button) does. */
interface AdCta {
  labelKey: string;
  icon: IconName;
  gradient: readonly [string, string];
  /** Opens a screen in this app: the ad closes first (without going on to the action). */
  inApp: boolean;
  run: () => void;
}

/** Null when the ad just promotes (nothing happens on a tap). */
function adCta(ad: Ad): AdCta | null {
  const type = ad.actionType ?? (ad.linkUrl ? 'link' : 'none');
  const counted = (run: () => void) => () => {
    adsService.recordOpen(ad.id);
    run();
  };
  if (type === 'link' && ad.linkUrl) {
    const url = ad.linkUrl;
    return {
      labelKey: 'ads.visit',
      icon: 'arrow-up-right-from-square',
      gradient: headerGradient,
      inApp: false,
      run: counted(() => Linking.openURL(url).catch(() => undefined)),
    };
  }
  if (type === 'location' && ad.destination) {
    const { latitude, longitude } = ad.destination;
    return {
      labelKey: 'ads.directions',
      icon: 'diamond-turn-right',
      gradient: TEAL,
      inApp: false,
      run: counted(() =>
        Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`).catch(() => undefined),
      ),
    };
  }
  const promoted = ad.promoted;
  const handler = promotionHandler;
  if (promoted && handler && handler.kinds.includes(promoted.kind)) {
    const look: Record<AdPromoted['kind'], { labelKey: string; icon: IconName }> = {
      service: { labelKey: 'ads.bookNow', icon: 'calendar-check' },
      business: { labelKey: 'ads.orderShop', icon: 'basket-shopping' },
      job_post: { labelKey: 'ads.contact', icon: 'phone' },
    };
    return {
      ...look[promoted.kind],
      gradient: KIND_LOOK[promoted.kind].gradient,
      inApp: true,
      run: counted(() => handler.open(promoted)),
    };
  }
  return null;
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
var held=false;
window.__cmd=function(c){if(c==='mute')v.muted=true;else if(c==='unmute'){v.muted=false;v.volume=1;if(v.paused&&!held)v.play()}
else if(c==='pause'){held=true;v.pause()}else if(c==='play'){held=false;v.play()}};
</script></body></html>`;
}

function AdVideo({
  url,
  width,
  height,
  muted,
  paused,
  onStart,
}: {
  url: string;
  width: number;
  height: number;
  muted: boolean;
  /** The app is in the background: the video stops until it's back. */
  paused: boolean;
  /** It started playing (or failed) — the ad's timer can run. */
  onStart: () => void;
}) {
  const webview = useRef<WebView>(null);
  const loaded = useRef(false);
  const [html] = useState(() => videoPage(url));

  useEffect(() => {
    if (loaded.current) webview.current?.injectJavaScript(`window.__cmd&&window.__cmd('${muted ? 'mute' : 'unmute'}');true;`);
  }, [muted]);

  useEffect(() => {
    if (loaded.current) webview.current?.injectJavaScript(`window.__cmd&&window.__cmd('${paused ? 'pause' : 'play'}');true;`);
  }, [paused]);

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
          if (paused) webview.current?.injectJavaScript(`window.__cmd&&window.__cmd('pause');true;`);
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
/** How many ads are on screen right now (0 or 1) — the app waits before restarting for an update. */
const useAdsOnScreen = create<{ count: number }>(() => ({ count: 0 }));

/** True while an ad is on screen. */
export function useAdOnScreen(): boolean {
  return useAdsOnScreen((state) => state.count > 0);
}

function AdPlayer({
  ad,
  mode,
  onClose,
  onLeave,
}: {
  ad: Ad;
  mode: 'action';
  onClose: () => void;
  /** Closes the ad without going on to the action (its button opened a profile instead). */
  onLeave: () => void;
}) {
  useEffect(() => {
    useAdsOnScreen.setState((state) => ({ count: state.count + 1 }));
    return () => useAdsOnScreen.setState((state) => ({ count: Math.max(0, state.count - 1) }));
  }, []);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(ad.durationSeconds);
  const progress = useRef(new Animated.Value(0)).current;
  const active = useAppActive();
  // Milliseconds of the ad already watched (kept while the app is in the background).
  const watched = useRef(0);
  const vertical = ad.orientation === 'vertical';
  const imageUrl = ad.imageUrl ?? ad.imageUrls?.[0] ?? null;
  // A Triolo Partner profile ad has no picture or video: it shows the profile as a card.
  const profile: AdPromotedCard | null =
    ad.promoted && !ad.videoUrl && !imageUrl
      ? (ad.promotedCard ?? {
          kind: ad.promoted.kind,
          name: ad.promoted.name,
          photoUrl: null,
          tags: [],
          customTags: [],
          headline: null,
          ratingAverage: null,
          ratingCount: 0,
          experienceYears: null,
          deliveryAvailable: null,
          payAmount: null,
          payPeriod: null,
          placeName: null,
        })
      : null;

  // The card's size: as big as fits, keeping the ad's own shape.
  const room = { width: screenWidth - 32, height: screenHeight - insets.top - insets.bottom - 170 };
  const cardWidth = vertical ? Math.min(room.width, (room.height * 9) / 16) : room.width;
  const cardHeight = vertical ? (cardWidth * 16) / 9 : Math.min((cardWidth * 9) / 16, room.height);

  const start = () => setStarted(true);

  // A profile card has nothing to load: its time starts at once.
  useEffect(() => {
    if (profile) start();
  }, []);

  // Never wait forever for slow media: the timer starts on its own after a while (on screen).
  useEffect(() => {
    if (started || !active) return;
    const timer = setTimeout(start, MEDIA_START_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [started, active]);

  // The countdown and the bar, running only while the app is on screen: going to the
  // background pauses them where they are, coming back carries on from there.
  useEffect(() => {
    if (!started || done || !active) return;
    const total = Math.max(1, ad.durationSeconds) * 1000;
    const before = watched.current;
    const begun = Date.now();
    Animated.timing(progress, {
      toValue: 1,
      duration: Math.max(0, total - before),
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    const tick = setInterval(() => {
      const seen = before + (Date.now() - begun);
      setSecondsLeft(Math.max(0, Math.ceil((total - seen) / 1000)));
      if (seen >= total) {
        clearInterval(tick);
        progress.setValue(1);
        setDone(true);
      }
    }, 250);
    return () => {
      clearInterval(tick);
      watched.current = Math.min(total, before + (Date.now() - begun));
      progress.stopAnimation();
    };
  }, [started, done, active, ad.durationSeconds, progress]);

  const media = ad.videoUrl ? (
    <AdVideo url={ad.videoUrl} width={cardWidth} height={cardHeight} muted={muted} paused={!active} onStart={start} />
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

  const cta = adCta(ad);
  const runCta = () => {
    if (!cta) return;
    if (cta.inApp) {
      // The profile opens once the ad has gone (no screen can show over it), and its booking /
      // order / contact steps then show no more ads.
      startAdFreeFlow();
      onLeave();
      setTimeout(cta.run, 300);
    } else {
      cta.run();
    }
  };
  const visit = cta ? (
    <Pressable onPress={runCta} accessibilityRole="button" hitSlop={6}>
      <LinearGradient colors={cta.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.visitButton}>
        <FontAwesome6 name={cta.icon} size={13} color="#FFFFFF" solid />
        <Text style={styles.visitText}>{t(cta.labelKey)}</Text>
      </LinearGradient>
    </Pressable>
  ) : null;

  // The business's number, as a Call Now button (the number itself isn't shown). Profile ads
  // have their own Book Now / Order / Contact button instead.
  const call = ad.contactPhone ? (
    <Pressable
      onPress={() => {
        adsService.recordOpen(ad.id);
        Linking.openURL(`tel:${ad.contactPhone}`).catch(() => undefined);
      }}
      accessibilityRole="button"
      accessibilityLabel={t('ads.callNow')}
      hitSlop={6}
    >
      <LinearGradient colors={CALL_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.visitButton}>
        <FontAwesome6 name="phone-volume" size={13} color="#FFFFFF" solid />
        <Text style={styles.visitText}>{t('ads.callNow')}</Text>
      </LinearGradient>
    </Pressable>
  ) : null;
  const buttons =
    call || visit ? (
      <View style={styles.ctaStack}>
        {call}
        {visit}
      </View>
    ) : null;

  const who = (
    <View style={styles.whoText}>
      <Text style={styles.whoName} numberOfLines={1}>
        {ad.advertiserName}
      </Text>
      {ad.description ? (
        <Text style={styles.whoWords} numberOfLines={3}>
          {ad.description}
        </Text>
      ) : null}
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
        {imageUrl || profile?.photoUrl ? (
          <Image
            source={{ uri: (imageUrl ?? profile?.photoUrl) as string }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            blurRadius={40}
          />
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

          {/* The ad: a profile card, or the picture / video. */}
          {profile ? <ProfileAdCard card={profile} words={ad.description} width={cardWidth} cta={cta} onCta={runCta} /> : null}
          {profile ? null : (
          <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>
            <Pressable
              onPress={runCta}
              disabled={!cta}
              accessibilityRole={cta ? 'button' : undefined}
              accessibilityLabel={ad.advertiserName}
            >
              {media}
            </Pressable>
            {!started ? (
              <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
                <LoadingIndicator size={34} dotSize={6} />
                <Text style={styles.loadingText}>{t('ads.loading')}</Text>
              </View>
            ) : null}
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
                {buttons}
              </LinearGradient>
            ) : null}
          </View>
          )}

          {!vertical && !profile ? (
            <View style={[styles.wideFooter, { width: cardWidth }]}>
              {who}
              {buttons}
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

/** The profile card's own colours, following the app's light / dark theme. */
const CARD_LIGHT = {
  card: '#FFFFFF',
  name: '#0C0F14',
  muted: '#475569',
  emptyStar: '#E2E8F0',
  factsBg: '#F1F5F9',
  factIcon: '#64748B',
  factText: '#334155',
  tagAlpha: '14',
};
const CARD_DARK = {
  card: '#161B24',
  name: '#EEF2F8',
  muted: '#A3AEC2',
  emptyStar: '#334155',
  factsBg: '#1F2632',
  factIcon: '#94A0B4',
  factText: '#CBD5E1',
  tagAlpha: '33',
};

/** "Ravi Kumar" → "RK". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * A Triolo Partner profile ad: the worker, shop or job seeker as a card — photo, name, rating,
 * what they do and a big Book Now / Order from this Shop / Contact button.
 */
function ProfileAdCard({
  card,
  words,
  width,
  cta,
  onCta,
}: {
  card: AdPromotedCard;
  /** The ad's own "few words" (an offer, a message). */
  words: string | null;
  width: number;
  cta: AdCta | null;
  onCta: () => void;
}) {
  const { t } = useTranslation();
  const { isDark } = useThemeColors();
  const pal = isDark ? CARD_DARK : CARD_LIGHT;
  const look = KIND_LOOK[card.kind];
  // In dark mode the lighter end of the kind's colour reads better on the dark card.
  const accent = isDark ? look.gradient[1] : look.gradient[0];
  const tags = [
    ...(card.headline ? [card.headline] : []),
    ...card.tags.map((code) =>
      t(card.kind === 'business' ? `businessProfile.categories.${code}` : `workerProfile.skills.${code}`, { defaultValue: code }),
    ),
    ...card.customTags,
  ].slice(0, 4);
  const facts: { icon: IconName; text: string }[] = [];
  if (card.experienceYears) facts.push({ icon: 'award', text: t('ads.experience', { count: card.experienceYears }) });
  if (card.deliveryAvailable) facts.push({ icon: 'truck-fast', text: t('ads.homeDelivery') });
  if (card.payAmount) {
    facts.push({
      icon: 'indian-rupee-sign',
      text: t(card.payPeriod === 'monthly' ? 'ads.payMonthly' : 'ads.payDaily', { amount: card.payAmount.toLocaleString('en-IN') }),
    });
  }
  if (card.placeName) facts.push({ icon: 'location-dot', text: card.placeName });
  const stars = card.ratingAverage == null ? 0 : Math.round(card.ratingAverage);

  return (
    <View style={[styles.profileCard, { width, backgroundColor: pal.card }]}>
      <LinearGradient colors={look.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profileHero}>
        <View style={styles.profileBubbleA} />
        <View style={styles.profileBubbleB} />
        <View style={styles.profileKind}>
          <FontAwesome6 name={look.icon} size={11} color="#FFFFFF" solid />
          <Text style={styles.profileKindText}>{t(look.labelKey)}</Text>
        </View>
      </LinearGradient>
      <View style={[styles.profileAvatarRing, { backgroundColor: pal.card }]}>
        {card.photoUrl ? (
          <Image source={{ uri: card.photoUrl }} style={styles.profileAvatar} />
        ) : (
          <LinearGradient colors={look.gradient} style={[styles.profileAvatar, styles.center]}>
            <Text style={styles.profileInitials}>{initials(card.name)}</Text>
          </LinearGradient>
        )}
        <View style={[styles.profileVerified, { backgroundColor: look.gradient[0], borderColor: pal.card }]}>
          <FontAwesome6 name="check" size={10} color="#FFFFFF" solid />
        </View>
      </View>
      <View style={styles.profileBody}>
        <Text style={[styles.profileName, { color: pal.name }]} numberOfLines={2}>
          {card.name}
        </Text>
        {card.kind === 'job_post' ? null : (
          <View style={styles.profileRating}>
            {card.ratingAverage == null || card.ratingCount === 0 ? (
              <View style={styles.profileNew}>
                <FontAwesome6 name="wand-magic-sparkles" size={10} color={accent} solid />
                <Text style={[styles.profileNewText, { color: accent }]}>{t('ads.newOnTriolo')}</Text>
              </View>
            ) : (
              <>
                {[1, 2, 3, 4, 5].map((n) => (
                  <FontAwesome6 key={n} name="star" size={14} color={n <= stars ? '#FBBF24' : pal.emptyStar} solid />
                ))}
                <Text style={[styles.profileRatingText, { color: pal.muted }]}>
                  {card.ratingAverage.toFixed(1)} · {t('ads.reviews', { count: card.ratingCount })}
                </Text>
              </>
            )}
          </View>
        )}
        {words ? (
          <View style={[styles.profileWords, { borderColor: `${look.gradient[0]}55`, backgroundColor: `${look.gradient[0]}${pal.tagAlpha}` }]}>
            <FontAwesome6 name="quote-left" size={12} color={accent} solid />
            <Text style={[styles.profileWordsText, { color: pal.name }]} numberOfLines={4}>
              {words}
            </Text>
          </View>
        ) : null}
        {tags.length > 0 ? (
          <View style={styles.profileTags}>
            {tags.map((tag) => (
              <View key={tag} style={[styles.profileTag, { backgroundColor: `${look.gradient[0]}${pal.tagAlpha}` }]}>
                <Text style={[styles.profileTagText, { color: accent }]} numberOfLines={1}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {facts.length > 0 ? (
          <View style={[styles.profileFacts, { backgroundColor: pal.factsBg }]}>
            {facts.map((fact) => (
              <View key={fact.text} style={styles.profileFact}>
                <FontAwesome6 name={fact.icon} size={12} color={pal.factIcon} solid />
                <Text style={[styles.profileFactText, { color: pal.factText }]} numberOfLines={1}>
                  {fact.text}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {cta ? (
          <Pressable onPress={onCta} accessibilityRole="button" style={({ pressed }) => [styles.profileCtaWrap, pressed && { transform: [{ scale: 0.98 }] }]}>
            <LinearGradient colors={cta.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profileCta}>
              <FontAwesome6 name={cta.icon} size={17} color="#FFFFFF" solid />
              <Text style={styles.profileCtaText}>{t(cta.labelKey)}</Text>
              <FontAwesome6 name="arrow-right" size={14} color="rgba(255,255,255,0.9)" solid />
            </LinearGradient>
          </Pressable>
        ) : (
          <Text style={[styles.profileHint, { color: pal.muted }]}>{t('ads.findInCustomerApp')}</Text>
        )}
      </View>
    </View>
  );
}

interface ActionAdState {
  ad: Ad | null;
  /** Runs the action (go = true) or drops it (the ad's button opened a profile instead). */
  then: ((go: boolean) => void) | null;
}

const useActionAd = create<ActionAdState>(() => ({ ad: null, then: null }));

// --- Ads before key actions ---

let actionPending = false;

// A flow started from an ad's own Book Now / Order / Contact shows no ads until it ends
// (`endAdFreeFlow`), or after this long at the most.
const AD_FREE_FLOW_MAX_MS = 30 * 60 * 1000;
let adFreeUntil = 0;

export function startAdFreeFlow(): void {
  adFreeUntil = Date.now() + AD_FREE_FLOW_MAX_MS;
}

export function endAdFreeFlow(): void {
  adFreeUntil = 0;
}
// Whether the latest showAdBefore actually showed an ad (read by adThen).
let lastActionShowedAd = false;

/**
 * Runs `action` after an ad, when one is running nearby and ads before key actions are on;
 * otherwise straight away. Never holds the action up for long: if no ad arrives quickly, the
 * action just goes ahead.
 */
export function showAdBefore(action: (go?: boolean) => void, spot?: AdSpot): void {
  lastActionShowedAd = false;
  if (actionPending || useActionAd.getState().ad || Date.now() < adFreeUntil) {
    action();
    return;
  }
  const here = readyCoords(useLocationStore.getState());
  if (!here) {
    // Location was only just turned on: give the shared position a moment (within the same
    // short budget) instead of skipping the ad.
    actionPending = true;
    const store = useLocationStore.getState();
    Promise.race([store.refresh(), new Promise((resolve) => setTimeout(resolve, ACTION_AD_WAIT_MS))])
      .catch(() => undefined)
      .then(() => {
        actionPending = false;
        const now = readyCoords(useLocationStore.getState());
        if (now) showAdBefore(action, spot);
        else action();
      });
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
    .serve('action', here, spot)
    .then(async (ad) => {
      if (settled) return;
      if (!ad) {
        clearTimeout(waited);
        goAhead();
        return;
      }
      // Its picture (or profile photo) first, within the same wait, so it opens already drawn.
      await preload(ad);
      if (settled) return;
      clearTimeout(waited);
      settled = true;
      actionPending = false;
      lastActionShowedAd = true;
      useActionAd.setState({ ad, then: action });
    })
    .catch(() => {
      clearTimeout(waited);
      goAhead();
    });
}

/** `showAdBefore` as a promise: resolves once the ad (if there was one) is closed — true if one was shown. */
export function adThen(spot?: AdSpot): Promise<{ shown: boolean; go: boolean }> {
  return new Promise((resolve) => showAdBefore((go = true) => resolve({ shown: lastActionShowedAd, go }), spot));
}

/**
 * For a final button: `await waitForAd()` before the action (false if it's already waiting),
 * and `adLoading` to show the button's spinner while the ad is being fetched, so the tap
 * answers at once instead of seeming to do nothing. One ad per opening of the screen: pass
 * the screen's `open` — once an ad has been shown, later taps go straight through until the
 * screen is closed and opened again.
 */
export function useAdGate(open: boolean, spot: AdSpot): { adLoading: boolean; waitForAd: () => Promise<boolean> } {
  const [adLoading, setAdLoading] = useState(false);
  const busy = useRef(false);
  const shownThisOpening = useRef(false);
  useEffect(() => {
    if (!open) shownThisOpening.current = false;
  }, [open]);
  const waitForAd = useCallback(async () => {
    if (busy.current) return false;
    if (shownThisOpening.current) return true;
    busy.current = true;
    setAdLoading(true);
    try {
      const { shown, go } = await adThen(spot);
      if (shown) shownThisOpening.current = true;
      // False when the ad's own button took the person somewhere else instead.
      return go;
    } finally {
      busy.current = false;
      setAdLoading(false);
    }
  }, [spot]);
  return { adLoading, waitForAd };
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
        setTimeout(() => then?.(true), 250);
      }}
      onLeave={() => {
        const { then } = useActionAd.getState();
        useActionAd.setState({ ad: null, then: null });
        then?.(false);
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
    gap: 12,
  },
  // Name and words on top; the Call Now / Visit buttons centred underneath.
  wideFooter: { gap: 12 },
  whoText: {},
  whoName: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF' },
  ctaStack: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  whoWords: { ...typography.caption, fontFamily: fonts.medium, color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 18, marginTop: 2 },
  whoPlace: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
  visitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    minWidth: 150,
    paddingHorizontal: 22,
    borderRadius: 22,
  },
  visitText: { ...typography.body, fontFamily: fonts.semiBold, color: '#FFFFFF', fontSize: 14 },
  profileCard: { borderRadius: 26, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  profileHero: { height: 118, padding: 14, overflow: 'hidden' },
  profileBubbleA: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -50,
    top: -90,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  profileBubbleB: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    left: -30,
    bottom: -60,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  profileKind: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  profileKindText: { ...typography.caption, fontFamily: fonts.semiBold, color: '#FFFFFF', fontSize: 11 },
  profileAvatarRing: {
    alignSelf: 'center',
    marginTop: -56,
    width: 112,
    height: 112,
    borderRadius: 56,
    padding: 4,
    backgroundColor: '#FFFFFF',
  },
  profileAvatar: { width: 104, height: 104, borderRadius: 52 },
  profileInitials: { color: '#FFFFFF', fontFamily: fonts.semiBold, fontSize: 34 },
  profileVerified: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBody: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, alignItems: 'center' },
  profileName: { fontFamily: fonts.semiBold, fontSize: 22, lineHeight: 28, color: '#0C0F14', textAlign: 'center' },
  profileRating: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  profileRatingText: { ...typography.caption, fontFamily: fonts.medium, color: '#475569', marginLeft: 6 },
  profileNew: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  profileNewText: { ...typography.caption, fontFamily: fonts.semiBold },
  profileWords: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  profileWordsText: { ...typography.body, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, flex: 1 },
  profileTags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 12 },
  profileTag: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, maxWidth: 200 },
  profileTagText: { ...typography.caption, fontFamily: fonts.semiBold, fontSize: 12 },
  profileFacts: { alignSelf: 'stretch', gap: 8, marginTop: 14, padding: 12, borderRadius: 16, backgroundColor: '#F1F5F9' },
  profileFact: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileFactText: { ...typography.caption, fontFamily: fonts.medium, color: '#334155', fontSize: 13, flex: 1 },
  profileCtaWrap: { alignSelf: 'stretch', marginTop: 18 },
  profileCta: {
    height: 54,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 22,
  },
  profileCtaText: { fontFamily: fonts.semiBold, fontSize: 16, color: '#FFFFFF' },
  profileHint: { ...typography.caption, color: '#64748B', marginTop: 16, textAlign: 'center' },
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
  loadingText: { ...typography.caption, color: 'rgba(255,255,255,0.75)', marginTop: 10 },
});
