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
 * Once `npm run verify:destinations` has run, only destinations with confirmed Street View
 * coverage are featured. Before that (nothing verified yet), every curated destination is
 * shown so Explore isn't empty; "View in 360°" then checks coverage live before opening.
 */
export function featuredDestinations(all: Destination[] = DESTINATIONS, verified: Record<string, Verification> = VERIFIED): FeaturedDestination[] {
  const anyVerified = Object.keys(verified).length > 0;
  return all
    .map((d) => {
      const v = verified[d.id];
      return v ? { ...d, lat: v.lat, lng: v.lng, placeId: v.placeId, panoId: v.panoId, verified: true } : { ...d, verified: false };
    })
    .filter((d) => d.verified || !anyVerified);
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

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

/** Optimal string alignment distance (Levenshtein + adjacent swaps), capped for speed. */
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** How many typos to forgive for a query of this length. */
const allowedTypos = (len: number) => (len <= 3 ? 0 : len <= 5 ? 1 : len <= 8 ? 2 : 3);

/**
 * Typo-tolerant search over name and country, best matches first.
 * "barcelna" → Barcelona, "kyotto" → Kyoto, "cesky" → Český Krumlov.
 */
export function searchDestinations<T extends Pick<Destination, 'name' | 'country' | 'type'>>(list: T[], query: string, type: 'all' | 'city' | 'town' = 'all', limit = 8): T[] {
  const q = norm(query);
  const pool = type === 'all' ? list : list.filter((d) => d.type === type);
  if (!q) return pool.slice(0, limit);
  const typos = allowedTypos(q.length);
  return pool
    .map((d) => {
      const n = norm(d.name);
      const c = norm(d.country);
      let score = n.startsWith(q) ? 0 : n.split(' ').some((w) => w.startsWith(q)) ? 1 : n.includes(q) ? 2 : c.startsWith(q) ? 3 : -1;
      if (score < 0 && typos > 0) {
        // Compare against the whole name and against the start of the name (for partial typing).
        const dist = Math.min(editDistance(q, n, typos), editDistance(q, n.slice(0, q.length), typos), ...n.split(' ').map((w) => editDistance(q, w, typos)));
        if (dist <= typos) score = 4 + dist;
      }
      return { d, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => a.score - b.score || a.d.name.localeCompare(b.d.name))
    .slice(0, limit)
    .map((x) => x.d);
}
