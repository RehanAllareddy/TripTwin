/**
 * Google ratings for place cards, rendered with Google's Places UI Kit.
 *
 * Why UI Kit and not a custom Places API call: Google Maps Platform Service Specific Terms
 * §14.2 forbid using Places API content "in conjunction with a non-Google map" (our globe),
 * while §15.1 allows Places UI Kit "with or without any map, including a non-Google Map".
 *
 * Google renders the rating, review count and attribution itself. TripTwin never reads,
 * stores, caches or computes ratings. This module only builds the element markup and
 * tracks loading / missing-rating / error states.
 */

export const MSG = {
  noRating: "Google rating isn't available for this destination",
  unavailable: 'Ratings are unavailable right now',
  noAttractions: 'No rated attractions found here on Google Maps.',
  notConfigured: "Google ratings aren't set up yet.",
} as const;

const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;
export const isValidPlaceId = (id: string | undefined): id is string => !!id && PLACE_ID.test(id);

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface RatingsTarget {
  /** Verified Google Place ID for the destination, if we have one. */
  placeId?: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
}

/**
 * Destination block: rating + review count + Google Maps attribution, all drawn by Google.
 * Only the content elements listed are shown (no photos, reviews or other fields).
 */
export function destinationMarkup(placeId: string) {
  if (!isValidPlaceId(placeId)) throw new Error('Invalid place ID');
  return [
    '<gmp-place-details-compact orientation="vertical" truncation-preferred style="width:100%;padding:0;margin:0;border:none;background-color:transparent;color-scheme:light">',
    `<gmp-place-details-place-request place="${esc(placeId)}"></gmp-place-details-place-request>`,
    '<gmp-place-rating></gmp-place-rating>',
    '<gmp-place-attribution light-scheme-color="gray"></gmp-place-attribution>',
    '</gmp-place-details-compact>',
  ].join('');
}

/**
 * Card for any place the user searched (restaurant, address, landmark…).
 * Google draws everything here; after it loads, the element exposes the place's
 * location, which we use to move the globe and find Street View (Places UI Kit flow).
 */
export function searchedPlaceMarkup(placeId: string) {
  if (!isValidPlaceId(placeId)) throw new Error('Invalid place ID');
  return [
    '<gmp-place-details-compact orientation="vertical" style="width:100%;padding:0;margin:0;border:none;background-color:transparent;color-scheme:light">',
    `<gmp-place-details-place-request place="${esc(placeId)}"></gmp-place-details-place-request>`,
    '<gmp-place-name></gmp-place-name>',
    '<gmp-place-rating></gmp-place-rating>',
    '<gmp-place-type></gmp-place-type>',
    '<gmp-place-address></gmp-place-address>',
    '<gmp-place-open-now-status></gmp-place-open-now-status>',
    '<gmp-place-attribution light-scheme-color="gray"></gmp-place-attribution>',
    '</gmp-place-details-compact>',
  ].join('');
}

/** Read the location Google exposes on a loaded UI Kit element (LatLng or literal). */
export function locationFromUiKitPlace(place: unknown): { lat: number; lng: number } | null {
  const loc = (place as { location?: { lat?: unknown; lng?: unknown } } | null | undefined)?.location;
  if (!loc) return null;
  const lat = typeof loc.lat === 'function' ? (loc.lat as () => number)() : Number(loc.lat);
  const lng = typeof loc.lng === 'function' ? (loc.lng as () => number)() : Number(loc.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** Up to 3 relevant attractions near the destination, with Google's own rating display and attribution. */
export function attractionsMarkup(t: Pick<RatingsTarget, 'name' | 'country' | 'lat' | 'lng'>) {
  const query = `top attractions in ${t.name}, ${t.country}`;
  return [
    '<gmp-place-search orientation="vertical" truncation-preferred selectable attribution-position="bottom" style="width:100%;color-scheme:light">',
    `<gmp-place-text-search-request text-query="${esc(query)}" max-result-count="3" included-type="tourist_attraction" location-bias="${t.lat.toFixed(5)},${t.lng.toFixed(5)}"></gmp-place-text-search-request>`,
    '</gmp-place-search>',
  ].join('');
}

/** Google Maps listing link, built only from our stored Place ID and name (documented Maps URLs format). */
export function googleMapsPlaceUrl(placeId: string, name: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(placeId)}`;
}

/** Link for an attraction the user taps in Google's list. */
export function googleMapsPlaceIdUrl(placeId: string) {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}

// ── State ────────────────────────────────────────────────────────────────

export type DestinationStatus = 'loading' | 'shown' | 'noRating' | 'error';
export type AttractionsStatus = 'loading' | 'shown' | 'empty' | 'error';

export interface RatingsState {
  configured: boolean;
  destination: DestinationStatus;
  attractions: AttractionsStatus;
}

export type RatingsEvent =
  | { type: 'destinationLoaded'; ratingVisible: boolean }
  | { type: 'destinationError' }
  | { type: 'attractionsLoaded'; count: number }
  | { type: 'attractionsError' }
  | { type: 'timeout' };

export function initialRatingsState(t: RatingsTarget, configured: boolean): RatingsState {
  return {
    configured,
    // Without a verified Place ID there's nothing to ask Google for at the destination level.
    destination: !configured ? 'error' : isValidPlaceId(t.placeId) ? 'loading' : 'noRating',
    attractions: configured ? 'loading' : 'error',
  };
}

export function ratingsReducer(s: RatingsState, e: RatingsEvent): RatingsState {
  switch (e.type) {
    case 'destinationLoaded':
      return s.destination === 'loading' ? { ...s, destination: e.ratingVisible ? 'shown' : 'noRating' } : s;
    case 'destinationError':
      return { ...s, destination: 'error' };
    case 'attractionsLoaded':
      return s.attractions === 'loading' ? { ...s, attractions: e.count > 0 ? 'shown' : 'empty' } : s;
    case 'attractionsError':
      return { ...s, attractions: 'error' };
    case 'timeout':
      return {
        ...s,
        destination: s.destination === 'loading' ? 'error' : s.destination,
        attractions: s.attractions === 'loading' ? 'error' : s.attractions,
      };
  }
}

export interface RatingsView {
  /** Keep Google's destination element mounted (hidden while loading). Removed on error so no stale numbers remain. */
  mountDestination: boolean;
  mountAttractions: boolean;
  destinationMessage?: string;
  attractionsMessage?: string;
  loading: boolean;
  /** Show the Google Maps listing link for the destination. */
  showMapsLink: boolean;
}

/** What the place card should render for a given state. */
export function ratingsView(s: RatingsState, t: RatingsTarget): RatingsView {
  if (!s.configured)
    return { mountDestination: false, mountAttractions: false, destinationMessage: MSG.notConfigured, loading: false, showMapsLink: isValidPlaceId(t.placeId) };
  const bothFailed = s.destination === 'error' && s.attractions === 'error';
  return {
    mountDestination: isValidPlaceId(t.placeId) && (s.destination === 'loading' || s.destination === 'shown' || s.destination === 'noRating'),
    mountAttractions: s.attractions === 'loading' || s.attractions === 'shown',
    destinationMessage: bothFailed || s.destination === 'error' ? MSG.unavailable : s.destination === 'noRating' ? MSG.noRating : undefined,
    attractionsMessage: bothFailed ? undefined : s.attractions === 'empty' ? MSG.noAttractions : s.attractions === 'error' ? MSG.unavailable : undefined,
    loading: s.destination === 'loading' || s.attractions === 'loading',
    showMapsLink: isValidPlaceId(t.placeId),
  };
}

/** Maps JavaScript API script URL with the Places library (which provides the UI Kit elements). */
export function mapsScriptUrl(key: string, callback: string) {
  const u = new URL('https://maps.googleapis.com/maps/api/js');
  u.searchParams.set('key', key);
  u.searchParams.set('v', 'weekly');
  u.searchParams.set('libraries', 'places');
  u.searchParams.set('loading', 'async');
  u.searchParams.set('callback', callback);
  return u.toString();
}
