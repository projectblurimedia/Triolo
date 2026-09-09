import { useState } from 'react';
import { INDIA_DISTRICTS_BY_STATE, INDIA_STATES } from '@/constants/indiaLocations';

export interface AddressValue {
  latitude: number | null;
  longitude: number | null;
  area: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

export const EMPTY_ADDRESS: AddressValue = {
  latitude: null,
  longitude: null,
  area: '',
  city: '',
  district: '',
  state: '',
  pincode: '',
};

interface AddressFieldProps {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
}

/**
 * Structured address entry — State/District as `<select>` dropdowns constrained to India's
 * actual states and districts (`constants/indiaLocations.ts`, same list the mobile apps'
 * `AddressPicker` uses), plus City/Area as free text and Pincode as a 6-digit field.
 * Replaces the earlier single free-text `LocationField`, which wasn't precise enough for
 * real address data, and a first pass of this component that left State/District as free
 * text too (a typo'd or inconsistently-cased name would be useless for any future
 * area-based filtering). No reverse-geocoding here — same limitation `LocationField`
 * already had (no browser-native geocoder, and a paid API wasn't worth it for this) — so
 * "capture my location" only grabs `latitude`/`longitude` in the background; City/Area/
 * Pincode stay manual either way.
 */
export function AddressField({ value, onChange }: AddressFieldProps) {
  const [detecting, setDetecting] = useState(false);
  const districtOptions = value.state ? INDIA_DISTRICTS_BY_STATE[value.state] ?? [] : [];

  const set = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch });

  const handleStateChange = (state: string) => {
    const districts = INDIA_DISTRICTS_BY_STATE[state] ?? [];
    set({ state, district: districts.includes(value.district) ? value.district : '' });
  };

  const handleDetect = () => {
    if (!navigator.geolocation) {
      alert("Your browser doesn't support location detection. Please enter your address manually.");
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        set({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setDetecting(false);
      },
      () => {
        alert("Couldn't detect your location. Please enter your address manually.");
        setDetecting(false);
      },
    );
  };

  return (
    <div>
      <button
        type="button"
        className="button button--secondary"
        style={{ marginBottom: 14 }}
        onClick={handleDetect}
        disabled={detecting}
      >
        {detecting ? 'Detecting…' : '📍 Capture My GPS Location'}
      </button>

      <div className="field">
        <label>Area / Landmark (optional)</label>
        <input value={value.area} onChange={(e) => set({ area: e.target.value })} placeholder="Street, locality or nearby landmark" />
      </div>
      <div className="field">
        <label>State</label>
        <select value={value.state} onChange={(e) => handleStateChange(e.target.value)}>
          <option value="">Select State</option>
          {INDIA_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>District</label>
        <select
          value={value.district}
          onChange={(e) => set({ district: e.target.value })}
          disabled={!value.state}
        >
          <option value="">{value.state ? 'Select District' : 'Select a State first'}</option>
          {districtOptions.map((district) => (
            <option key={district} value={district}>
              {district}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>City</label>
        <input value={value.city} onChange={(e) => set({ city: e.target.value })} />
      </div>
      <div className="field">
        <label>Pincode</label>
        <input
          value={value.pincode}
          onChange={(e) => set({ pincode: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })}
          inputMode="numeric"
          maxLength={6}
        />
      </div>

      {value.latitude != null ? (
        <p style={{ marginTop: -10, fontSize: 12, color: 'var(--color-success)' }}>GPS location captured</p>
      ) : null}
    </div>
  );
}
