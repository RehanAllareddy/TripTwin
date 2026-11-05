/// <reference types="node" />
/**
 * One-time (or occasional) destination verification.
 *
 *   npm run verify:destinations            # all destinations
 *   npm run verify:destinations -- lisbon  # just some ids
 *
 * Needs GOOGLE_MAPS_SERVER_KEY in .env.local (Places API (New) + Street View Static API enabled).
 *
 * For each destination in src/data/destinations.ts it:
 *  1. Finds the Google Place ID with Text Search using an IDs-only field mask (`places.id`),
 *     which is billed under "Text Search Essentials (IDs Only)" — unlimited at no charge.
 *  2. Checks Street View coverage with the Street View Image Metadata endpoint
 *     (free, no quota consumed), widening the radius 50 → 250 → 1000 m.
 *
 * It writes src/data/destinations.verified.json with ONLY:
 *  - placeId  (storable indefinitely: Google's Place ID caching exemption)
 *  - panoId   (Google ID caching is permitted by the Service Specific Terms)
 *  - lat/lng  (TripTwin's own coordinate from destinations.ts — not Google's)
 *  - radius, checkedAt
 * No names, ratings, reviews or other Places content are requested or stored.
 * Destinations without Street View are left out (and therefore not featured).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { DESTINATIONS, type Destination } from '../src/data/destinations';
import type { Verification } from '../src/lib/explore/featured';
import { metadataUrl, parseStreetViewMetadata, type Radius } from '../src/lib/explore/streetview-core';

const KEY = process.env.GOOGLE_MAPS_SERVER_KEY;
const OUT = join(__dirname, '..', 'src', 'data', 'destinations.verified.json');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function findPlaceId(d: Destination): Promise<string | undefined> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY!, 'X-Goog-FieldMask': 'places.id' },
    body: JSON.stringify({
      textQuery: `${d.name}, ${d.country}`,
      pageSize: 1,
      locationBias: { circle: { center: { latitude: d.lat, longitude: d.lng }, radius: 30000 } },
    }),
  });
  if (!res.ok) throw new Error(`Text Search HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { places?: { id?: string }[] };
  return body.places?.[0]?.id;
}

async function checkStreetView(d: Destination) {
  for (const radius of [50, 250, 1000] as Radius[]) {
    const res = await fetch(metadataUrl({ lat: d.lat, lng: d.lng, radius }, KEY!));
    const r = parseStreetViewMetadata(await res.json());
    if (r.status === 'ok') return { panoId: r.panoId, radius };
    if (r.status === 'error') throw new Error(`Street View metadata: ${r.message}`);
  }
  return null;
}

async function main() {
  if (!KEY) {
    console.error('Missing GOOGLE_MAPS_SERVER_KEY. Add it to .env.local (see .env.example).');
    process.exit(1);
  }
  const only = process.argv.slice(2);
  const targets = only.length ? DESTINATIONS.filter((d) => only.includes(d.id)) : DESTINATIONS;
  const existing = JSON.parse(readFileSync(OUT, 'utf8')) as Record<string, Verification>;
  const result: Record<string, Verification> = only.length ? existing : {};
  const failed: string[] = [];
  const noPlaceId: string[] = [];

  for (const d of targets) {
    process.stdout.write(`${d.id.padEnd(22)} `);
    try {
      const sv = await checkStreetView(d);
      if (!sv) {
        delete result[d.id];
        failed.push(d.id);
        console.log('✗ no Street View within 1 km. Not featured. Try a different coordinate.');
        continue;
      }
      const placeId = await findPlaceId(d);
      if (!placeId) noPlaceId.push(d.id);
      result[d.id] = { placeId, panoId: sv.panoId, lat: d.lat, lng: d.lng, radius: sv.radius, checkedAt: new Date().toISOString().slice(0, 10) };
      console.log(`✓ Street View within ${sv.radius} m${placeId ? '' : ' (no Place ID found)'}`);
    } catch (e) {
      failed.push(d.id);
      console.log(`! ${(e as Error).message}`);
    }
    await sleep(120);
  }

  const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(OUT, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`\n${Object.keys(sorted).length} verified → ${OUT}`);
  if (failed.length) console.log(`Not featured (${failed.length}): ${failed.join(', ')}`);
  if (noPlaceId.length) console.log(`No Place ID (ratings will say unavailable): ${noPlaceId.join(', ')}`);
}

main();
