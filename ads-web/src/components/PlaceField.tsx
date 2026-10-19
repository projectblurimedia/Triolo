import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft,
  faCircleCheck,
  faLocationCrosshairs,
  faLocationDot,
  faMapLocationDot,
  faStore,
} from '@fortawesome/free-solid-svg-icons';
import { PlaceValue, placeFromCoords } from '@/utils/place';
import { currentPosition, locationErrorMessage } from '@/utils/geolocation';
import { Overlay, Spinner } from './ui';

// Free OpenStreetMap vector tiles (OpenFreeMap) — the same map the apps use, no API key.
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
// Andhra Pradesh / Telangana, the launch region — only when nothing better is known.
const FALLBACK = { latitude: 16.9, longitude: 80.4, zoom: 6 };

/**
 * Where something is: "Current location" (browser GPS) or "Select on map" — no typed address.
 * Shows the place name once set. Same flow as registration-web's LocationField.
 */
export function PlaceField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: PlaceValue | null;
  onChange: (place: PlaceValue) => void;
}) {
  const [detecting, setDetecting] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const useCurrent = async () => {
    setMessage(null);
    setDetecting(true);
    try {
      const position = await currentPosition();
      onChange(await placeFromCoords(position.coords.latitude, position.coords.longitude));
    } catch (err) {
      setMessage(locationErrorMessage(err));
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="field">
      <span>{label}</span>
      {value ? (
        <div className="place-card">
          <span className="place-card-icon">
            <FontAwesomeIcon icon={faLocationDot} />
          </span>
          <span>
            <span className="place-card-name">{value.locationName}</span>
            <span className="place-card-set">
              <FontAwesomeIcon icon={faCircleCheck} /> Place set
            </span>
          </span>
        </div>
      ) : null}
      <div className="place-buttons">
        <button type="button" className="btn btn-ghost place-primary" onClick={useCurrent} disabled={detecting}>
          {detecting ? <Spinner small /> : <FontAwesomeIcon icon={faLocationCrosshairs} />}
          {detecting ? 'Finding you…' : 'Current location'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setMapOpen(true)} disabled={detecting}>
          <FontAwesomeIcon icon={faMapLocationDot} /> Select on map
        </button>
      </div>
      {hint ? <p className="field-hint">{hint}</p> : null}
      {message ? <p className="field-error">{message}</p> : null}
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

/** Full-screen map with a pin fixed in the middle: drag the map under the pin, then confirm. */
function MapPicker({
  initial,
  onClose,
  onPick,
}: {
  initial: PlaceValue | null;
  onClose: () => void;
  onPick: (place: PlaceValue) => void;
}) {
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
    // MapLibre is large, so it's only downloaded when the map is opened.
    Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')])
      .then(([{ default: maplibregl }]) => {
        if (cancelled || !containerRef.current) return;
        cleanup = startMap(maplibregl);
      })
      .catch(() => !cancelled && setFailed(true));
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      cleanup?.();
      window.removeEventListener('keydown', onKey);
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
    const resizer = new ResizeObserver(() => map.resize());
    resizer.observe(containerRef.current);
    map.on('load', () => {
      map.resize();
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
    if (!initial) {
      currentPosition()
        .then((position) => map.jumpTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 15 }))
        .catch(() => undefined);
    }
    return () => {
      clearTimeout(timer);
      resizer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  };

  const goToMe = async () => {
    setLocating(true);
    try {
      const position = await currentPosition();
      mapRef.current?.flyTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 16 });
    } catch (err) {
      alert(locationErrorMessage(err));
    } finally {
      setLocating(false);
    }
  };

  return (
    <Overlay>
      <div className="map-picker" role="dialog" aria-modal="true">
        <header className="map-picker-head">
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close map">
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <div>
            <h2>Select the ad's place</h2>
            <p>Move the map so the pin is on the shop</p>
          </div>
        </header>
        <div className="map-picker-map">
          <div ref={containerRef} className="map-picker-canvas" />
          {failed ? (
            <div className="map-picker-overlay">The map couldn't load. Check your internet, or use the current location.</div>
          ) : !ready ? (
            <div className="map-picker-overlay">
              <Spinner /> Loading map…
            </div>
          ) : (
            <>
              <div className={`map-pin${moving ? ' lifted' : ''}`}>
                <span className="map-pin-head">
                  <FontAwesomeIcon icon={faStore} />
                </span>
                <span className="map-pin-stem" />
              </div>
              <button type="button" className="icon-btn map-locate" onClick={goToMe} disabled={locating} aria-label="My location">
                {locating ? <Spinner small /> : <FontAwesomeIcon icon={faLocationCrosshairs} />}
              </button>
            </>
          )}
        </div>
        <div className="map-picker-sheet glass">
          <div className="place-card">
            <span className="place-card-icon">
              <FontAwesomeIcon icon={faLocationDot} />
            </span>
            <span>
              <span className="place-card-caption">Pin location</span>
              <span className="place-card-name">
                {preview && !moving ? preview.locationName : ready ? 'Finding place name…' : '…'}
              </span>
            </span>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!preview || moving}
            onClick={() => preview && onPick(preview)}
          >
            Confirm Place
          </button>
        </div>
      </div>
    </Overlay>
  );
}
