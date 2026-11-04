import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  FlatList,
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
import { sealSizeFor, TrustedSeal } from './TrustedSeal';
import { FullText } from '@/components/FullText';

/*
 * (Copied between user-app and partner-app — keep in sync. Only `AD_APP` in adsService differs.)
 *
 * Ads from local businesses, booked on the Triolo Ads website or by the admin: one wide (16:9)
 * picture or video each. They show only in the slider at the top of Home (HomeAdCarousel, at the
 * end) — never full screen before an action. Tapping one does what the ad does (a link,
 * directions, a Triolo profile), or opens it full screen (AdPlayer) when it only promotes.
 *
 * The time only runs while the app is on screen: in the background the full-screen timer, its
 * bar and the video all pause, and carry on when the person comes back.
 */

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
  mode: 'view';
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
      <FullText style={styles.whoName} numberOfLines={1}>
        {ad.advertiserName}
      </FullText>
      {ad.description ? (
        <FullText style={styles.whoWords} numberOfLines={3}>
          {ad.description}
        </FullText>
      ) : null}
      {ad.locationText ? (
        <FullText style={styles.whoPlace} numberOfLines={1}>
          {ad.locationText}
        </FullText>
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
                <Text style={styles.continueText}>{t('common.close')}</Text>
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
        {card.trusted ? <TrustedSeal size={sealSizeFor(104)} style={styles.profileSeal} /> : null}
      </View>
      <View style={styles.profileBody}>
        <FullText style={[styles.profileName, { color: pal.name }]} numberOfLines={2}>
          {card.name}
        </FullText>
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
            <FullText style={[styles.profileWordsText, { color: pal.name }]} numberOfLines={4}>
              {words}
            </FullText>
          </View>
        ) : null}
        {tags.length > 0 ? (
          <View style={styles.profileTags}>
            {tags.map((tag) => (
              <View key={tag} style={[styles.profileTag, { backgroundColor: `${look.gradient[0]}${pal.tagAlpha}` }]}>
                <FullText style={[styles.profileTagText, { color: accent }]} numberOfLines={1}>
                  {tag}
                </FullText>
              </View>
            ))}
          </View>
        ) : null}
        {facts.length > 0 ? (
          <View style={[styles.profileFacts, { backgroundColor: pal.factsBg }]}>
            {facts.map((fact) => (
              <View key={fact.text} style={styles.profileFact}>
                <FontAwesome6 name={fact.icon} size={12} color={pal.factIcon} solid />
                <FullText style={[styles.profileFactText, { color: pal.factText }]} numberOfLines={1}>
                  {fact.text}
                </FullText>
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

/** The ad opened full screen from the slider (it only promotes, so it has nothing else to open). */
const useActionAd = create<{ ad: Ad | null }>(() => ({ ad: null }));

// A profile opened from an ad's own Book Now / Order / Contact (kept for the screens that call these).
export function startAdFreeFlow(): void {}

export function endAdFreeFlow(): void {}

/**
 * Keeps a button spinning from the tap until its whole action is done — the location check,
 * the ad, the payment step and the request itself — so there's never a still moment before
 * or after an ad that makes it look like the tap didn't work. A second tap while it runs is
 * ignored.
 */
export function useBusyAction(): { busy: boolean; run: (action: () => Promise<unknown> | unknown) => Promise<void> } {
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const run = useCallback(async (action: () => Promise<unknown> | unknown) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await action();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, run };
}

/** Mounted once at the app root: an ad from the slider opened full screen. */
export function AdActionHost() {
  const ad = useActionAd((state) => state.ad);
  if (!ad) return null;
  const close = () => useActionAd.setState({ ad: null });
  return <AdPlayer key={ad.id} ad={ad} mode="view" onClose={close} onLeave={close} />;
}

// --- Home carousel ---

// Wide cards: Home slider ads are always horizontal (16:9).
const CAROUSEL_RATIO = 9 / 16;
const CAROUSEL_SLIDE_MS = 5000;
// A video slide stays until its video has played (at most this long).
const CAROUSEL_VIDEO_MAX_MS = 31000;
// Coming back to the app reloads the slider if it's older than this (a deleted / ended ad goes).
const CAROUSEL_REFRESH_MS = 2 * 60 * 1000;

/** A still for a video ad: Cloudinary gives a frame for the same address ending in .jpg. */
function stillOf(ad: Ad): string | null {
  if (ad.videoUrl) return ad.videoUrl.replace(/\.(mp4|webm|mov|m3u8)(\?.*)?$/i, '.jpg');
  return ad.imageUrl ?? ad.imageUrls?.[0] ?? ad.promotedCard?.photoUrl ?? null;
}

/**
 * Top of Home, when the admin turned it on for this app: the Home-slider ads running near
 * here (booked as "Home slider" — never the full-screen action ads), one wide card each,
 * sliding by itself. The card on screen plays its video by itself (muted; a button turns the
 * sound on). Tapping a card does what the ad does (link, directions, a profile), or opens it
 * full screen when it only promotes. Nothing at all while there's no ad (or for subscribers).
 */
export function HomeAdCarousel() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();
  // Plain numbers from the store (≈1 km steps): a selector returning a new object each time
  // would re-render this forever.
  const lat = useLocationStore((state) => {
    const here = readyCoords(state);
    return here ? Math.round(here.latitude * 100) / 100 : null;
  });
  const lng = useLocationStore((state) => {
    const here = readyCoords(state);
    return here ? Math.round(here.longitude * 100) / 100 : null;
  });
  const active = useAppActive();
  const [ads, setAds] = useState<Ad[]>([]);
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(screenWidth - 40);
  const [muted, setMuted] = useState(true);
  const [reload, setReload] = useState(0);
  const listRef = useRef<FlatList<Ad>>(null);
  const touching = useRef(false);
  const fetchedAt = useRef(0);
  const height = Math.round(width * CAROUSEL_RATIO);

  // Once per place (≈1 km), and again on coming back to the app after a while.
  useEffect(() => {
    if (lat == null || lng == null) return;
    let alive = true;
    adsService
      .home({ latitude: lat, longitude: lng })
      .then((list) => {
        if (!alive) return;
        fetchedAt.current = Date.now();
        setAds(list);
        setIndex(0);
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
        list.forEach((ad) => preload(ad).catch(() => undefined));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [lat, lng, reload]);

  useEffect(() => {
    if (active && fetchedAt.current && Date.now() - fetchedAt.current > CAROUSEL_REFRESH_MS) setReload((n) => n + 1);
  }, [active]);

  // Slides on by itself (not while a finger is on it, nor in the background): a picture
  // after a few seconds, a video once it has played.
  const current = ads[index];
  useEffect(() => {
    if (ads.length < 2 || !active || !current) return;
    // A picture stays the admin's "time between ads"; a video until it has played.
    const pictureMs = (current.slideSeconds ?? 5) * 1000 || CAROUSEL_SLIDE_MS;
    const wait = current.videoUrl
      ? Math.min(CAROUSEL_VIDEO_MAX_MS, Math.max(pictureMs, current.durationSeconds * 1000 + 1500))
      : pictureMs;
    const timer = setTimeout(() => {
      if (touching.current) return;
      const next = (index + 1) % ads.length;
      listRef.current?.scrollToOffset({ offset: next * width, animated: true });
      setIndex(next);
    }, wait);
    return () => clearTimeout(timer);
  }, [ads.length, index, width, active, current]);

  if (ads.length === 0) return null;

  const open = (ad: Ad) => {
    const cta = adCta(ad);
    if (cta) cta.run();
    // Only promotes: show it full screen.
    else useActionAd.setState({ ad });
  };

  return (
    <View style={styles.carouselWrap} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <FlatList
        ref={listRef}
        data={ads}
        keyExtractor={(ad) => ad.id}
        horizontal
        pagingEnabled
        scrollEnabled={ads.length > 1}
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => {
          touching.current = true;
        }}
        onMomentumScrollEnd={(event) => {
          touching.current = false;
          setIndex(Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width)));
        }}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        extraData={`${index}:${muted}:${active}:${height}`}
        renderItem={({ item: ad, index: i }) => {
          const still = stillOf(ad);
          const name = ad.promotedCard?.name ?? ad.advertiserName;
          const playing = !!ad.videoUrl && i === index;
          return (
            <Pressable onPress={() => open(ad)} style={[styles.carouselCard, { width, height, backgroundColor: colors.surface }]}>
              {still ? (
                <>
                  {/* Any picture fits whole: over a blurred copy of itself instead of being cut. */}
                  <Image source={{ uri: still }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={18} />
                  <SmartImage source={{ uri: still }} style={StyleSheet.absoluteFill} resizeMode="contain" />
                </>
              ) : (
                <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              )}
              {playing ? (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <AdVideo
                    key={ad.id}
                    url={ad.videoUrl as string}
                    width={width}
                    height={height}
                    muted={muted}
                    paused={!active}
                    onStart={() => undefined}
                  />
                </View>
              ) : null}
              <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.65)']} style={styles.carouselShade} pointerEvents="none" />
              <View style={styles.carouselTop} pointerEvents="box-none">
                <View style={styles.sponsored}>
                  <FontAwesome6 name="bullhorn" size={10} color="#FFFFFF" solid />
                  <Text style={styles.sponsoredText}>{t('ads.sponsored')}</Text>
                </View>
                {ad.videoUrl ? (
                  <Pressable
                    onPress={() => setMuted((value) => !value)}
                    style={styles.carouselSound}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={muted ? t('ads.unmute') : t('ads.mute')}
                  >
                    <FontAwesome6 name={muted ? 'volume-xmark' : 'volume-high'} size={12} color="#FFFFFF" solid />
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.carouselFoot} pointerEvents="none">
                <FullText style={styles.carouselTitle} numberOfLines={1}>
                  {ad.title || name}
                </FullText>
                {ad.title && ad.title !== name ? (
                  <FullText style={styles.carouselBy} numberOfLines={1}>
                    {name}
                  </FullText>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
      {ads.length > 1 ? (
        <View style={styles.carouselDots}>
          {ads.map((ad, i) => (
            <View
              key={ad.id}
              style={[styles.carouselDot, { width: i === index ? 16 : 6, backgroundColor: i === index ? colors.primary : `${colors.primary}40` }]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carouselWrap: { marginBottom: 16 },
  carouselCard: { borderRadius: 18, overflow: 'hidden' },
  carouselShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 },
  carouselTop: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carouselSound: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselFoot: { position: 'absolute', left: 14, right: 14, bottom: 12 },
  carouselTitle: { ...typography.body, fontFamily: fonts.semiBold, fontSize: 16, color: '#FFFFFF' },
  carouselBy: { ...typography.caption, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  carouselDots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 },
  carouselDot: { height: 6, borderRadius: 3 },
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
  profileSeal: { position: 'absolute', top: 2, right: 2 },
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
