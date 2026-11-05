import { DESTINATIONS, type Destination } from '@/data/destinations';
import verifiedJson from '@/data/destinations.verified.json';

/**
 * Verification results written by `npm run verify:destinations`:
 * - placeId: Google Place ID (storable indefinitely per Google's caching exemption)
 * - panoId:  Street View panorama ID (Google ID caching is permitted)
 * - lat/lng: TripTwin's own coordinate that passed the Street View check
 */
export interface Verification {
  placeId?: string;
  panoId: string;
  lat: number;
  lng: number;
  radius: number;
  checkedAt: string;
}

export interface FeaturedDestination extends Destination {
  placeId?: string;
  panoId?: string;
  verified: boolean;
}

const VERIFIED = verifiedJson as Record<string, Verification>;

/**
 * Only destinations with confirmed Street View coverage are featured.
 * In development, before the verification script has been run, everything is shown
 * (marked unverified) so the feature can be tried out. Production never does this.
 */
export function featuredDestinations(all: Destination[] = DESTINATIONS, verified: Record<string, Verification> = VERIFIED, isDev = __DEV__): FeaturedDestination[] {
  const anyVerified = Object.keys(verified).length > 0;
  return all
    .map((d) => {
      const v = verified[d.id];
      return v ? { ...d, lat: v.lat, lng: v.lng, placeId: v.placeId, panoId: v.panoId, verified: true } : { ...d, verified: false };
    })
    .filter((d) => d.verified || (isDev && !anyVerified));
}

export const showingUnverified = (list: FeaturedDestination[]) => list.length > 0 && list.every((d) => !d.verified);

/** Great-circle distance in km. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r;
  const dLng = (bLng - aLng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function nearestDestination<T extends { lat: number; lng: number }>(lat: number, lng: number, list: T[], maxKm = 1500): (T & { km: number }) | null {
  let best: (T & { km: number }) | null = null;
  for (const d of list) {
    const km = distanceKm(lat, lng, d.lat, d.lng);
    if (km <= maxKm && (!best || km < best.km)) best = { ...d, km };
  }
  return best;
}

/** Case- and accent-insensitive search over name and country, best matches first. */
export function searchDestinations<T extends Pick<Destination, 'name' | 'country' | 'type'>>(list: T[], query: string, type: 'all' | 'city' | 'town' = 'all', limit = 8): T[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(query.trim());
  const pool = type === 'all' ? list : list.filter((d) => d.type === type);
  if (!q) return pool.slice(0, limit);
  return pool
    .map((d) => {
      const n = norm(d.name);
      const c = norm(d.country);
      const score = n.startsWith(q) ? 0 : n.includes(q) ? 1 : c.startsWith(q) ? 2 : c.includes(q) ? 3 : -1;
      return { d, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => a.score - b.score || a.d.name.localeCompare(b.d.name))
    .slice(0, limit)
    .map((x) => x.d);
}
