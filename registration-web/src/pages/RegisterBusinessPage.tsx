import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { InfoTips } from '@/components/InfoTips';
import { PhoneVerification } from '@/components/PhoneVerification';
import { CategoryChips } from '@/components/CategoryChips';
import { LocationField } from '@/components/LocationField';
import { ProfilePhotoField } from '@/components/ProfilePhotoField';
import { PlaceValue } from '@/utils/place';
import { PhotoUpload } from '@/components/PhotoUpload';
import { VerificationBadge } from '@/components/VerificationBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { businessesService, BusinessProfile } from '@/services/businessesService';
import { getErrorMessage } from '@/services/errorMessages';
import { useAuthStore } from '@/state/authStore';
import { formatAddress } from '@/utils/formatAddress';

const CATEGORY_LABELS: Record<string, string> = {
  grocery: "Grocery",
  restaurant: "Restaurant",
  pharmacy: "Pharmacy",
  electronics: "Electronics",
  clothing: "Clothing",
  hardware: "Hardware",
  salon: "Salon",
  supermarket: "Supermarket",
  vegetables_fruits: "Vegetables & Fruits",
  dairy: "Milk & Dairy",
  bakery: "Bakery",
  sweets: "Sweets & Snacks",
  meat_chicken: "Meat & Chicken",
  fish: "Fish",
  tea_coffee: "Tea & Coffee",
  tiffin_center: "Tiffin Centre",
  juice_icecream: "Juice & Ice Cream",
  water_cans: "Water Cans",
  mobile_shop: "Mobiles & Accessories",
  computer_shop: "Computers",
  home_appliances: "Home Appliances",
  furniture: "Furniture",
  footwear: "Footwear",
  jewellery: "Jewellery",
  cosmetics: "Cosmetics & Beauty",
  gifts_toys: "Gifts & Toys",
  stationery_books: "Stationery & Books",
  printing_xerox: "Printing & Xerox",
  photo_studio: "Photo Studio",
  optical: "Optical",
  clinic_lab: "Clinic & Lab",
  beauty_parlour: "Beauty Parlour",
  gym: "Gym",
  tailoring: "Tailoring",
  laundry: "Laundry & Dry Clean",
  paints: "Paints",
  electricals: "Electricals",
  sanitary: "Sanitary & Plumbing",
  building_materials: "Building Materials",
  auto_parts: "Auto Parts & Tyres",
  seeds_fertilizers: "Seeds & Fertilizers",
  pet_shop: "Pet Shop",
  flowers: "Flowers & Pooja Items",
  gas_agency: "Gas Agency",
  hotel_lodge: "Hotel & Lodge",
  other: 'Other',
};

const CATEGORIES = [
  { key: 'grocery', label: "Grocery" },
  { key: 'restaurant', label: "Restaurant" },
  { key: 'pharmacy', label: "Pharmacy" },
  { key: 'electronics', label: "Electronics" },
  { key: 'clothing', label: "Clothing" },
  { key: 'hardware', label: "Hardware" },
  { key: 'salon', label: "Salon" },
  { key: 'supermarket', label: "Supermarket" },
  { key: 'vegetables_fruits', label: "Vegetables & Fruits" },
  { key: 'dairy', label: "Milk & Dairy" },
  { key: 'bakery', label: "Bakery" },
  { key: 'sweets', label: "Sweets & Snacks" },
  { key: 'meat_chicken', label: "Meat & Chicken" },
  { key: 'fish', label: "Fish" },
  { key: 'tea_coffee', label: "Tea & Coffee" },
  { key: 'tiffin_center', label: "Tiffin Centre" },
  { key: 'juice_icecream', label: "Juice & Ice Cream" },
  { key: 'water_cans', label: "Water Cans" },
  { key: 'mobile_shop', label: "Mobiles & Accessories" },
  { key: 'computer_shop', label: "Computers" },
  { key: 'home_appliances', label: "Home Appliances" },
  { key: 'furniture', label: "Furniture" },
  { key: 'footwear', label: "Footwear" },
  { key: 'jewellery', label: "Jewellery" },
  { key: 'cosmetics', label: "Cosmetics & Beauty" },
  { key: 'gifts_toys', label: "Gifts & Toys" },
  { key: 'stationery_books', label: "Stationery & Books" },
  { key: 'printing_xerox', label: "Printing & Xerox" },
  { key: 'photo_studio', label: "Photo Studio" },
  { key: 'optical', label: "Optical" },
  { key: 'clinic_lab', label: "Clinic & Lab" },
  { key: 'beauty_parlour', label: "Beauty Parlour" },
  { key: 'gym', label: "Gym" },
  { key: 'tailoring', label: "Tailoring" },
  { key: 'laundry', label: "Laundry & Dry Clean" },
  { key: 'paints', label: "Paints" },
  { key: 'electricals', label: "Electricals" },
  { key: 'sanitary', label: "Sanitary & Plumbing" },
  { key: 'building_materials', label: "Building Materials" },
  { key: 'auto_parts', label: "Auto Parts & Tyres" },
  { key: 'seeds_fertilizers', label: "Seeds & Fertilizers" },
  { key: 'pet_shop', label: "Pet Shop" },
  { key: 'flowers', label: "Flowers & Pooja Items" },
  { key: 'gas_agency', label: "Gas Agency" },
  { key: 'hotel_lodge', label: "Hotel & Lodge" },
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
  const [photoFailed, setPhotoFailed] = useState(false);

  const [shopName, setShopName] = useState('');
  const [shopCategories, setShopCategories] = useState<string[]>([]);
  const [otherEntries, setOtherEntries] = useState<string[]>([]);
  const [place, setPlace] = useState<PlaceValue | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
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
    const problem = !shopName.trim()
      ? "Enter your shop's name."
      : shopCategories.length === 0 && !includesOther
        ? 'Choose at least one shop category.'
        : !place
          ? 'Set your location — use your current location or select it on the map.'
          : deliveryAvailable === null
            ? 'Tell us whether you offer delivery.'
            : deliveryAvailable && !(Number(deliveryPricePerKm) > 0)
              ? 'Enter your delivery price per km.'
              : null;
    if (problem || !place || deliveryAvailable === null) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    try {
      await businessesService.createProfile({
        shopName,
        shopCategories: includesOther ? [...shopCategories, 'other'] : shopCategories,
        otherCategoryDescription: includesOther ? otherEntries.join(', ') : undefined,
        place,
        deliveryAvailable,
        deliveryPricePerKm: deliveryAvailable ? Number(deliveryPricePerKm) : undefined,
        shopPhotos: photos,
      });
      if (profilePhoto) {
        try {
          await businessesService.uploadProfilePhoto(profilePhoto);
        } catch {
          // The profile is saved; the photo can be added again from the Partner app.
          setPhotoFailed(true);
        }
      }
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
        <PageHeader title="Business Registration" subtitle="Get orders from customers near you" backTo="/" />
        <div className="body">
          <p>✅ Your shop details are submitted for verification.</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>We'll notify you once approved.</p>
          {photoFailed ? (
            <p style={{ fontSize: 13, color: 'var(--color-error)' }}>
              Your photo didn't upload. You can add it later from the Triolo Partner app.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title="Business Registration" subtitle="Get orders from customers near you" backTo="/" />
      <div className="body">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (verified && !existingProfile) handleSubmit();
          }}
        >
          {!existingProfile ? (
            <InfoTips
              title="About shop registration"
              tips={[
                'Register your shop to get discovered by customers nearby.',
                'A clear profile photo helps customers trust you.',
                'Your location is picked with GPS or on the map. Only your village or town name is shown to others.',
                'Verify your mobile number to enable Register.',
                'Our team checks new profiles. Once approved, customers near you can find you.',
                'Delivery is charged per km. Anything under 1 km is charged as 1 km.',
              ]}
            />
          ) : null}
          {!existingProfile ? (
            <ProfilePhotoField
              file={profilePhoto}
              name={fullName}
              title="Your photo (shopkeeper)"
              hint="A clear photo of you, the shop owner. Add pictures of the shop below."
              onChange={setProfilePhoto}
            />
          ) : null}

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
                  {existingProfile.deliveryAvailable ? `Yes — ₹${existingProfile.deliveryPricePerKm ?? 0}/km` : 'No'}
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
              <LocationField label="Shop location" value={place} onChange={setPlace} />
              <PhotoUpload label="Shop Photos (optional)" files={photos} onChange={setPhotos} />

              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                Do you offer delivery?
              </label>
              <div className="delivery-row">
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
                  <input
                    value={deliveryPricePerKm}
                    onChange={(e) => setDeliveryPricePerKm(e.target.value.replace(/[^0-9.]/g, ''))}
                    inputMode="decimal"
                    placeholder="₹ per km"
                    aria-label="Price per km (₹)"
                  />
                ) : null}
              </div>

              {error ? <p className="error-text">{error}</p> : null}
              <button type="submit" className="button" disabled={!verified || submitting}>
                {submitting ? <LoadingSpinner /> : 'Register'}
              </button>
            </>
          ) : null}
        </form>
      </div>
    </div>
  );
}
