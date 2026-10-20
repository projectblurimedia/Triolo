import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBullhorn,
  faCalendarDays,
  faCircleCheck,
  faClock,
  faEye,
  faHandPointer,
  faImage,
  faLink,
  faLocationDot,
  faPen,
  faPhone,
  faPlus,
  faReceipt,
  faRotateLeft,
  faStore,
  faVideo,
  faWallet,
  faXmark,
  faIdBadge,
} from '@fortawesome/free-solid-svg-icons';
import { Topbar } from '@/components/Layout';
import {
  ACTION_LABEL,
  AdActionDetails,
  AdActionTop,
  AdActionValue,
  EMPTY_ACTION,
  actionBody,
  actionFromAd,
  actionProblem,
  promotesProfile,
} from '@/components/AdActionField';
import { ConfirmModal } from '@/components/ConfirmModal';
import { BackLink, Badge, ErrorState, InfoRow, Loading, Notice, Spinner } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import {
  Ad,
  AD_MAX_IMAGE_MB,
  AD_MAX_VIDEO_MB,
  AD_MAX_VIDEO_SECONDS,
  AD_PLANS,
  AdOrientation,
  AdPlanDays,
  AdStatus,
  adsApi,
  uploadAdFile,
} from '@/services/adsApi';
import { getErrorMessage } from '@/services/errorMessages';
import { showToast } from '@/state/toastStore';
import { useAuthStore } from '@/state/authStore';
import { rupees, timeAgo, Tone } from '@/utils/format';

const STATUS: Record<AdStatus, { label: string; tone: Tone; help: string }> = {
  in_review: { label: 'In review', tone: 'warning', help: 'Triolo is checking your ad. It is not shown yet.' },
  rejected: { label: 'Not approved', tone: 'error', help: 'Change it as asked and send it again.' },
  scheduled: { label: 'Approved · starts soon', tone: 'info', help: 'Approved — it starts showing on its start date.' },
  running: { label: 'Showing now', tone: 'success', help: 'People near you see it when they open the Triolo apps.' },
  ended: { label: 'Ended', tone: 'muted', help: 'Its days are over.' },
  deleted: { label: 'Withdrawn', tone: 'muted', help: 'You took it back.' },
};

/** Today's date in India as YYYY-MM-DD (ads run by the India calendar day). */
function todayInIndia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const editable = (ad: Ad) => ad.status === 'in_review' || ad.status === 'rejected';

function AdThumb({ ad }: { ad: Ad }) {
  return (
    <span className="my-ad-media">
      {ad.videoUrl ? (
        <video src={ad.videoUrl} muted playsInline preload="metadata" />
      ) : ad.imageUrls[0] ? (
        <img src={ad.imageUrls[0]} alt="" loading="lazy" />
      ) : (
        <FontAwesomeIcon icon={ad.promoted ? faIdBadge : faBullhorn} />
      )}
    </span>
  );
}

// ---------- My ads ----------

export function MyAdsPage() {
  const account = useAuthStore((state) => state.account);
  const list = useApi(() => adsApi.list(), []);

  return (
    <>
      <Topbar
        title="My Ads"
        subtitle="Book ads that people near your business see in the Triolo apps"
        actions={
          <Link to="/new" className="btn btn-primary">
            <FontAwesomeIcon icon={faPlus} /> Book an Ad
          </Link>
        }
      />

      {list.loading ? (
        <Loading />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.data.length === 0 ? (
        <>
          <div className="welcome">
            <h2>Hi {account?.fullName?.split(' ')[0] ?? 'there'} — reach customers near your shop</h2>
            <p>
              Your picture or short video shows full screen in the Triolo apps — to everyone, or with directions, to people near your place.
              Book it here in a few minutes; Triolo checks it and it goes live on your start date.
            </p>
            <Link to="/new" className="btn">
              <FontAwesomeIcon icon={faPlus} /> Book your first ad
            </Link>
          </div>
          <HowItWorksSteps />
        </>
      ) : (
        <div className="my-ads">
          {list.data.map((ad) => {
            const status = STATUS[ad.status];
            return (
              <Link key={ad.id} to={`/ads/${ad.id}`} className="glass my-ad">
                <AdThumb ad={ad} />
                <div>
                  <div className="my-ad-top">
                    <span className="my-ad-name">{ad.advertiserName}</span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <div className="my-ad-meta">
                    {AD_PLANS.find((plan) => plan.days === ad.planDays)?.label} · {dayLabel(ad.startDate)} –{' '}
                    {dayLabel(ad.endDate)} · {rupees(ad.amount)}
                  </div>
                  {ad.status === 'running' || ad.status === 'ended' ? (
                    <div className="my-ad-numbers">
                      <span>
                        <FontAwesomeIcon icon={faEye} /> {ad.impressions.toLocaleString('en-IN')} views
                      </span>
                      <span>
                        <FontAwesomeIcon icon={faHandPointer} /> {ad.clicks.toLocaleString('en-IN')} opens
                      </span>
                    </div>
                  ) : null}
                  {ad.status === 'rejected' && ad.reviewNote ? <div className="my-ad-note">Why: {ad.reviewNote}</div> : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

// ---------- How it works ----------

function HowItWorksSteps() {
  const steps = [
    {
      title: 'Make your ad',
      text: 'One picture or a short video (up to 30 seconds), vertical or wide. Choose what tapping it does: a link, directions, or your Triolo profile.',
    },
    {
      title: 'Choose where and when',
      text: 'Pick 1 day, 3 days, a week or a month, and the start date. Want directions to your shop? Pin it on the map.',
    },
    {
      title: 'Triolo checks it',
      text: 'We review every ad so the apps stay clean and safe — usually within a day. If something needs fixing, we tell you why.',
    },
    {
      title: 'It goes live nearby',
      text: 'People around your place see it full screen in the Triolo apps. Watch the views and opens here.',
    },
  ];
  return (
    <div className="steps">
      {steps.map((step, index) => (
        <div key={step.title} className="glass step-card">
          <div className="step-num">{index + 1}</div>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </div>
      ))}
    </div>
  );
}

export function HowItWorksPage() {
  const info = useApi(() => adsApi.info(), []);
  return (
    <>
      <Topbar title="How It Works" subtitle="Booking an ad in the Triolo apps" />
      <HowItWorksSteps />
      <div className="glass card" style={{ marginTop: 16 }}>
        <div className="card-title">
          <FontAwesomeIcon icon={faReceipt} /> Prices
        </div>
        {info.data ? (
          <div className="ad-plans">
            {AD_PLANS.map((plan) => (
              <div key={plan.days} className="ad-plan">
                <strong>{plan.label}</strong>
                <span>{rupees(info.data!.prices[String(plan.days) as keyof typeof info.data.prices])}</span>
              </div>
            ))}
          </div>
        ) : (
          <Loading />
        )}
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
          Your ad is shown to everyone — or, with directions, to people within {info.data?.radiusKm ?? 5} km of that place.
          Every running ad gets an equal share of views each day.
        </p>
      </div>
      <div className="glass card">
        <div className="card-title">
          <FontAwesomeIcon icon={faWallet} /> Payment <span className="soon-tag">Coming soon</span>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          Paying online here is coming soon. For now, send your ad for review — once it's approved, Triolo contacts you on your
          mobile number to take the payment by cash or UPI.
        </p>
      </div>
    </>
  );
}

// ---------- Book / edit ----------

interface MediaPick {
  kind: 'image' | 'video';
  url: string;
  file?: File;
  seconds?: number | null;
}

interface UploadStatus {
  text: string;
  share: number;
  state: 'working' | 'ready' | 'failed';
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
  const info = useApi(() => adsApi.info(), []);
  const [advertiserName, setAdvertiserName] = useState(ad?.advertiserName ?? '');
  // What tapping the ad does (nothing / link / directions / your Triolo profile).
  const [action, setAction] = useState<AdActionValue>(() => (ad ? actionFromAd(ad) : EMPTY_ACTION));
  const [description, setDescription] = useState(ad?.description ?? '');
  const [orientation, setOrientation] = useState<AdOrientation>(ad?.orientation ?? 'vertical');
  // A picture shows for 15 seconds (a video for its own length); not asked any more.
  const displaySeconds = ad?.displaySeconds ?? 15;
  const [planDays, setPlanDays] = useState<AdPlanDays>(ad?.planDays ?? 7);
  // A business can't start in the past; tomorrow by default, so there's time for the review.
  const [startDate, setStartDate] = useState(ad && ad.startDate >= todayInIndia() ? ad.startDate : addDays(todayInIndia(), 1));
  const [media, setMedia] = useState<MediaPick | null>(() =>
    ad?.videoUrl
      ? { kind: 'video', url: ad.videoUrl, seconds: ad.videoSeconds }
      : ad?.imageUrls[0]
        ? { kind: 'image', url: ad.imageUrls[0] }
        : null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // A picked file is only previewed; it's uploaded when the ad is sent.
  const upload = useRef<{ file: File; promise: Promise<string> } | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);

  const price = info.data?.prices[String(planDays) as keyof typeof info.data.prices];

  const startUpload = (file: File, kind: 'image' | 'video') => {
    const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
    const isCurrent = () => upload.current?.file === file;
    const status = (next: UploadStatus) => {
      if (isCurrent()) setUploadStatus(next);
    };
    const promise = (async () => {
      status({ text: `Uploading your ${kind} — 0% (0 of ${mb(file.size)} MB)`, share: 0, state: 'working' });
      const { url } = await uploadAdFile(file, kind, (share, sent, total) =>
        status({
          text:
            share < 1
              ? `Uploading your ${kind} — ${Math.round(share * 100)}% (${mb(sent)} of ${mb(total)} MB)`
              : `Uploaded — preparing your ${kind}…`,
          share,
          state: 'working',
        }),
      );
      status({ text: `${kind === 'video' ? 'Video' : 'Picture'} uploaded`, share: 1, state: 'ready' });
      return url;
    })();
    promise.catch((err) => status({ text: err instanceof Error ? err.message : 'Upload failed', share: 0, state: 'failed' }));
    upload.current = { file, promise };
  };

  const pickMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) return setError('Choose a picture (JPG / PNG) or a video (MP4).');
    if (isImage && file.size > AD_MAX_IMAGE_MB * 1024 * 1024) return setError(`The picture must be under ${AD_MAX_IMAGE_MB} MB.`);
    if (isVideo && file.size > AD_MAX_VIDEO_MB * 1024 * 1024) return setError(`The video must be under ${AD_MAX_VIDEO_MB} MB.`);
    try {
      const picked = await readMediaInfo(file);
      if (picked.kind === 'video' && (picked.seconds ?? 0) > AD_MAX_VIDEO_SECONDS + 1) {
        return setError(`That video is ${Math.round(picked.seconds ?? 0)} seconds — ads can be at most ${AD_MAX_VIDEO_SECONDS}.`);
      }
      setError('');
      if (media?.file) URL.revokeObjectURL(media.url);
      setMedia({ kind: picked.kind, url: URL.createObjectURL(file), file, seconds: picked.seconds });
      upload.current = null;
      setUploadStatus(null);
      // Taller than wide → vertical (reel / poster), else horizontal.
      if (picked.width && picked.height) setOrientation(picked.height > picked.width ? 'vertical' : 'horizontal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That file could not be read.');
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const actionError = actionProblem(action);
    if (actionError) return setError(actionError);
    if (!promotesProfile(action) && advertiserName.trim().length < 2) return setError('Enter your business name.');
    if (!promotesProfile(action) && !media) return setError('Add your ad: one picture or one video.');
    if (!startDate || startDate < todayInIndia()) return setError('Choose a start date from today on.');
    setError('');
    setSaving(true);
    try {
      let mediaBody: { imageUrl?: string | null; videoUrl?: string | null };
      if (promotesProfile(action) || !media) {
        // A profile ad has no picture or video.
        mediaBody = {};
      } else if (media.file) {
        if (upload.current?.file !== media.file || uploadStatus?.state === 'failed') startUpload(media.file, media.kind);
        const url = await (upload.current as { promise: Promise<string> }).promise;
        mediaBody = media.kind === 'image' ? { imageUrl: url } : { videoUrl: url };
      } else {
        mediaBody = media.kind === 'image' ? { imageUrl: media.url } : { videoUrl: media.url };
      }
      const body = {
        // A promoted Triolo Partner profile's own name is used.
        advertiserName: promotesProfile(action) ? undefined : advertiserName.trim(),
        description: description.trim() || undefined,
        ...actionBody(action),
        orientation,
        displaySeconds,
        planDays,
        startDate,
        ...mediaBody,
      };
      const saved = ad ? await adsApi.update(ad.id, body) : await adsApi.create(body);
      showToast({ variant: 'success', title: 'Sent for review', message: 'Triolo checks your ad — usually within a day.' });
      navigate(`/ads/${saved.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error && !(err as { statusCode?: number }).statusCode ? err.message : getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid-2">
      <div className="glass card">
        <div className="card-title">
          <FontAwesomeIcon icon={faStore} /> Your business
        </div>
        <AdActionTop value={action} onChange={setAction} mine disabled={saving} />
        {promotesProfile(action) ? null : (
          <label className="field">
            <span>Business name *</span>
            <input
              value={advertiserName}
              onChange={(e) => setAdvertiserName(e.target.value)}
              maxLength={80}
              placeholder="e.g. Sri Sai Textiles"
            />
          </label>
        )}
        <AdActionDetails value={action} onChange={setAction} disabled={saving} />

        <div className="card-title" style={{ marginTop: 10 }}>
          <FontAwesomeIcon icon={faBullhorn} /> The ad
        </div>
        {promotesProfile(action) ? (
          <div className="profile-ad-note">
            <FontAwesomeIcon icon={faIdBadge} />
            <div>
              <strong>No picture or video needed</strong>
              The apps show your profile as a card — photo, name, rating and what they do — with a big Book Now / Order from
              this Shop / Contact button.
            </div>
          </div>
        ) : (
        <div className="field">
          <span>Picture or video * (one)</span>
          <div className="ad-image-pick">
            {media ? (
              <div className={`ad-frame ${orientation}`}>
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
                    setUploadStatus(null);
                  }}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
            ) : null}
            {media ? (
              <span className="muted" style={{ fontSize: 12 }}>
                {orientation === 'vertical' ? 'Vertical (9:16)' : 'Horizontal (16:9)'} — from its shape
                {media.file ? ` · ${(media.file.size / 1024 / 1024).toFixed(1)} MB, uploaded when you send the ad` : ''}
              </span>
            ) : null}
            <label className={`btn btn-ghost${saving ? ' btn-locked' : ''}`} aria-disabled={saving}>
              <FontAwesomeIcon icon={media?.kind === 'video' ? faVideo : faImage} />{' '}
              {media ? 'Change' : 'Choose picture or video'}
              <input type="file" accept="image/*,video/*" onChange={pickMedia} disabled={saving} hidden />
            </label>
            <span className="muted" style={{ fontSize: 12 }}>
              Picture: JPG / PNG up to {AD_MAX_IMAGE_MB} MB. Video: up to {AD_MAX_VIDEO_SECONDS} seconds and {AD_MAX_VIDEO_MB} MB.
              Vertical (like a reel or poster) fills the phone screen best.
            </span>
          </div>
        </div>
        )}
        {!promotesProfile(action) && media?.kind === 'video' ? (
          <p className="muted" style={{ fontSize: 13, margin: '-4px 0 14px' }}>
            Shows for the whole video{media.seconds ? ` (${Math.round(media.seconds)} seconds)` : ''}, then people can close it.
          </p>
        ) : null}
        <label className="field">
          <span>A few words (optional) — shown on the ad</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={600}
            rows={2}
            placeholder="e.g. Diwali offer — 30% off on all sarees"
          />
        </label>
      </div>

      <div className="glass card">
        <div className="card-title">
          <FontAwesomeIcon icon={faCalendarDays} /> When
        </div>
        <div className="field">
          <span>How long</span>
          <div className="ad-plans">
            {AD_PLANS.map((plan) => (
              <button
                key={plan.days}
                type="button"
                className={`ad-plan${planDays === plan.days ? ' active' : ''}`}
                onClick={() => setPlanDays(plan.days)}
              >
                <strong>{plan.label}</strong>
                <span>{info.data ? rupees(info.data.prices[String(plan.days) as keyof typeof info.data.prices]) : '…'}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Starts on</span>
          <input type="date" value={startDate} min={todayInIndia()} onChange={(e) => setStartDate(e.target.value)} />
        </label>

        <div className="pay-soon">
          <FontAwesomeIcon icon={faWallet} style={{ marginTop: 3, color: 'var(--primary)' }} />
          <div>
            <strong>
              Payment <span className="soon-tag">Coming soon</span>
            </strong>
            Online payment is coming soon. Send your ad for review now — once it's approved, Triolo contacts you to take the
            payment by cash or UPI.
          </div>
        </div>

        {uploadStatus ? (
          <div className={`ad-upload ad-upload-above ad-upload-${uploadStatus.state}`}>
            <div className="ad-upload-text">
              {uploadStatus.state === 'working' ? <Spinner small /> : null}
              {uploadStatus.state === 'ready' ? <FontAwesomeIcon icon={faCircleCheck} /> : null}
              {uploadStatus.state === 'failed' ? <FontAwesomeIcon icon={faXmark} /> : null}
              <span>{uploadStatus.text}</span>
            </div>
            {uploadStatus.state === 'working' ? (
              <div className="ad-upload-track">
                <div className="ad-upload-fill" style={{ width: `${Math.round(uploadStatus.share * 100)}%` }} />
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="ad-total">
          <div>
            <div className="muted" style={{ fontSize: 13 }}>
              Runs {startDate ? `${dayLabel(startDate)} – ${dayLabel(addDays(startDate, planDays - 1))}` : '—'}
            </div>
            <div className="ad-total-amount">{price === undefined ? '…' : rupees(price)}</div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? <Spinner small /> : ad ? 'Send Changes for Review' : 'Send for Review'}
          </button>
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
      <Topbar title="Book an Ad" subtitle="Triolo checks every ad before it's shown" />
      <BackLink to="/" label="My ads" />
      <AdForm />
    </>
  );
}

export function AdEditPage() {
  const { id = '' } = useParams();
  const { data: ad, error, loading, reload } = useApi(() => adsApi.get(id), [id]);
  if (loading) return <Loading />;
  if (error || !ad) {
    return (
      <>
        <Topbar title="Change Ad" />
        <ErrorState error={error} onRetry={reload} />
      </>
    );
  }
  return (
    <>
      <Topbar title="Change Ad" subtitle="Your changes go back for review" />
      <BackLink to={`/ads/${ad.id}`} label="Back to the ad" />
      {editable(ad) ? (
        <AdForm ad={ad} />
      ) : (
        <Notice tone="info" icon={faCircleCheck}>
          This ad was approved, so it can't be changed. Book a new ad instead.
        </Notice>
      )}
    </>
  );
}

// ---------- One ad ----------

export function AdDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: ad, error, loading, reload, setData } = useApi(() => adsApi.get(id), [id]);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

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
  const openRate = ad.impressions ? `${((ad.clicks / ad.impressions) * 100).toFixed(1)}%` : '—';

  return (
    <>
      <Topbar
        title={ad.advertiserName}
        subtitle={`Booked ${timeAgo(ad.createdAt)}`}
        actions={
          editable(ad) ? (
            <Link to={`/ads/${ad.id}/edit`} className="btn btn-primary">
              <FontAwesomeIcon icon={faPen} /> Change
            </Link>
          ) : undefined
        }
      />
      <BackLink to="/" label="My ads" />

      <div style={{ marginBottom: 16 }}>
        <Notice
          tone={status.tone === 'muted' ? 'info' : status.tone}
          icon={ad.status === 'in_review' ? faClock : ad.status === 'rejected' ? faXmark : faCircleCheck}
        >
          <strong>{status.label}.</strong> {ad.status === 'rejected' && ad.reviewNote ? `Why: ${ad.reviewNote}. ` : ''}
          {status.help}
        </Notice>
      </div>

      <div className="grid-2">
        <div className="glass card">
          <div className={`ad-preview ad-frame ${ad.orientation}`}>
            {ad.videoUrl ? (
              <video src={ad.videoUrl} muted autoPlay loop controls playsInline />
            ) : ad.imageUrls[0] ? (
              <img src={ad.imageUrls[0]} alt="" />
            ) : (
              <div className="ad-preview-blank">
                <FontAwesomeIcon icon={ad.promoted ? faIdBadge : faBullhorn} />
                {ad.promoted ? <span className="ad-preview-name">{ad.promoted.name} — profile card</span> : null}
              </div>
            )}
            <span className="ad-preview-tag">Ad</span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>
            {ad.orientation === 'vertical' ? 'Vertical (9:16)' : 'Horizontal (16:9)'} ·{' '}
            {ad.videoUrl ? `video, ${ad.durationSeconds} s` : `picture, shown ${ad.displaySeconds} s`} before it can be closed
          </div>
          <div className="info">
            {ad.description ? (
              <InfoRow icon={faBullhorn} label="Words">
                {ad.description}
              </InfoRow>
            ) : null}
            {ad.advertiserPhone ? (
              <InfoRow icon={faPhone} label="Business phone">
                {ad.advertiserPhone}
              </InfoRow>
            ) : null}
            <InfoRow icon={faLink} label="When tapped">
              {ACTION_LABEL[ad.actionType ?? (ad.linkUrl ? 'link' : 'none')]}
              {ad.linkUrl ? (
                <>
                  {' — '}
                  <a href={ad.linkUrl} target="_blank" rel="noreferrer">
                    {ad.linkUrl}
                  </a>
                </>
              ) : null}
              {ad.destination ? ` — ${ad.destination.name}` : null}
              {ad.promoted ? ` — ${ad.promoted.name}` : null}
            </InfoRow>
            <InfoRow icon={faLocationDot} label="Shown to">
              {ad.latitude != null ? `People within ${ad.radiusKm} km of ${ad.locationText ?? 'your place'}` : 'Everyone, everywhere'}
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
              <InfoRow icon={faCalendarDays} label={AD_PLANS.find((plan) => plan.days === ad.planDays)?.label ?? ''}>
                {dayLabel(ad.startDate)} – {dayLabel(ad.endDate)}
              </InfoRow>
              <InfoRow icon={faWallet} label="Price">
                {rupees(ad.amount)} · {ad.paymentMethod === 'pending' ? 'not paid yet (online payment coming soon)' : 'paid'}
              </InfoRow>
            </div>
          </div>

          {ad.status === 'running' || ad.status === 'ended' ? (
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
                  <strong>{openRate}</strong>
                  <span>Open rate</span>
                </div>
              </div>
            </div>
          ) : null}

          {editable(ad) ? (
            <div className="glass card actions">
              <Link to={`/ads/${ad.id}/edit`} className="btn btn-ghost">
                <FontAwesomeIcon icon={faPen} /> Change
              </Link>
              <button className="btn btn-danger" onClick={() => setConfirmWithdraw(true)}>
                <FontAwesomeIcon icon={faRotateLeft} /> Withdraw
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmModal
        open={confirmWithdraw}
        icon={faRotateLeft}
        tone="danger"
        title="Withdraw this ad?"
        message="It won't be reviewed or shown. Its picture or video is deleted."
        confirmLabel="Withdraw"
        onConfirm={async () => {
          try {
            setData(await adsApi.withdraw(ad.id));
            setConfirmWithdraw(false);
            showToast({ variant: 'success', title: 'Ad withdrawn' });
            navigate('/');
          } catch (err) {
            showToast({ variant: 'error', title: 'Not withdrawn', message: getErrorMessage(err) });
          }
        }}
        onClose={() => setConfirmWithdraw(false)}
      />
    </>
  );
}
