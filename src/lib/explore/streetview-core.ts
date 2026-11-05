/**
 * Pure Street View helpers shared by the server endpoint (api/streetview.ts),
 * the app, and the destination verification script. No React / RN imports here.
 */

export const ALLOWED_RADII = [50, 250, 1000, 5000] as const;
export type Radius = (typeof ALLOWED_RADII)[number];

export type StreetViewResult =
  | { status: 'ok'; panoId: string; lat: number; lng: number; date?: string; copyright?: string }
  | { status: 'none' }
  | { status: 'error'; message: string };

export interface LatLngQuery {
  lat: number;
  lng: number;
  radius: Radius;
}

/** Validate untrusted query parameters. Returns null when anything is off. */
export function parseLatLngQuery(params: URLSearchParams): LatLngQuery | null {
  const latRaw = params.get('lat');
  const lngRaw = params.get('lng');
  const radiusRaw = params.get('radius') ?? '1000';
  const num = /^-?\d{1,3}(\.\d{1,7})?$/;
  if (!latRaw || !lngRaw || !num.test(latRaw) || !num.test(lngRaw) || !/^\d{1,5}$/.test(radiusRaw)) return null;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  const radius = Number(radiusRaw) as Radius;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (!ALLOWED_RADII.includes(radius)) return null;
  return { lat, lng, radius };
}

/** Street View Image Metadata request URL. Metadata requests are free and use no quota. */
export function metadataUrl(q: LatLngQuery, key: string) {
  const u = new URL('https://maps.googleapis.com/maps/api/streetview/metadata');
  u.searchParams.set('location', `${q.lat.toFixed(6)},${q.lng.toFixed(6)}`);
  u.searchParams.set('radius', String(q.radius));
  u.searchParams.set('source', 'outdoor');
  u.searchParams.set('key', key);
  return u.toString();
}

/** Normalize Google's metadata response into our three outcomes. */
export function parseStreetViewMetadata(body: unknown): StreetViewResult {
  if (!body || typeof body !== 'object') return { status: 'error', message: 'Unexpected response' };
  const b = body as { status?: unknown; pano_id?: unknown; location?: { lat?: unknown; lng?: unknown }; date?: unknown; copyright?: unknown };
  switch (b.status) {
    case 'OK': {
      const lat = Number(b.location?.lat);
      const lng = Number(b.location?.lng);
      if (typeof b.pano_id !== 'string' || !b.pano_id || !Number.isFinite(lat) || !Number.isFinite(lng)) return { status: 'error', message: 'Incomplete metadata' };
      return {
        status: 'ok',
        panoId: b.pano_id,
        lat,
        lng,
        date: typeof b.date === 'string' ? b.date : undefined,
        copyright: typeof b.copyright === 'string' ? b.copyright : undefined,
      };
    }
    case 'ZERO_RESULTS':
    case 'NOT_FOUND':
      return { status: 'none' };
    default:
      return { status: 'error', message: typeof b.status === 'string' ? b.status : 'Unknown status' };
  }
}

/**
 * Pick a search radius that matches how precise a globe click can be.
 * Zoomed far out, one pixel covers many kilometres, so search wider.
 */
export function radiusForAltitude(altitude: number): Radius {
  if (altitude < 0.05) return 50;
  if (altitude < 0.2) return 250;
  if (altitude < 0.8) return 1000;
  return 5000;
}

/** "Open in Google Maps" Street View link, in the format Google documents for Maps URLs. */
export function streetViewMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/** Simple fixed-window rate limiter. Per server instance only (best effort; Google quotas are the hard cap). */
export function createRateLimiter({ limit, windowMs, now = () => Date.now() }: { limit: number; windowMs: number; now?: () => number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string): { ok: true } | { ok: false; retryAfterSec: number } => {
    const t = now();
    // Keep memory bounded on long-lived instances.
    if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      hits.set(key, { count: 1, resetAt: t + windowMs });
      return { ok: true };
    }
    if (entry.count >= limit) return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - t) / 1000) };
    entry.count++;
    return { ok: true };
  };
}

/** Maps Embed API Street View URL (free, unlimited). Prefers a pano ID, falls back to a location. */
export function streetViewEmbedUrl(key: string, opts: { panoId?: string; lat: number; lng: number }) {
  const u = new URL('https://www.google.com/maps/embed/v1/streetview');
  u.searchParams.set('key', key);
  if (opts.panoId && /^[A-Za-z0-9_-]{5,200}$/.test(opts.panoId)) u.searchParams.set('pano', opts.panoId);
  u.searchParams.set('location', `${opts.lat.toFixed(6)},${opts.lng.toFixed(6)}`);
  u.searchParams.set('fov', '90');
  return u.toString();
}
