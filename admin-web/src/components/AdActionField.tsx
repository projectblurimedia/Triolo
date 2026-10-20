import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBan,
  faBriefcase,
  faDiamondTurnRight,
  faIdBadge,
  faLink,
  faScrewdriverWrench,
  faStore,
} from '@fortawesome/free-solid-svg-icons';
import { PlaceField } from '@/components/PlaceField';
import { Dropdown, DropdownOption } from '@/components/Dropdown';
import type { PlaceValue } from '@/utils/place';

// Kept the same in admin-web and ads-web (`mine` = the ads website, where a business promotes
// its own Triolo Partner profile).

export type AdActionType = 'none' | 'link' | 'location' | 'service' | 'business' | 'job_post';
export type AdPromotedKind = 'service' | 'business' | 'job_post';

/** The dropdown's choice; promoting a profile has its own second choice (which profile). */
type ActionChoice = 'none' | 'link' | 'location' | 'promote';

export interface AdActionValue {
  choice: ActionChoice;
  promoteKind: AdPromotedKind;
  linkUrl: string;
  place: PlaceValue | null;
  /** The ad's mobile number: the Triolo Partner account's when promoting (required), else optional. */
  mobile: string;
}

/** The action fields an ad carries (both sites' Ad type has these). */
export interface AdActionSource {
  actionType?: AdActionType;
  linkUrl: string | null;
  destination?: { latitude: number; longitude: number; name: string } | null;
  promoteMobile?: string | null;
  advertiserPhone?: string | null;
}

export const EMPTY_ACTION: AdActionValue = { choice: 'none', promoteKind: 'service', linkUrl: '', place: null, mobile: '' };

const PROMOTE_KINDS: { kind: AdPromotedKind; label: string; button: string; icon: typeof faStore }[] = [
  { kind: 'service', label: 'Service', button: 'Book Now', icon: faScrewdriverWrench },
  { kind: 'business', label: 'Shop', button: 'Order from this Shop', icon: faStore },
  { kind: 'job_post', label: 'Job post', button: 'Contact', icon: faBriefcase },
];

function choiceOptions(mine: boolean): DropdownOption<ActionChoice>[] {
  return [
    { value: 'none', label: 'Nothing', description: 'The ad just promotes — no button', icon: faBan },
    { value: 'link', label: 'Open a link', description: 'A website, WhatsApp or Instagram page', icon: faLink },
    { value: 'location', label: 'Show directions', description: 'Opens the maps app with the way to a place', icon: faDiamondTurnRight },
    {
      value: 'promote',
      label: mine ? 'Promote my Triolo Partner profile' : 'Promote a Triolo Partner profile',
      description: 'A worker, shop or job post — Book Now / Order / Contact',
      icon: faIdBadge,
    },
  ];
}

export const ACTION_LABEL: Record<AdActionType, string> = {
  none: 'Nothing — the ad just promotes',
  link: 'Opens a link',
  location: 'Shows directions',
  service: 'Promotes a worker — Book Now',
  business: 'Promotes a shop — Order from this Shop',
  job_post: 'Promotes a job post — Contact',
};

/** Whether the ad promotes a Triolo Partner profile (then the business name comes from it). */
export function promotesProfile(value: AdActionValue): boolean {
  return value.choice === 'promote';
}

export function actionFromAd(ad: AdActionSource): AdActionValue {
  const type = ad.actionType ?? (ad.linkUrl ? 'link' : 'none');
  const promotes = type === 'service' || type === 'business' || type === 'job_post';
  return {
    choice: promotes ? 'promote' : type,
    promoteKind: promotes ? type : 'service',
    linkUrl: ad.linkUrl ?? '',
    place: ad.destination
      ? { latitude: ad.destination.latitude, longitude: ad.destination.longitude, locationName: ad.destination.name }
      : null,
    mobile: (promotes ? ad.promoteMobile : ad.advertiserPhone) ?? ad.advertiserPhone ?? '',
  };
}

/** What's missing for the chosen action, or null when it's complete. */
export function actionProblem(value: AdActionValue): string | null {
  if (value.choice === 'promote' && !/^\d{10}$/.test(value.mobile)) {
    return 'Enter the 10-digit mobile number of the Triolo Partner account.';
  }
  if (value.choice !== 'promote' && value.mobile && !/^\d{10}$/.test(value.mobile)) {
    return 'Enter a 10-digit mobile number, or leave it empty.';
  }
  if (value.choice === 'link' && !value.linkUrl.trim()) return 'Enter the link the ad opens.';
  if (value.choice === 'location' && !value.place) return 'Set the place for directions: current location or the map.';
  return null;
}

/** The fields sent with the ad (the mobile number is also the ad's phone). */
export function actionBody(value: AdActionValue) {
  const actionType: AdActionType = value.choice === 'promote' ? value.promoteKind : value.choice;
  return {
    actionType,
    advertiserPhone: value.mobile,
    promoteMobile: value.choice === 'promote' ? value.mobile : '',
    linkUrl: value.choice === 'link' ? value.linkUrl.trim() : '',
    actionLatitude: value.choice === 'location' ? (value.place?.latitude ?? null) : null,
    actionLongitude: value.choice === 'location' ? (value.place?.longitude ?? null) : null,
    actionPlace: value.choice === 'location' ? (value.place?.locationName ?? null) : null,
  };
}

interface FieldProps {
  value: AdActionValue;
  onChange: (value: AdActionValue) => void;
  /** The ads website: "my" profile. */
  mine: boolean;
  disabled?: boolean;
}

/**
 * Top of the ad form: "When people tap the ad" (nothing / link / directions / a Triolo Partner
 * profile), then the mobile number — required when promoting a profile (it finds the profile),
 * optional otherwise — and, when promoting, which profile.
 */
export function AdActionTop({ value, onChange, mine, disabled }: FieldProps) {
  const set = (changes: Partial<AdActionValue>) => onChange({ ...value, ...changes });
  const kind = PROMOTE_KINDS.find((item) => item.kind === value.promoteKind) ?? PROMOTE_KINDS[0];
  const promote = value.choice === 'promote';

  return (
    <>
      <div className="field">
        <span>When people tap the ad</span>
        <Dropdown
          value={value.choice}
          options={choiceOptions(mine)}
          onChange={(choice) => set({ choice })}
          title="When people tap the ad"
          disabled={disabled}
        />
      </div>

      <label className="field">
        <span>
          {promote
            ? mine
              ? 'Your Triolo Partner mobile number *'
              : 'Triolo Partner mobile number *'
            : mine
              ? 'Mobile number (optional — for Triolo to reach you)'
              : 'Mobile number (optional — on the bill)'}
        </span>
        <input
          value={value.mobile}
          onChange={(e) => set({ mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
          inputMode="numeric"
          maxLength={10}
          disabled={disabled}
          placeholder={promote ? '10-digit Triolo Partner number' : '10-digit mobile number'}
        />
      </label>

      {promote ? (
        <>
          <div className="field">
            <span>Which profile</span>
            <div className="chips">
              {PROMOTE_KINDS.map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  className={`chip${value.promoteKind === item.kind ? ' active' : ''}`}
                  onClick={() => set({ promoteKind: item.kind })}
                  disabled={disabled}
                >
                  <FontAwesomeIcon icon={item.icon} /> {item.label}
                </button>
              ))}
            </div>
          </div>
          <p className="muted" style={{ fontSize: 12, margin: '-4px 0 14px' }}>
            The ad shows this account’s {kind.kind === 'service' ? 'verified worker' : kind.kind === 'business' ? 'verified shop' : 'live job post'}{' '}
            name and gets a <strong>{kind.button}</strong> button that opens it in the app.
          </p>
        </>
      ) : null}
    </>
  );
}

/** The chosen action's own detail: the link, or the place for directions. */
export function AdActionDetails({ value, onChange, disabled }: Omit<FieldProps, 'mine'>) {
  const set = (changes: Partial<AdActionValue>) => onChange({ ...value, ...changes });
  if (value.choice === 'link') {
    return (
      <label className="field">
        <span>Link *</span>
        <input
          value={value.linkUrl}
          onChange={(e) => set({ linkUrl: e.target.value })}
          inputMode="url"
          maxLength={500}
          disabled={disabled}
          placeholder="e.g. sritextiles.com, a WhatsApp or Instagram link"
        />
      </label>
    );
  }
  if (value.choice === 'location') {
    return (
      <PlaceField
        label="Directions to *"
        hint="Tapping the ad opens the maps app with directions here. The ad is shown to people within 5 km of this place (other ads are shown everywhere)."
        value={value.place}
        onChange={(place) => set({ place })}
      />
    );
  }
  return null;
}
