/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createRateLimiter, metadataUrl, parseLatLngQuery, parseStreetViewMetadata, radiusForAltitude, streetViewEmbedUrl, streetViewMapsUrl } from './streetview-core';

describe('parseLatLngQuery (server input validation)', () => {
  const q = (s: string) => parseLatLngQuery(new URLSearchParams(s));
  it('accepts a normal point', () => assert.deepEqual(q('lat=38.7078&lng=-9.1366&radius=50'), { lat: 38.7078, lng: -9.1366, radius: 50 }));
  it('defaults the radius to 1000 m', () => assert.equal(q('lat=1&lng=2')?.radius, 1000));
  it('rejects out-of-range coordinates', () => {
    assert.equal(q('lat=91&lng=0'), null);
    assert.equal(q('lat=0&lng=-181'), null);
  });
  it('rejects non-numeric or injected input', () => {
    assert.equal(q('lat=abc&lng=0'), null);
    assert.equal(q('lat=1e3&lng=0'), null);
    assert.equal(q('lat=1&lng=2&radius=999999'), null);
    assert.equal(q('lat=1;drop&lng=2'), null);
    assert.equal(q('lng=2'), null);
  });
  it('only allows the fixed radius options', () => assert.equal(q('lat=1&lng=2&radius=77'), null));
});

describe('parseStreetViewMetadata', () => {
  it('returns the panorama on OK', () => {
    const r = parseStreetViewMetadata({ status: 'OK', pano_id: 'abc123', location: { lat: 1.5, lng: 2.5 }, date: '2024-05', copyright: '© Google' });
    assert.deepEqual(r, { status: 'ok', panoId: 'abc123', lat: 1.5, lng: 2.5, date: '2024-05', copyright: '© Google' });
  });
  it('treats ZERO_RESULTS and NOT_FOUND as "no imagery", not an error', () => {
    assert.deepEqual(parseStreetViewMetadata({ status: 'ZERO_RESULTS' }), { status: 'none' });
    assert.deepEqual(parseStreetViewMetadata({ status: 'NOT_FOUND' }), { status: 'none' });
  });
  it('turns denied/quota/garbage responses into errors without crashing', () => {
    assert.equal(parseStreetViewMetadata({ status: 'REQUEST_DENIED' }).status, 'error');
    assert.equal(parseStreetViewMetadata({ status: 'OVER_QUERY_LIMIT' }).status, 'error');
    assert.equal(parseStreetViewMetadata(null).status, 'error');
    assert.equal(parseStreetViewMetadata('nope').status, 'error');
    assert.equal(parseStreetViewMetadata({ status: 'OK' }).status, 'error', 'OK without a pano is incomplete');
  });
});

describe('URLs', () => {
  it('builds the metadata URL with outdoor-only imagery', () => {
    const u = new URL(metadataUrl({ lat: 1, lng: 2, radius: 50 }, 'KEY'));
    assert.equal(u.searchParams.get('location'), '1.000000,2.000000');
    assert.equal(u.searchParams.get('radius'), '50');
    assert.equal(u.searchParams.get('source'), 'outdoor');
  });
  it('uses the requested Google Maps Street View link format', () => {
    assert.equal(streetViewMapsUrl(38.7078, -9.1366), 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=38.707800,-9.136600');
  });
  it('searches wider when zoomed far out', () => {
    assert.equal(radiusForAltitude(0.01), 50);
    assert.equal(radiusForAltitude(2.5), 5000);
  });
});

describe('rate limiter', () => {
  it('blocks after the limit and recovers after the window', () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: () => t });
    assert.equal(rl('ip').ok, true);
    assert.equal(rl('ip').ok, true);
    const blocked = rl('ip');
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.retryAfterSec, 1);
    assert.equal(rl('other-ip').ok, true, 'limits are per client');
    t = 1001;
    assert.equal(rl('ip').ok, true);
  });
});

describe('streetViewEmbedUrl', () => {
  it('uses the pano when valid and always includes a fallback location', () => {
    const u = new URL(streetViewEmbedUrl('K', { panoId: 'CAoSLEFGMVFpcE', lat: 1, lng: 2 }));
    assert.equal(u.pathname, '/maps/embed/v1/streetview');
    assert.equal(u.searchParams.get('pano'), 'CAoSLEFGMVFpcE');
    assert.equal(u.searchParams.get('location'), '1.000000,2.000000');
  });
  it('drops a malformed pano id', () => {
    const u = new URL(streetViewEmbedUrl('K', { panoId: 'bad"id', lat: 1, lng: 2 }));
    assert.equal(u.searchParams.get('pano'), null);
  });
});
