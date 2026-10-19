import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBullhorn,
  faCircleCheck,
  faCalendarDays,
  faEye,
  faFilePdf,
  faHandPointer,
  faImage,
  faLink,
  faLocationDot,
  faPen,
  faPhone,
  faPlus,
  faReceipt,
  faStore,
  faTrash,
  faVideo,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { Topbar } from '@/components/Layout';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  Badge,
  BackLink,
  Empty,
  ErrorState,
  InfoRow,
  Loading,
  Notice,
  Pager,
  SearchBox,
  Segment,
  Spinner,
} from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import {
  AD_MAX_IMAGE_MB,
  AD_MAX_VIDEO_SECONDS,
  AD_MAX_VIDEO_MB,
  AD_PLANS,
  Ad,
  AdPaymentMethod,
  AdPlanDays,
  AdPlanPrices,
  AdSettings,
  AdStatus,
  SaveAd,
  adsApi,
  planLabel,
  uploadAdFile,
} from '@/services/adsApi';
import { getErrorMessage } from '@/services/errorMessages';
import { PlaceField } from '@/components/PlaceField';
import { PlaceValue } from '@/utils/place';
import { showToast } from '@/state/toastStore';
import { billNumber, dayLabel, downloadAdBill } from '@/utils/adBill';
import { rupees, timeAgo, Tone } from '@/utils/format';

/** One piece of an ad's media in the form: already on the ad (url) or newly picked (file + local preview url). */
interface MediaItem {
  url: string;
  file?: File;
}

const STATUS: Record<AdStatus, { label: string; tone: Tone }> = {
  in_review: { label: 'Waiting for review', tone: 'warning' },
  rejected: { label: 'Rejected', tone: 'error' },
  running: { label: 'Running', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  ended: { label: 'Ended', tone: 'muted' },
  deleted: { label: 'Deleted', tone: 'error' },
};

const PAYMENT_LABEL: Record<AdPaymentMethod, string> = { cash: 'Cash', upi: 'UPI', other: 'Other', pending: 'Not paid yet' };

const LIMIT = 20;

/** Today's date in India as YYYY-MM-DD (ads run by the India calendar day). */
function todayInIndia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

/** Last day of a plan starting on `start` (inclusive). */
function endDateFor(start: string, days: number): string {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days - 1);
  return date.toISOString().slice(0, 10);
}

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`switch${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span className="switch-knob" />
    </button>
  );
}

// ---------------- Settings card ----------------

function AdSettingsCard({ settings, onChange }: { settings: AdSettings; onChange: (settings: AdSettings) => void }) {
  const [saving, setSaving] = useState(false);

  const save = async (changes: Partial<AdSettings>) => {
    const previous = settings;
    onChange({ ...settings, ...changes });
    setSaving(true);
    try {
      onChange(await adsApi.saveSettings(changes));
    } catch (err) {
      onChange(previous);
      showToast({ variant: 'error', title: 'Not saved', message: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const off = !settings.adsEnabled;
  const rows: { label: string; note: string; launch: keyof AdSettings; action: keyof AdSettings }[] = [
    {
      label: 'Customer app (Triolo)',
      note: 'Before Home quick actions: Quick Book, Order from a Shop, Hire Staff, Post a Problem',
      launch: 'launchUser',
      action: 'actionUser',
    },
    {
      label: 'Partner app (Triolo Partner)',
      note: 'Before marking work done or an order finished',
      launch: 'launchPartner',
      action: 'actionPartner',
    },
  ];

  return (
    <div className="glass card">
      <div className="ad-master">
        <span className="nav-icon" style={{ background: 'linear-gradient(135deg,#ea580c,#f59e0b)', width: 42, height: 42 }}>
          <FontAwesomeIcon icon={faBullhorn} />
        </span>
        <div style={{ flex: 1 }}>
          <div className="row-title">Show ads in the apps</div>
          <div className="row-sub">
            {off ? 'Off — no ads are shown anywhere.' : 'On — running ads are shown where switched on below.'}
          </div>
        </div>
        {saving ? <Spinner small /> : null}
        <Switch checked={settings.adsEnabled} onChange={(value) => save({ adsEnabled: value })} />
      </div>
      <div className={`ad-places${off ? ' disabled' : ''}`}>
        <div className="ad-places-head">
          <span />
          <span>Full screen when the app opens</span>
          <span>Full screen before key actions</span>
        </div>
        {rows.map((row) => (
          <div key={row.label} className="ad-places-row">
            <span className="ad-places-label">
              {row.label}
              <small>{row.note}</small>
            </span>
            <span>
              <Switch
                checked={settings[row.launch] as boolean}
                disabled={off}
                onChange={(value) => save({ [row.launch]: value })}
              />
            </span>
            <span>
              <Switch
                checked={settings[row.action] as boolean}
                disabled={off}
                onChange={(value) => save({ [row.action]: value })}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Prices ----------------

function AdPricesCard({ prices, onSaved }: { prices: AdPlanPrices; onSaved: (settings: AdSettings) => void }) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(AD_PLANS.map((plan) => [plan.key, String(prices[plan.key])])),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(Object.fromEntries(AD_PLANS.map((plan) => [plan.key, String(prices[plan.key])])));
  }, [prices]);

  const changed = AD_PLANS.some((plan) => Number(draft[plan.key]) !== prices[plan.key]);
  const valid = AD_PLANS.every((plan) => /^\d{1,6}$/.test(draft[plan.key] ?? ''));

  const save = async () => {
    if (!valid) {
      showToast({ variant: 'error', title: 'Check the prices', message: 'Each price must be a whole number of rupees.' });
      return;
    }
    setSaving(true);
    try {
      const next = Object.fromEntries(AD_PLANS.map((plan) => [plan.key, Number(draft[plan.key])])) as AdPlanPrices;
      onSaved(await adsApi.saveSettings({ prices: next }));
      showToast({
        variant: 'success',
        title: 'Prices saved',
        message: 'They apply to new bookings. Booked ads keep their price.',
      });
    } catch (err) {
      showToast({ variant: 'error', title: 'Not saved', message: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass card">
      <div className="card-title">
        <FontAwesomeIcon icon={faReceipt} /> Prices
      </div>
      <div className="ad-prices">
        {AD_PLANS.map((plan) => (
          <label key={plan.key} className="field">
            <span>{plan.label}</span>
            <div className="ad-price-input">
              <span>₹</span>
              <input
                value={draft[plan.key] ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [plan.key]: event.target.value.replace(/[^0-9]/g, '') }))
                }
                inputMode="numeric"
                maxLength={6}
              />
            </div>
          </label>
        ))}
      </div>
      <div className="ad-prices-foot">
        <span className="muted" style={{ fontSize: 12 }}>
          New prices apply to new bookings only. Ads already booked keep the price they were booked at.
        </span>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={!changed || saving}>
          {saving ? <Spinner small /> : 'Save Prices'}
        </button>
      </div>
    </div>
  );
}

// ---------------- List ----------------

export function AdsPage() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const overview = useApi(() => adsApi.overview(), []);
  const list = useApi(() => adsApi.list({ status, q, page, limit: LIMIT }), [status, q, page]);
  const counts = overview.data?.counts;

  return (
    <>
      <Topbar
        title="Ads"
        subtitle="local businesses' ads in both apps"
        actions={
          <Link to="/ads/new" className="btn btn-primary">
            <FontAwesomeIcon icon={faPlus} /> Book New Ad
          </Link>
        }
      />

      {overview.loading ? (
        <Loading />
      ) : overview.error || !overview.data ? (
        <ErrorState error={overview.error} onRetry={overview.reload} />
      ) : (
        <>
          <AdSettingsCard
            settings={overview.data.settings}
            onChange={(settings) => overview.setData((current) => (current ? { ...current, settings } : current))}
          />
          <AdPricesCard
            prices={overview.data.settings.prices}
            onSaved={(settings) =>
              overview.setData((current) => (current ? { ...current, settings, prices: settings.prices } : current))
            }
          />
          {overview.data.counts.in_review > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <Notice tone="warning" icon={faBullhorn}>
                {overview.data.counts.in_review === 1
                  ? '1 ad booked by a business is waiting for your review.'
                  : `${overview.data.counts.in_review} ads booked by businesses are waiting for your review.`}{' '}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setStatus('in_review');
                    setPage(1);
                  }}
                >
                  Review now
                </button>
              </Notice>
            </div>
          ) : null}
          <div className="stats ad-stats">
            <div className="stat glass">
              <span className="stat-value">{overview.data.counts.running}</span>
              <span className="stat-label">Running now</span>
            </div>
            <div className="stat glass">
              <span className="stat-value">{overview.data.counts.scheduled}</span>
              <span className="stat-label">Starting later</span>
            </div>
            <div className="stat glass">
              <span className="stat-value">{rupees(overview.data.revenueThisMonth)}</span>
              <span className="stat-label">Booked this month</span>
            </div>
            <div className="stat glass">
              <span className="stat-value">{rupees(overview.data.revenueTotal)}</span>
              <span className="stat-label">Booked in total</span>
            </div>
          </div>
        </>
      )}

      <div className="toolbar" style={{ marginTop: 20 }}>
        <SearchBox
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder="Search business, title or bill number"
        />
        <Segment
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All' },
            { value: 'in_review', label: 'Waiting for review', count: counts?.in_review },
            { value: 'running', label: 'Running', count: counts?.running },
            { value: 'scheduled', label: 'Scheduled', count: counts?.scheduled },
            { value: 'ended', label: 'Ended' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'deleted', label: 'Deleted' },
          ]}
        />
      </div>

      {list.loading ? (
        <Loading />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : (
        <div className="glass list">
          {list.data.items.length === 0 ? (
            <Empty icon={faBullhorn} title="No ads here" message="Book an ad when a business pays you." />
          ) : (
            list.data.items.map((ad) => (
              <Link key={ad.id} to={`/ads/${ad.id}`} className="row">
                {ad.imageUrls[0] ? (
                  <span className="thumb">
                    <img src={ad.imageUrls[0]} alt="" loading="lazy" />
                  </span>
                ) : (
                  <span
                    className="nav-icon"
                    style={{ background: 'linear-gradient(135deg,#ea580c,#f59e0b)', width: 44, height: 44 }}
                  >
                    <FontAwesomeIcon icon={faBullhorn} />
                  </span>
                )}
                <div className="row-main">
                  <div className="row-title">{ad.title}</div>
                  <div className="row-sub">
                    {ad.advertiserName} · {planLabel(ad.planDays)} · {dayLabel(ad.startDate)} – {dayLabel(ad.endDate)}
                  </div>
                </div>
                <div className="row-side">
                  <Badge tone={STATUS[ad.status].tone}>{STATUS[ad.status].label}</Badge>
                  <span className="row-meta">
                    {rupees(ad.amount)} · {ad.impressions.toLocaleString('en-IN')} views
                  </span>
                </div>
              </Link>
            ))
          )}
          <Pager page={list.data.page} limit={list.data.limit} total={list.data.total} onPage={setPage} />
        </div>
      )}
    </>
  );
}

// ---------------- Book / edit ----------------

type AdFormValues = Omit<SaveAd, 'latitude' | 'longitude' | 'locationText'>;

const EMPTY_FORM: AdFormValues = {
  advertiserName: '',
  advertiserPhone: '',
  linkUrl: '',
  orientation: 'vertical',
  displaySeconds: 15,
  planDays: 7,
  paymentMethod: 'cash',
  startDate: todayInIndia(),
};

/** People see an ad only within this distance of its place (same as the backend). */
const AD_RADIUS_KM = 5;

/** Progress of a newly picked file being made smaller and uploaded (`share` is this step's 0–1). */
interface MediaStatus {
  step: string | null;
  text: string;
  share: number;
  state: 'working' | 'ready' | 'failed';
}

/** The ad's one piece of media in the form: already on the ad (url) or newly picked (file). */
interface MediaPick {
  kind: 'image' | 'video';
  url: string;
  file?: File;
  seconds?: number | null;
}

/** Size (and a video's length) of a picked file, read in the browser before uploading. */
function readMediaInfo(file: File): Promise<{ kind: 'image' | 'video'; width: number; height: number; seconds: number | null }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    if (file.type.startsWith('image/')) {
      const image = new Image();
      image.onload = () => {
        resolve({ kind: 'image', width: image.naturalWidth, height: image.naturalHeight, seconds: null });
        URL.revokeObjectURL(url);
      };
      image.onerror = () => reject(new Error('That image could not be read.'));
      image.src = url;
      return;
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve({ kind: 'video', width: video.videoWidth, height: video.videoHeight, seconds: video.duration });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => reject(new Error('That video could not be read. MP4 works best.'));
    video.src = url;
  });
}

function AdForm({ ad }: { ad?: Ad }) {
  const navigate = useNavigate();
  const [form, setForm] = useState<AdFormValues>(() =>
    ad
      ? {
          advertiserName: ad.advertiserName,
          advertiserPhone: ad.advertiserPhone ?? '',
          linkUrl: ad.linkUrl ?? '',
          orientation: ad.orientation,
          displaySeconds: ad.displaySeconds,
          planDays: ad.planDays,
          paymentMethod: ad.paymentMethod,
          startDate: ad.startDate,
        }
      : { ...EMPTY_FORM, startDate: todayInIndia() },
  );
  // Where the ad is shown: a GPS point or a map pin, never typed.
  const [place, setPlace] = useState<PlaceValue | null>(() =>
    ad && ad.latitude != null && ad.longitude != null
      ? { latitude: ad.latitude, longitude: ad.longitude, locationName: ad.locationText ?? 'Pinned location' }
      : null,
  );
  const [media, setMedia] = useState<MediaPick | null>(() =>
    ad?.videoUrl
      ? { kind: 'video', url: ad.videoUrl, seconds: ad.videoSeconds }
      : ad?.imageUrls[0]
        ? { kind: 'image', url: ad.imageUrls[0] }
        : null,
  );
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  // A picked file is only previewed (so it can be watched and changed freely); it's made
  // smaller (big videos) and uploaded only when the ad is saved. `upload` is that work.
  const upload = useRef<{ file: File; promise: Promise<string> } | null>(null);
  const [mediaStatus, setMediaStatus] = useState<MediaStatus | null>(null);

  const startUpload = (file: File, kind: 'image' | 'video') => {
    const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
    const isCurrent = () => upload.current?.file === file;
    const status = (next: MediaStatus) => {
      if (isCurrent()) setMediaStatus(next);
    };
    // The file goes up exactly as it is — it's never re-encoded in the browser (that made
    // videos stutter or play in slow motion). Cloudinary makes the phone copy from it.
    const promise = (async () => {
      status({ step: null, text: `Uploading the ${kind} — 0% (0 of ${mb(file.size)} MB)`, share: 0, state: 'working' });
      const { url } = await uploadAdFile(file, kind, (share, sent, total) =>
        status({
          step: null,
          text:
            share < 1
              ? `Uploading the ${kind} — ${Math.round(share * 100)}% (${mb(sent)} of ${mb(total)} MB)`
              : `Uploaded — Cloudinary is preparing the ${kind}…`,
          share,
          state: 'working',
        }),
      );
      status({
        step: null,
        text: `${kind === 'video' ? 'Video' : 'Image'} uploaded (${mb(file.size)} MB)`,
        share: 1,
        state: 'ready',
      });
      return url;
    })();
    promise.catch((err) =>
      status({ step: null, text: err instanceof Error ? err.message : 'Upload failed', share: 0, state: 'failed' }),
    );
    upload.current = { file, promise };
  };

  const pricing = useApi(() => adsApi.overview().then((overview) => overview.settings.prices), []);
  const priceOf = (days: AdPlanDays) => pricing.data?.[String(days) as keyof AdPlanPrices];
  // An edited ad keeps the amount it was booked at, unless its plan is changed.
  const keepsBookedAmount = !!ad && ad.planDays === form.planDays;
  const price = keepsBookedAmount ? ad.amount : priceOf(form.planDays);
  const set = <K extends keyof AdFormValues>(key: K, value: AdFormValues[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const pickMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) return setError('Choose an image (JPG / PNG) or a video (MP4).');
    if (isImage && file.size > AD_MAX_IMAGE_MB * 1024 * 1024) return setError(`The image must be under ${AD_MAX_IMAGE_MB} MB.`);
    if (isVideo && file.size > AD_MAX_VIDEO_MB * 1024 * 1024) return setError(`The video must be under ${AD_MAX_VIDEO_MB} MB.`);
    try {
      const info = await readMediaInfo(file);
      if (info.kind === 'video' && (info.seconds ?? 0) > AD_MAX_VIDEO_SECONDS + 1) {
        return setError(
          `That video is ${Math.round(info.seconds ?? 0)} seconds. Ads can be at most ${AD_MAX_VIDEO_SECONDS} seconds.`,
        );
      }
      setError('');
      if (media?.file) URL.revokeObjectURL(media.url);
      setMedia({ kind: info.kind, url: URL.createObjectURL(file), file, seconds: info.seconds });
      upload.current = null;
      setMediaStatus(null);
      // Taller than wide → vertical, else horizontal (can still be changed below).
      if (info.width && info.height) set('orientation', info.height > info.width ? 'vertical' : 'horizontal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That file could not be read.');
    }
  };

  /**
   * Uploads a newly picked file straight to Cloudinary (first, so the ad is only booked once
   * its image / video is safely up) and returns what to send with the ad: the new file's
   * address, or nothing when the media didn't change.
   */
  const uploadMedia = async (): Promise<{ imageUrl?: string | null; videoUrl?: string | null }> => {
    if (!media) return {};
    if (!media.file) {
      const current = ad?.videoUrl ?? ad?.imageUrls[0] ?? null;
      if (media.url === current) return {};
      return media.kind === 'image' ? { imageUrl: media.url } : { videoUrl: media.url };
    }
    // Uploaded only now, on Save / Book. A file already uploaded by an earlier save that then
    // failed (e.g. a form error) is reused instead of being sent again.
    if (upload.current?.file !== media.file || mediaStatus?.state === 'failed') {
      startUpload(media.file, media.kind);
    }
    const url = await (upload.current as { promise: Promise<string> }).promise;
    return media.kind === 'image' ? { imageUrl: url } : { videoUrl: url };
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.advertiserName.trim().length < 2) return setError('Enter the business name.');
    if (!media) return setError('Add the ad: one image or one video.');
    if (!place) return setError('Set where the ad is: use the current location or select it on the map.');
    if (!form.startDate) return setError('Choose a start date.');
    setError('');
    setSaving(true);
    try {
      // The file goes up first; the ad (with it) is then saved in one step, so it's never
      // booked without its image / video.
      const uploaded = await uploadMedia();
      setProgress('Saving the ad…');
      const body: SaveAd = {
        ...form,
        ...uploaded,
        latitude: place.latitude,
        longitude: place.longitude,
        locationText: place.locationName,
      };
      const saved = ad ? await adsApi.update(ad.id, body) : await adsApi.create(body);
      showToast({
        variant: 'success',
        title: ad ? 'Ad updated' : `Ad booked — bill ${billNumber(saved)}`,
        message: ad ? undefined : 'Download the bill from the ad page.',
      });
      navigate(`/ads/${saved.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error && !(err as { statusCode?: number }).statusCode ? err.message : getErrorMessage(err));
    } finally {
      setSaving(false);
      setProgress('');
    }
  };

  return (
    <form onSubmit={submit} className="grid-2">
      <div className="glass card">
        <div className="card-title">
          <FontAwesomeIcon icon={faStore} /> Who is advertising
        </div>
        <label className="field">
          <span>Business name *</span>
          <input
            value={form.advertiserName}
            onChange={(e) => set('advertiserName', e.target.value)}
            maxLength={80}
            placeholder="e.g. Sri Sai Textiles"
          />
        </label>
        <label className="field">
          <span>Business phone (optional — on the bill)</span>
          <input
            value={form.advertiserPhone}
            onChange={(e) => set('advertiserPhone', e.target.value)}
            inputMode="tel"
            maxLength={15}
            placeholder="Mobile number"
          />
        </label>

        <div className="card-title" style={{ marginTop: 10 }}>
          <FontAwesomeIcon icon={faBullhorn} /> The ad
        </div>
        <div className="field">
          <span>Image or video * (one)</span>
          <div className="ad-image-pick">
            {media ? (
              <div className={`ad-frame ${form.orientation}`}>
                {media.kind === 'video' ? <video src={media.url} muted controls playsInline /> : <img src={media.url} alt="" />}
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Remove"
                  disabled={saving}
                  onClick={() => {
                    if (media.file) URL.revokeObjectURL(media.url);
                    setMedia(null);
                    upload.current = null;
                    setMediaStatus(null);
                  }}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
            ) : null}
            {media ? (
              <span className="muted" style={{ fontSize: 12 }}>
                {form.orientation === 'vertical' ? 'Vertical (9:16)' : 'Horizontal (16:9)'} — from the file's shape
              </span>
            ) : null}
            {media?.file && !mediaStatus ? (
              <div className="ad-upload ad-upload-picked">
                <div className="ad-upload-text">
                  <FontAwesomeIcon icon={media.kind === 'video' ? faVideo : faImage} />
                  <span>
                    {(media.file.size / 1024 / 1024).toFixed(1)} MB
                    {media.seconds ? ` · ${Math.round(media.seconds)} seconds` : ''} — not uploaded yet. It goes up when you tap{' '}
                    {ad ? 'Save Changes' : 'Book Ad'}.
                  </span>
                </div>
              </div>
            ) : null}
            <label className={`btn btn-ghost${saving ? ' btn-locked' : ''}`} aria-disabled={saving}>
              <FontAwesomeIcon icon={media?.kind === 'video' ? faVideo : faImage} /> {media ? 'Change' : 'Choose image or video'}
              <input type="file" accept="image/*,video/*" onChange={pickMedia} disabled={saving} hidden />
            </label>
            <span className="muted" style={{ fontSize: 12 }}>
              Image: JPG / PNG up to {AD_MAX_IMAGE_MB} MB. Video: up to {AD_MAX_VIDEO_SECONDS} seconds and {AD_MAX_VIDEO_MB} MB.
              Play it here first — nothing is uploaded until you save, and then it goes up exactly as it is (keep this tab open
              until it finishes). Vertical or horizontal is worked out from its shape.
            </span>
          </div>
        </div>
        {media?.kind === 'video' ? (
          <p className="muted" style={{ fontSize: 13, margin: '-4px 0 14px' }}>
            Shows for the whole video{media.seconds ? ` (${Math.round(media.seconds)} seconds)` : ''}, then it can be closed.
          </p>
        ) : (
          <label className="field">
            <span>Show the image for (seconds) — then it can be closed</span>
            <input
              type="number"
              min={3}
              max={30}
              value={form.displaySeconds}
              onChange={(e) => set('displaySeconds', Math.max(3, Math.min(30, Math.round(Number(e.target.value) || 15))))}
            />
          </label>
        )}
        <label className="field">
          <span>Link (optional) — opens when people tap the ad</span>
          <input
            value={form.linkUrl}
            onChange={(e) => set('linkUrl', e.target.value)}
            inputMode="url"
            maxLength={500}
            placeholder="e.g. sritextiles.com or a WhatsApp / Instagram / Maps link"
          />
        </label>
        <PlaceField
          label="Where to show the ad *"
          hint={`Shown only to people within ${AD_RADIUS_KM} km of this place.`}
          value={place}
          onChange={setPlace}
        />
      </div>

      <div className="glass card">
        <div className="card-title">
          <FontAwesomeIcon icon={faReceipt} /> Booking
        </div>
        <div className="field">
          <span>How long</span>
          <div className="ad-plans">
            {AD_PLANS.map((plan) => (
              <button
                key={plan.days}
                type="button"
                className={`ad-plan${form.planDays === plan.days ? ' active' : ''}`}
                onClick={() => set('planDays', plan.days as AdPlanDays)}
              >
                <strong>{plan.label}</strong>
                <span>{priceOf(plan.days) === undefined ? '…' : rupees(priceOf(plan.days))}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Starts on</span>
          <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </label>
        <div className="field">
          <span>Paid by</span>
          <div className="chips">
            {(['cash', 'upi', 'other', 'pending'] as AdPaymentMethod[]).map((method) => (
              <button
                key={method}
                type="button"
                className={`chip${form.paymentMethod === method ? ' active' : ''}`}
                onClick={() => set('paymentMethod', method)}
              >
                {PAYMENT_LABEL[method]}
              </button>
            ))}
          </div>
        </div>
        {media?.file && mediaStatus ? (
          <div className={`ad-upload ad-upload-above ad-upload-${mediaStatus.state}`}>
            <div className="ad-upload-text">
              {mediaStatus.state === 'working' ? <Spinner small /> : null}
              {mediaStatus.state === 'ready' ? <FontAwesomeIcon icon={faCircleCheck} /> : null}
              {mediaStatus.state === 'failed' ? <FontAwesomeIcon icon={faXmark} /> : null}
              <span>{mediaStatus.text}</span>
            </div>
            {mediaStatus.state === 'working' ? (
              <div className="ad-upload-track">
                <div className="ad-upload-fill" style={{ width: `${Math.round(mediaStatus.share * 100)}%` }} />
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="ad-total">
          <div>
            <div className="muted" style={{ fontSize: 13 }}>
              Runs {form.startDate ? `${dayLabel(form.startDate)} – ${dayLabel(endDateFor(form.startDate, form.planDays))}` : '—'}
            </div>
            <div className="ad-total-amount">{price === undefined ? '…' : rupees(price)}</div>
            {keepsBookedAmount ? (
              <div className="muted" style={{ fontSize: 12 }}>
                Booked price — kept even if prices change
              </div>
            ) : null}
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? <Spinner small /> : ad ? 'Save Changes' : 'Book Ad'}
          </button>
          {progress ? (
            <div className="muted" style={{ fontSize: 13, width: '100%', textAlign: 'right' }}>
              {progress}
            </div>
          ) : null}
        </div>
        {error ? (
          <div style={{ marginTop: 12 }}>
            <Notice tone="error" icon={faXmark}>
              {error}
            </Notice>
          </div>
        ) : null}
      </div>
    </form>
  );
}

export function AdNewPage() {
  return (
    <>
      <Topbar title="Book New Ad" subtitle="after the business has paid" />
      <BackLink to="/ads" label="All ads" />
      <AdForm />
    </>
  );
}

export function AdEditPage() {
  const { id = '' } = useParams();
  const { data, error, loading, reload } = useApi(() => adsApi.get(id), [id]);
  return (
    <>
      <Topbar title="Edit Ad" subtitle={data ? billNumber(data) : 'change the ad or its booking'} />
      <BackLink to={`/ads/${id}`} label="Back to the ad" />
      {loading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data.status === 'deleted' ? (
        <Notice tone="error" icon={faTrash}>
          This ad was deleted, so it can't be changed. Its bill is still in the history.
        </Notice>
      ) : (
        <AdForm ad={data} />
      )}
    </>
  );
}

// ---------------- One ad ----------------

export function AdDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: ad, error, loading, reload, setData } = useApi(() => adsApi.get(id), [id]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reviewing, setReviewing] = useState<'approve' | 'reject' | null>(null);

  if (loading) return <Loading />;
  if (error || !ad) {
    return (
      <>
        <Topbar title="Ad" />
        <ErrorState error={error} onRetry={reload} />
      </>
    );
  }

  const status = STATUS[ad.status];
  const tapRate = ad.impressions ? `${((ad.clicks / ad.impressions) * 100).toFixed(1)}%` : '—';

  return (
    <>
      <Topbar
        title={ad.title}
        subtitle={`${billNumber(ad)} · ${ad.advertiserName}`}
        actions={
          <button className="btn btn-primary" onClick={() => downloadAdBill(ad)}>
            <FontAwesomeIcon icon={faFilePdf} /> Download Bill
          </button>
        }
      />
      <BackLink to="/ads" label="All ads" />

      {ad.status === 'in_review' ? (
        <div className="glass card review-card">
          <div className="card-title">
            <FontAwesomeIcon icon={faBullhorn} /> Waiting for your review
          </div>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 14 }}>
            {ad.advertiserName} booked this on the Triolo Ads website. It is not shown in the apps until you approve it — then it
            runs {dayLabel(ad.startDate)} – {dayLabel(ad.endDate)}. Payment: not paid yet (online payment is coming soon; record
            cash / UPI with Edit).
          </p>
          {rejecting ? (
            <label className="field">
              <span>Why is it rejected? (the business sees this)</span>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder="e.g. The picture is blurry — please upload a clearer one."
                autoFocus
              />
            </label>
          ) : null}
          <div className="actions">
            {rejecting ? (
              <>
                <button className="btn btn-ghost" onClick={() => setRejecting(false)} disabled={reviewing !== null}>
                  Back
                </button>
                <button
                  className="btn btn-danger"
                  disabled={reviewing !== null || rejectNote.trim().length < 3}
                  onClick={async () => {
                    setReviewing('reject');
                    try {
                      setData(await adsApi.review(ad.id, 'reject', rejectNote.trim()));
                      setRejecting(false);
                      showToast({ variant: 'success', title: 'Ad rejected', message: 'The business sees your reason.' });
                    } catch (err) {
                      showToast({ variant: 'error', title: 'Not rejected', message: getErrorMessage(err) });
                    } finally {
                      setReviewing(null);
                    }
                  }}
                >
                  {reviewing === 'reject' ? <Spinner small /> : 'Reject Ad'}
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-danger" onClick={() => setRejecting(true)} disabled={reviewing !== null}>
                  <FontAwesomeIcon icon={faXmark} /> Reject
                </button>
                <button
                  className="btn btn-primary"
                  disabled={reviewing !== null}
                  onClick={async () => {
                    setReviewing('approve');
                    try {
                      setData(await adsApi.review(ad.id, 'approve'));
                      showToast({ variant: 'success', title: 'Ad approved', message: 'It runs from its start date.' });
                    } catch (err) {
                      showToast({ variant: 'error', title: 'Not approved', message: getErrorMessage(err) });
                    } finally {
                      setReviewing(null);
                    }
                  }}
                >
                  {reviewing === 'approve' ? <Spinner small /> : 'Approve'}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {ad.status === 'rejected' && ad.reviewNote ? (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="error" icon={faXmark}>
            Rejected: {ad.reviewNote}
          </Notice>
        </div>
      ) : null}

      {ad.latitude == null && ad.status !== 'deleted' ? (
        <div style={{ marginBottom: 16 }}>
          <Notice tone="warning" icon={faLocationDot}>
            This ad has no place yet, so nobody sees it. Edit it and set where it is — it shows to people within {ad.radiusKm} km.
          </Notice>
        </div>
      ) : null}

      <div className="grid-2">
        <div className="glass card">
          <div className={`ad-preview ad-frame ${ad.orientation}`}>
            {ad.videoUrl ? (
              <video src={ad.videoUrl} muted autoPlay loop controls playsInline />
            ) : ad.imageUrls[0] ? (
              <img src={ad.imageUrls[0]} alt="" />
            ) : (
              <div className="ad-preview-blank">
                <FontAwesomeIcon icon={faBullhorn} />
              </div>
            )}
            <span className="ad-preview-tag">Ad</span>
          </div>
          {!ad.videoUrl && ad.imageUrls.length === 0 && (ad.status === 'ended' || ad.status === 'deleted') ? (
            <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
              Its image / video was deleted when the ad {ad.status === 'ended' ? 'ended' : 'was deleted'}.
            </p>
          ) : null}
          <h3 style={{ margin: '14px 0 4px' }}>{ad.advertiserName}</h3>
          <div className="muted" style={{ fontSize: 13 }}>
            {ad.orientation === 'vertical' ? 'Vertical (9:16)' : 'Horizontal (16:9)'} ·{' '}
            {ad.videoUrl ? `video, ${ad.durationSeconds} s` : `image, shown ${ad.displaySeconds} s`} before it can be closed
          </div>
          <div className="info">
            {ad.advertiserPhone ? (
              <InfoRow icon={faPhone} label="Business phone">
                {ad.advertiserPhone}
              </InfoRow>
            ) : null}
            {ad.linkUrl ? (
              <InfoRow icon={faLink} label="Opens when tapped">
                <a href={ad.linkUrl} target="_blank" rel="noreferrer">
                  {ad.linkUrl}
                </a>
              </InfoRow>
            ) : null}
            <InfoRow icon={faLocationDot} label="Shown to people near">
              {ad.locationText ?? '—'}
              {ad.latitude != null ? ` · within ${ad.radiusKm} km` : ''}
            </InfoRow>
          </div>
        </div>

        <div>
          <div className="glass card">
            <div className="card-title">
              <FontAwesomeIcon icon={faReceipt} /> Booking
              <span className="count">
                <Badge tone={status.tone}>{status.label}</Badge>
              </span>
            </div>
            <div className="info">
              <InfoRow icon={faCalendarDays} label={`${planLabel(ad.planDays)} plan`}>
                {dayLabel(ad.startDate)} – {dayLabel(ad.endDate)}
              </InfoRow>
              <InfoRow icon={faReceipt} label={ad.paymentMethod === 'pending' ? 'Price' : 'Paid'}>
                {ad.paymentMethod === 'pending'
                  ? `${rupees(ad.amount)} · not paid yet`
                  : `${rupees(ad.amount)} by ${PAYMENT_LABEL[ad.paymentMethod]}`}{' '}
                · bill {billNumber(ad)}
              </InfoRow>
              <InfoRow icon={faStore} label="Booked by">
                {ad.ownerAccountId ? 'The business, on the Triolo Ads website' : 'You (admin)'}
              </InfoRow>
              <InfoRow icon={faStore} label="Billed to">
                {ad.advertiserName}
                {ad.advertiserPhone ? ` · ${ad.advertiserPhone}` : ''}
              </InfoRow>
            </div>
            <div className="row-meta" style={{ marginTop: 6 }}>
              Booked {timeAgo(ad.createdAt)}
              {ad.deletedAt ? ` · deleted ${timeAgo(ad.deletedAt)}` : ''}
            </div>
          </div>

          <div className="glass card">
            <div className="card-title">
              <FontAwesomeIcon icon={faEye} /> How it's doing
            </div>
            <div className="ad-numbers">
              <div>
                <strong>{ad.impressions.toLocaleString('en-IN')}</strong>
                <span>
                  <FontAwesomeIcon icon={faEye} /> Views
                </span>
              </div>
              <div>
                <strong>{ad.clicks.toLocaleString('en-IN')}</strong>
                <span>
                  <FontAwesomeIcon icon={faHandPointer} /> Opens
                </span>
              </div>
              <div>
                <strong>{tapRate}</strong>
                <span>Open rate</span>
              </div>
            </div>
          </div>

          {ad.status !== 'deleted' ? (
            <div className="glass card actions">
              <Link to={`/ads/${ad.id}/edit`} className="btn btn-ghost">
                <FontAwesomeIcon icon={faPen} /> Edit
              </Link>
              <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                <FontAwesomeIcon icon={faTrash} /> Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        icon={faTrash}
        tone="danger"
        title="Delete this ad?"
        message="It stops showing in the apps straight away. It stays in the history with its bill."
        confirmLabel="Delete"
        onConfirm={async () => {
          try {
            setData(await adsApi.remove(ad.id));
            setConfirmDelete(false);
            showToast({ variant: 'success', title: 'Ad deleted', message: 'It is no longer shown.' });
            navigate('/ads');
          } catch (err) {
            showToast({ variant: 'error', title: 'Not deleted', message: getErrorMessage(err) });
          }
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}
