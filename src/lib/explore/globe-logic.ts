/** Shared, platform-independent globe logic (used by the web globe and the phone WebView globe). */

export interface GlobeMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  /** 'trip' = one of the user's own trips; 'search' = a place the user searched; 'city' / 'town' = featured destinations. */
  kind: 'trip' | 'search' | 'city' | 'town';
  tier: 1 | 2 | 3;
}

export interface GlobeFocus {
  lat: number;
  lng: number;
  altitude: number;
  /** Change to re-trigger the same focus. */
  nonce: number;
}

export interface GlobeProps {
  markers: GlobeMarker[];
  selectedId?: string;
  focus?: GlobeFocus;
  onMarkerPress: (id: string) => void;
  /** A real click/tap on the globe surface (drags are ignored). */
  onGlobePress: (lat: number, lng: number, altitude: number) => void;
  /** First time the user drags, zooms or taps: stop the intro auto-rotation. */
  onInteract?: () => void;
  onAltitudeChange?: (altitude: number) => void;
}

/**
 * The globe's 3D label font only covers basic Latin, so fold accents for labels
 * ("Český Krumlov" → "Cesky Krumlov"). The full name is still shown everywhere else.
 */
export const globeLabel = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '');

export const START_ALTITUDE = 2.4;
export const FOCUS_ALTITUDE = 0.9;

/** Zoom level (globe radii above the surface) at which each tier starts to appear. */
const TIER_MAX_ALT = { 1: Infinity, 2: 1.7, 3: 1.0 } as const;
const LABEL_MAX_ALT = 1.35;

/** Fewer markers when zoomed out, more as you zoom in. Trips and the selection are always shown. */
export function visibleMarkers(markers: GlobeMarker[], altitude: number, selectedId?: string) {
  return markers.filter((m) => m.kind === 'trip' || m.kind === 'search' || m.id === selectedId || altitude <= TIER_MAX_ALT[m.tier]);
}

/** Labels only once zoomed in far enough to read them without clutter. */
export function visibleLabels(markers: GlobeMarker[], altitude: number, selectedId?: string) {
  if (altitude > LABEL_MAX_ALT) return markers.filter((m) => m.id === selectedId || m.kind === 'trip' || m.kind === 'search');
  return markers;
}

/** Bucket altitude so React only re-renders the globe data when the visible set can change. */
export function altitudeBucket(altitude: number) {
  if (altitude > TIER_MAX_ALT[2]) return 3;
  if (altitude > LABEL_MAX_ALT) return 2;
  if (altitude > TIER_MAX_ALT[3]) return 1;
  return 0;
}

export const MARKER_STYLE = {
  trip: { color: '#818CF8', radius: 0.55, label: '#C7D2FE' },
  search: { color: '#F43F5E', radius: 0.5, label: '#FDA4AF' },
  city: { color: '#FFFFFF', radius: 0.32, label: '#FFFFFF' },
  town: { color: '#5EEAD4', radius: 0.3, label: '#99F6E4' },
  selected: { color: '#F97316', radius: 0.6, label: '#FDBA74' },
} as const;

export function markerStyle(m: GlobeMarker, selectedId?: string) {
  return m.id === selectedId ? MARKER_STYLE.selected : MARKER_STYLE[m.kind];
}
