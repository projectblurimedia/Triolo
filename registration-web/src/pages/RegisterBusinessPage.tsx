import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PhoneAuthFlow } from '@/components/PhoneAuthFlow';
import { CategoryChips } from '@/components/CategoryChips';
import { LocationField, LocationValue } from '@/components/LocationField';
import { PhotoUpload } from '@/components/PhotoUpload';
import { VerificationBadge } from '@/components/VerificationBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { businessesService, BusinessProfile } from '@/services/businessesService';
import { getErrorMessage } from '@/services/errorMessages';

const CATEGORIES = [
  { key: 'grocery', label: 'Grocery' },
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'pharmacy', label: 'Pharmacy' },
  { key: 'electronics', label: 'Electronics' },
  { key: 'clothing', label: 'Clothing' },
  { key: 'hardware', label: 'Hardware' },
  { key: 'salon', label: 'Salon' },
];

type Stage = 'auth' | 'checking' | 'form' | 'existing' | 'success';

export function RegisterBusinessPage() {
  const [stage, setStage] = useState<Stage>('auth');
  const [existingProfile, setExistingProfile] = useState<BusinessProfile | null>(null);

  const [shopName, setShopName] = useState('');
  const [shopCategories, setShopCategories] = useState<string[]>([]);
  const [otherEntries, setOtherEntries] = useState<string[]>([]);
  const [location, setLocation] = useState<LocationValue>({ latitude: null, longitude: null, address: '' });
  const [photos, setPhotos] = useState<File[]>([]);
  const [deliveryAvailable, setDeliveryAvailable] = useState<boolean | null>(null);
  const [deliveryPricePerKm, setDeliveryPricePerKm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAuthenticated = async () => {
    setStage('checking');
    try {
      const profile = await businessesService.getMyProfile();
      if (profile) {
        setExistingProfile(profile);
        setStage('existing');
      } else {
        setStage('form');
      }
    } catch {
      setStage('form');
    }
  };

  const handleSubmit = async () => {
    setError(null);
    const includesOther = otherEntries.length > 0;
    if (
      !shopName.trim() ||
      (shopCategories.length === 0 && !includesOther) ||
      !location.address.trim() ||
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
        latitude: location.latitude,
        longitude: location.longitude,
        locationAddress: location.address,
        deliveryAvailable,
        deliveryPricePerKm: deliveryAvailable ? Number(deliveryPricePerKm) : undefined,
        shopPhotos: photos,
      });
      setStage('success');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <PageHeader title="Business Registration" backTo="/" shop />
      <div className="body">
        {stage === 'auth' ? <PhoneAuthFlow onAuthenticated={handleAuthenticated} shop /> : null}

        {stage === 'checking' ? (
          <div className="loading-wrap">
            <LoadingSpinner dark />
          </div>
        ) : null}

        {stage === 'existing' && existingProfile ? (
          <div>
            <p>You already have a business profile ({existingProfile.shopName}):</p>
            <VerificationBadge status={existingProfile.verificationStatus} />
            <p style={{ marginTop: 16, fontSize: 13, color: 'var(--color-text-muted)' }}>
              We'll notify the account on file once it's reviewed.
            </p>
          </div>
        ) : null}

        {stage === 'form' ? (
          <div>
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
              shop
            />
            <LocationField value={location} onChange={setLocation} />
            <PhotoUpload label="Shop Photos (optional)" files={photos} onChange={setPhotos} />

            <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
              Do you offer delivery?
            </label>
            <div className="chip-row">
              <button
                type="button"
                className={`chip ${deliveryAvailable === true ? 'chip--active chip--shop' : ''}`}
                onClick={() => setDeliveryAvailable(true)}
              >
                Yes
              </button>
              <button
                type="button"
                className={`chip ${deliveryAvailable === false ? 'chip--active chip--shop' : ''}`}
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
            <button className="button button--shop" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <LoadingSpinner /> : 'Submit'}
            </button>
          </div>
        ) : null}

        {stage === 'success' ? (
          <div>
            <p>✅ Your shop details are submitted for verification.</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>We'll notify you once approved.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
