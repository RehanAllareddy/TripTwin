/**
 * GET /api/streetview?lat=..&lng=..&radius=50|250|1000|5000
 *
 * Checks whether Google Street View imagery exists near a point, using the
 * Street View Image Metadata endpoint (free; no quota consumed).
 * Keeps the server key off the client, validates input and rate-limits per IP.
 *
 * Deployed by Vercel as a serverless function (Node.js runtime, Web-standard handler).
 */
import { createRateLimiter, metadataUrl, parseLatLngQuery, parseStreetViewMetadata, type StreetViewResult } from '../src/lib/explore/streetview-core';

// 30 checks per minute per IP, per function instance (best effort).
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

const json = (body: StreetViewResult | { status: 'error'; message: string }, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra },
  });

/** Allow local development (http://localhost:<port>) to call a deployed endpoint. Production is same-origin. */
const devCors = (request: Request): Record<string, string> => {
  const origin = request.headers.get('origin') ?? '';
  return /^http:\/\/localhost(:\d{1,5})?$/.test(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
};

export async function GET(request: Request): Promise<Response> {
  const cors = devCors(request);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  const rl = limiter(ip);
  if (!rl.ok) return json({ status: 'error', message: 'Too many requests. Please wait a moment.' }, 429, { 'Retry-After': String(rl.retryAfterSec), ...cors });

  const query = parseLatLngQuery(new URL(request.url).searchParams);
  if (!query) return json({ status: 'error', message: 'Invalid location' }, 400, cors);

  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) return json({ status: 'error', message: 'Street View is not configured' }, 503, cors);

  try {
    const res = await fetch(metadataUrl(query, key), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return json({ status: 'error', message: 'Street View lookup failed' }, 502, cors);
    const result = parseStreetViewMetadata(await res.json());
    // Never echo Google error details (they can mention key configuration) to the public.
    if (result.status === 'error') return json({ status: 'error', message: 'Street View lookup failed' }, 502, cors);
    return json(result, 200, cors);
  } catch {
    return json({ status: 'error', message: 'Street View lookup failed' }, 502, cors);
  }
}

export function POST(): Response {
  return json({ status: 'error', message: 'Method not allowed' }, 405, { Allow: 'GET' });
}
