import { useState } from 'react';

export interface LocationValue {
  latitude: number | null;
  longitude: number | null;
  address: string;
}

interface LocationFieldProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
}

/** Browser Geolocation API instead of expo-location — same "detect or type manually" pattern as the mobile apps' LocationPicker. No reverse-geocoding service wired up here (the mobile apps use expo-location's device-native one, which has no direct browser equivalent without a paid API) — a GPS-detected location shows its coordinates, with the same manual-address fallback either way. */
export function LocationField({ value, onChange }: LocationFieldProps) {
  const [detecting, setDetecting] = useState(false);

  const handleDetect = () => {
    if (!navigator.geolocation) {
      alert("Your browser doesn't support location detection. Please enter your address manually.");
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onChange({ latitude, longitude, address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` });
        setDetecting(false);
      },
      () => {
        alert("Couldn't detect your location. Please enter it manually.");
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
        {detecting ? 'Detecting…' : '📍 Use My Current Location'}
      </button>
      <div className="field">
        <label>Location</label>
        <input
          value={value.address}
          onChange={(e) => onChange({ latitude: null, longitude: null, address: e.target.value })}
          placeholder="Village/town, district"
        />
      </div>
      {value.latitude != null ? <p style={{ marginTop: -10, fontSize: 12, color: 'var(--color-success)' }}>Detected via GPS</p> : null}
    </div>
  );
}
