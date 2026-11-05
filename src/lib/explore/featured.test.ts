/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DESTINATIONS, type Destination } from '../../data/destinations';
import { featuredDestinations, nearestDestination, searchDestinations, type Verification } from './featured';

const two: Destination[] = DESTINATIONS.filter((d) => d.id === 'lisbon' || d.id === 'hallstatt');
const v: Record<string, Verification> = { lisbon: { placeId: 'ChIJO_PkYRozGQ0R0DaQ5L3rAAQ', panoId: 'p1', lat: 38.7, lng: -9.1, radius: 50, checkedAt: '2026-11-04' } };

describe('dataset', () => {
  it('has about 100 destinations with unique ids, on every inhabited continent', () => {
    assert.ok(DESTINATIONS.length >= 95 && DESTINATIONS.length <= 115, `got ${DESTINATIONS.length}`);
    assert.equal(new Set(DESTINATIONS.map((d) => d.id)).size, DESTINATIONS.length);
    for (const c of ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania']) assert.ok(DESTINATIONS.some((d) => d.continent === c), c);
    assert.ok(DESTINATIONS.some((d) => d.type === 'town') && DESTINATIONS.some((d) => d.type === 'city'));
  });
  it('has valid coordinates and a description for every entry', () => {
    for (const d of DESTINATIONS) {
      assert.ok(Math.abs(d.lat) <= 90 && Math.abs(d.lng) <= 180, d.id);
      assert.ok(d.description.length > 20, d.id);
    }
  });
});

describe('featuredDestinations', () => {
  it('in production, only features destinations with verified Street View', () => {
    const list = featuredDestinations(two, v, false);
    assert.deepEqual(list.map((d) => d.id), ['lisbon']);
    assert.equal(list[0].placeId, v.lisbon.placeId);
    assert.equal(list[0].lat, 38.7, 'uses the verified coordinate');
  });
  it('in production with nothing verified, features nothing', () => assert.equal(featuredDestinations(two, {}, false).length, 0));
  it('in development with nothing verified, shows everything as unverified', () => {
    const list = featuredDestinations(two, {}, true);
    assert.equal(list.length, 2);
    assert.ok(list.every((d) => !d.verified));
  });
});

describe('search and nearest', () => {
  it('matches names ignoring accents and filters by type', () => {
    assert.equal(searchDestinations(DESTINATIONS, 'cesky')[0]?.id, 'cesky-krumlov');
    assert.ok(searchDestinations(DESTINATIONS, '', 'town', 100).every((d) => d.type === 'town'));
    assert.equal(searchDestinations(DESTINATIONS, 'portugal')[0]?.country, 'Portugal');
  });
  it('finds the nearest featured destination within range, or none', () => {
    assert.equal(nearestDestination(38.8, -9.2, two)?.id, 'lisbon');
    assert.equal(nearestDestination(0, -150, two), null);
  });
});
