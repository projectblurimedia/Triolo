import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft,
  faCircleCheck,
  faHouse,
  faLocationCrosshairs,
  faLocationDot,
  faMapLocationDot,
} from '@fortawesome/free-solid-svg-icons';
import { LoadingSpinner } from './LoadingSpinner';
import { PlaceValue, placeFromCoords } from '@/utils/place';

interface LocationFieldProps {
  label: string;
  value: PlaceValue | null;
  onChange: (place: PlaceValue) => void;
}

// Free OpenStreetMap vector tiles (OpenFreeMap) — the same map the mobile apps use, no API key.
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
// Andhra Pradesh / Telangana, the launch region — only when nothing better is known.
const FALLBACK = { latitude: 16.9, longitude: 80.4, zoom: 6 };

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 });
  });
}

/**
 * Where you are: "Use my current location" (browser GPS) or "Select on map" — no typed address.
 * Once set it shows only the place name; the full address found for that point is kept in the
 * value and sent with the profile, never shown.
 */
export function LocationField({ label, value, onChange }: LocationFieldProps) {
  const [detecting, setDetecting] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const useCurrent = async () => {
    setMessage(null);
    setDetecting(true);
    try {
      const position = await currentPosition();
      onChange(await placeFromCoords(position.coords.latitude, position.coords.longitude));
    } catch {
      setMessage("Couldn't get your location. Allow location access and try again, or select it on the map.");
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="field">
      <label>{label}</label>
      {value ? (
        <div className="place-card">
          <span className="place-card__icon">
            <FontAwesomeIcon icon={faLocationDot} />
          </span>
          <span>
            <span className="place-card__name">{value.locationName}</span>
            <span className="place-card__set">
              <FontAwesomeIcon icon={faCircleCheck} /> Location set
            </span>
          </span>
        </div>
      ) : null}
      <div className="place-buttons">
        <button type="button" className="place-button place-button--primary" onClick={useCurrent} disabled={detecting}>
          {detecting ? <LoadingSpinner dark /> : <FontAwesomeIcon icon={faLocationCrosshairs} />}
          {detecting ? 'Finding you…' : 'Current location'}
        </button>
        <button type="button" className="place-button" onClick={() => setMapOpen(true)} disabled={detecting}>
          <FontAwesomeIcon icon={faMapLocationDot} />
          Select on map
        </button>
      </div>
      {message ? <p className="error-text">{message}</p> : null}
      {mapOpen ? (
        <MapPicker
          initial={value}
          onClose={() => setMapOpen(false)}
          onPick={(place) => {
            setMapOpen(false);
            onChange(place);
          }}
        />
      ) : null}
    </div>
  );
}

interface MapPickerProps {
  initial: PlaceValue | null;
  onClose: () => void;
  onPick: (place: PlaceValue) => void;
}

/** Full-screen map with a pin fixed in the middle: drag the map under the pin, then confirm. */
function MapPicker({ initial, onClose, onPick }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const lookupId = useRef(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [moving, setMoving] = useState(false);
  const [preview, setPreview] = useState<PlaceValue | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    // MapLibre is large, so it's only downloaded when someone opens the map.
    Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')])
      .then(([{ default: maplibregl }]) => {
        if (cancelled || !containerRef.current) return;
        cleanup = startMap(maplibregl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startMap = (maplibregl: typeof import('maplibre-gl')): (() => void) | undefined => {
    if (!containerRef.current) return undefined;
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: initial ? [initial.longitude, initial.latitude] : [FALLBACK.longitude, FALLBACK.latitude],
        zoom: initial ? 16 : FALLBACK.zoom,
        attributionControl: { compact: true },
      });
    } catch {
      setFailed(true);
      return undefined;
    }
    mapRef.current = map;
    const nameCenter = () => {
      const center = map.getCenter();
      const id = ++lookupId.current;
      setMoving(false);
      placeFromCoords(center.lat, center.lng).then((place) => {
        if (id === lookupId.current) setPreview(place);
      });
    };
    map.on('load', () => {
      setReady(true);
      nameCenter();
    });
    map.on('movestart', () => {
      setMoving(true);
      setPreview(null);
    });
    // Nominatim asks for at most about one lookup a second — only look up once the map settles.
    let timer: ReturnType<typeof setTimeout> | undefined;
    map.on('moveend', () => {
      clearTimeout(timer);
      timer = setTimeout(nameCenter, 700);
    });
    map.on('error', () => {
      if (!map.loaded()) setFailed(true);
    });
    // With no saved place, start where the visitor is (if the browser lets us).
    if (!initial) {
      currentPosition()
        .then((position) => map.jumpTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 15 }))
        .catch(() => undefined);
    }
    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  };

  const goToMe = async () => {
    setLocating(true);
    try {
      const position = await currentPosition();
      mapRef.current?.flyTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 16 });
    } catch {
      alert("Couldn't get your location. Allow location access in your browser and try again.");
    } finally {
      setLocating(false);
    }
  };

  return createPortal(
    <div className="map-picker">
      <div className="header">
        <div className="header__row">
          <button type="button" className="header__iconButton" onClick={onClose} aria-label="Close">
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <div>
            <h1 className="header__title">Select Location</h1>
            <div className="map-picker__subtitle">Move the map so the pin is on your place</div>
          </div>
        </div>
      </div>
      <div className="map-picker__map">
        <div ref={containerRef} className="map-picker__canvas" />
        {failed ? (
          <div className="map-picker__overlay">
            The map couldn't load. Check your internet, or use your current location instead.
          </div>
        ) : !ready ? (
          <div className="map-picker__overlay">
            <LoadingSpinner dark /> Loading map…
          </div>
        ) : (
          <>
            <div className={`map-picker__pin${moving ? ' map-picker__pin--lifted' : ''}`}>
              <span className="map-picker__pin-head">
                <FontAwesomeIcon icon={faHouse} />
              </span>
              <span className="map-picker__pin-stem" />
            </div>
            <button type="button" className="map-picker__locate" onClick={goToMe} disabled={locating} aria-label="My location">
              {locating ? <LoadingSpinner dark /> : <FontAwesomeIcon icon={faLocationCrosshairs} />}
            </button>
          </>
        )}
      </div>
      <div className="map-picker__sheet">
        <div className="map-picker__place">
          <span className="place-card__icon">
            <FontAwesomeIcon icon={faLocationDot} />
          </span>
          <span>
            <span className="map-picker__caption">Pin location</span>
            <span className="place-card__name">
              {preview && !moving ? preview.locationName : ready ? 'Finding place name…' : '…'}
            </span>
          </span>
        </div>
        <button type="button" className="button" disabled={!preview || moving} onClick={() => preview && onPick(preview)}>
          Confirm Location
        </button>
      </div>
    </div>,
    document.body,
  );
}
