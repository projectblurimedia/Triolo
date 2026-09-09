import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PhoneVerification } from '@/components/PhoneVerification';
import { CategoryChips } from '@/components/CategoryChips';
import { AddressField, AddressValue, EMPTY_ADDRESS } from '@/components/AddressField';
import { PhotoUpload } from '@/components/PhotoUpload';
import { VerificationBadge } from '@/components/VerificationBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { businessesService, BusinessProfile } from '@/services/businessesService';
import { getErrorMessage } from '@/services/errorMessages';
import { useAuthStore } from '@/state/authStore';
import { formatAddress } from '@/utils/formatAddress';

const CATEGORY_LABELS: Record<string, string> = {
  grocery: 'Grocery',
  restaurant: 'Restaurant',
  pharmacy: 'Pharmacy',
  electronics: 'Electronics',
  clothing: 'Clothing',
  hardware: 'Hardware',
  salon: 'Salon',
  other: 'Other',
};

const CATEGORIES = [
  { key: 'grocery', label: 'Grocery' },
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'pharmacy', label: 'Pharmacy' },
  { key: 'electronics', label: 'Electronics' },
  { key: 'clothing', label: 'Clothing' },
  { key: 'hardware', label: 'Hardware' },
  { key: 'salon', label: 'Salon' },
];

/**
 * One page, one form — mirrors `RegisterWorkerPage`'s own restructuring (see its doc
 * comment for the full rationale): Full Name/Mobile (via `PhoneVerification`) sit alongside
 * the actual Business fields instead of gating them behind a separate auth screen. Every
 * field is fillable from the start; only the Submit button is gated on `verified`. A
 * returning visitor whose session already persisted from a prior visit skips straight to the
 * "already have a profile" status view on mount — see `RegisterWorkerPage`'s equivalent
 * `useEffect` for the full rationale.
 */
export function RegisterBusinessPage() {
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [verified, setVerified] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [existingProfile, setExistingProfile] = useState<BusinessProfile | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [shopName, setShopName] = useState('');
  const [shopCategories, setShopCategories] = useState<string[]>([]);
  const [otherEntries, setOtherEntries] = useState<string[]>([]);
  const [address, setAddress] = useState<AddressValue>(EMPTY_ADDRESS);
  const [photos, setPhotos] = useState<File[]>([]);
  const [deliveryAvailable, setDeliveryAvailable] = useState<boolean | null>(null);
  const [deliveryPricePerKm, setDeliveryPricePerKm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleVerified = async () => {
    setVerified(true);
    setCheckingProfile(true);
    try {
      const profile = await businessesService.getMyProfile();
      setExistingProfile(profile);
    } catch {
      setExistingProfile(null);
      // apiClient clears the session on an unrecoverable 401 (an expired/invalid access
      // token whose refresh also failed) — if that just happened, there's no real session
      // to show as "verified" after all. Reset back to the ordinary OTP flow instead of
      // leaving the form permanently stuck on blank, disabled fields.
      if (!useAuthStore.getState().accessToken) {
        setVerified(false);
        setFullName('');
        setMobileNumber('');
      }
    } finally {
      setCheckingProfile(false);
    }
  };

  // A returning visitor with a session already persisted from a prior visit (e.g. arriving
  // here via LandingPage's own "Your Business Profile" status card) shouldn't have to
  // re-enter an OTP just to see their status — check immediately instead of waiting for
  // PhoneVerification's own onVerified callback, which only fires after a fresh OTP flow.
  // Seeding fullName/mobileNumber from the persisted account is what actually matters here:
  // marking `verified` true without them left PhoneVerification's Full Name/Mobile Number
  // fields rendering disabled *and blank* — reported as "fields not able to select or focus
  // at all," since a disabled, empty field looks and behaves exactly like a broken one.
  useEffect(() => {
    const { accessToken, account } = useAuthStore.getState();
    if (accessToken && account) {
      setFullName(account.fullName);
      setMobileNumber(account.mobileNumber);
      handleVerified();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    setError(null);
    const includesOther = otherEntries.length > 0;
    if (
      !shopName.trim() ||
      (shopCategories.length === 0 && !includesOther) ||
      !address.city.trim() ||
      !address.district.trim() ||
      !address.state.trim() ||
      !/^[0-9]{6}$/.test(address.pincode) ||
      deliveryAvailable === null ||
      (deliveryAvailable && !deliveryPricePerKm.trim())
    ) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    try {
      await businessesService.createProfile({
        shopName,
        shopCategories: includesOther ? [...shopCategories, 'other'] : shopCategories,
        otherCategoryDescription: includesOther ? otherEntries.join(', ') : undefined,
        latitude: address.latitude,
        longitude: address.longitude,
        area: address.area.trim() || undefined,
        city: address.city.trim(),
        district: address.district.trim(),
        state: address.state.trim(),
        pincode: address.pincode,
        deliveryAvailable,
        deliveryPricePerKm: deliveryAvailable ? Number(deliveryPricePerKm) : undefined,
        shopPhotos: photos,
      });
      setSubmitted(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="page">
        <PageHeader title="Business Registration" backTo="/" />
        <div className="body">
          <p>✅ Your shop details are submitted for verification.</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>We'll notify you once approved.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title="Business Registration" backTo="/" />
      <div className="body">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (verified && !existingProfile) handleSubmit();
          }}
        >
          <PhoneVerification
            fullName={fullName}
            onFullNameChange={setFullName}
            mobileNumber={mobileNumber}
            onMobileNumberChange={setMobileNumber}
            verified={verified}
            onVerified={handleVerified}
          />

          {checkingProfile ? (
            <div className="loading-wrap">
              <LoadingSpinner dark />
            </div>
          ) : null}

          {!checkingProfile && existingProfile ? (
            <div className="card">
              <p style={{ marginTop: 0 }}>You already have a business profile ({existingProfile.shopName}):</p>
              <VerificationBadge status={existingProfile.verificationStatus} />
              <dl style={{ marginTop: 16, fontSize: 13 }}>
                <dt style={{ color: 'var(--color-text-muted)' }}>Categories</dt>
                <dd style={{ margin: '2px 0 12px' }}>
                  {existingProfile.shopCategories.map((key) => CATEGORY_LABELS[key] ?? key).join(', ')}
                  {existingProfile.otherCategoryDescription ? ` (${existingProfile.otherCategoryDescription})` : ''}
                </dd>
                <dt style={{ color: 'var(--color-text-muted)' }}>Delivery</dt>
                <dd style={{ margin: '2px 0 12px' }}>
                  {existingProfile.deliveryAvailable ? `Yes — ₹${existingProfile.deliveryPricePerKm}/km` : 'No'}
                </dd>
                <dt style={{ color: 'var(--color-text-muted)' }}>Location</dt>
                <dd style={{ margin: '2px 0 0' }}>{formatAddress(existingProfile)}</dd>
              </dl>
              <p style={{ marginTop: 16, marginBottom: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
                We'll notify the account on file once it's reviewed.
              </p>
            </div>
          ) : null}

          {!checkingProfile && !existingProfile ? (
            <>
              <div className="field">
                <label>Shop Name</label>
                <input value={shopName} onChange={(e) => setShopName(e.target.value)} />
              </div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                Shop Categories (select all that apply)
              </label>
              <CategoryChips
                options={CATEGORIES}
                selected={shopCategories}
                onChange={setShopCategories}
                otherEntries={otherEntries}
                onOtherEntriesChange={setOtherEntries}
              />
              <AddressField value={address} onChange={setAddress} />
              <PhotoUpload label="Shop Photos (optional)" files={photos} onChange={setPhotos} />

              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                Do you offer delivery?
              </label>
              <div className="chip-row">
                <button
                  type="button"
                  className={`chip ${deliveryAvailable === true ? 'chip--active' : ''}`}
                  onClick={() => setDeliveryAvailable(true)}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={`chip ${deliveryAvailable === false ? 'chip--active' : ''}`}
                  onClick={() => setDeliveryAvailable(false)}
                >
                  No
                </button>
              </div>
              {deliveryAvailable ? (
                <div className="field">
                  <label>Delivery Price per KM (₹)</label>
                  <input value={deliveryPricePerKm} onChange={(e) => setDeliveryPricePerKm(e.target.value)} inputMode="decimal" />
                </div>
              ) : null}

              {error ? <p className="error-text">{error}</p> : null}
              <button type="submit" className="button" disabled={!verified || submitting}>
                {submitting ? <LoadingSpinner /> : 'Submit'}
              </button>
              {!verified ? (
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>
                  Verify your mobile number above to enable Submit.
                </p>
              ) : null}
            </>
          ) : null}
        </form>
      </div>
    </div>
  );
}
