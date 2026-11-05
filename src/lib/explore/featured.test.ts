/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DESTINATIONS, type Destination } from '../../data/destinations';
import { editDistance, featuredDestinations, nearestDestination, searchDestinations, type Verification } from './featured';

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
  it('once anything is verified, only features destinations with verified Street View', () => {
    const list = featuredDestinations(two, v);
    assert.deepEqual(list.map((d) => d.id), ['lisbon']);
    assert.equal(list[0].placeId, v.lisbon.placeId);
    assert.equal(list[0].lat, 38.7, 'uses the verified coordinate');
  });
  it('before verification has run, shows every destination (marked unverified) so Explore is never empty', () => {
    const list = featuredDestinations(two, {});
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

describe('typo-tolerant search', () => {
  const top = (q: string) => searchDestinations(DESTINATIONS, q)[0]?.id;
  it('finds places despite common typos', () => {
    assert.equal(top('barcelna'), 'barcelona');
    assert.equal(top('kyotto'), 'kyoto');
    assert.equal(top('hydrabad'), 'hyderabad');
    assert.equal(top('lisbn'), 'lisbon');
    assert.equal(top('amsterdma'), 'amsterdam', 'swapped letters');
    assert.equal(top('reykjavik'), 'reykjavik', 'missing accent');
    assert.equal(top('quenstown'), 'queenstown');
  });
  it('matches the start of a later word and partial typing', () => {
    assert.equal(top('krumlov'), 'cesky-krumlov');
    assert.equal(top('buenos ai'), 'buenos-aires');
  });
  it('does not return random results for short or unrelated queries', () => {
    assert.equal(searchDestinations(DESTINATIONS, 'zzqq').length, 0);
    assert.ok(searchDestinations(DESTINATIONS, 'xyz').length === 0);
  });
  it('editDistance handles swaps and caps work', () => {
    assert.equal(editDistance('abcd', 'abdc'), 1);
    assert.equal(editDistance('kitten', 'sitting'), 3);
    assert.ok(editDistance('a', 'abcdefgh', 2) > 2);
  });
});
