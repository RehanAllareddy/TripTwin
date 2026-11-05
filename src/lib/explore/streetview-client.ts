import { API_BASE } from './config';
import type { Radius, StreetViewResult } from './streetview-core';

const inFlight = new Map<string, Promise<StreetViewResult>>();

/**
 * Ask TripTwin's server whether Street View imagery exists near a point.
 * Identical concurrent requests share one network call.
 */
export function checkStreetView(lat: number, lng: number, radius: Radius): Promise<StreetViewResult> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)},${radius}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const p = (async (): Promise<StreetViewResult> => {
    try {
      const url = `${API_BASE}/api/streetview?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}&radius=${radius}`;
      const res = await fetch(url);
      const body = (await res.json().catch(() => null)) as StreetViewResult | null;
      if (!body || typeof body !== 'object' || !('status' in body)) return { status: 'error', message: 'Unexpected response' };
      if (res.status === 429) return { status: 'error', message: 'You are going a bit fast. Wait a moment and try again.' };
      return body;
    } catch {
      return { status: 'error', message: 'Could not reach TripTwin. Check your connection.' };
    }
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, p);
  return p;
}
