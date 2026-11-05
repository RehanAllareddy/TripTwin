/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { altitudeBucket, globeLabel, visibleLabels, visibleMarkers, type GlobeMarker } from './globe-logic';

const m = (id: string, tier: 1 | 2 | 3, kind: GlobeMarker['kind'] = 'city'): GlobeMarker => ({ id, lat: 0, lng: 0, label: id, kind, tier });
const all = [m('a', 1), m('b', 2), m('c', 3, 'town'), m('trip:1', 1, 'trip')];

describe('marker decluttering', () => {
  it('shows only top-tier places and trips when zoomed out', () => {
    assert.deepEqual(visibleMarkers(all, 2.4).map((x) => x.id), ['a', 'trip:1']);
  });
  it('adds more places as you zoom in', () => {
    assert.deepEqual(visibleMarkers(all, 1.5).map((x) => x.id), ['a', 'b', 'trip:1']);
    assert.equal(visibleMarkers(all, 0.6).length, 4);
  });
  it('always shows the selected place, even when zoomed out', () => {
    assert.ok(visibleMarkers(all, 2.4, 'c').some((x) => x.id === 'c'));
  });
  it('hides labels when far away except for the selection and trips', () => {
    assert.deepEqual(visibleLabels(all, 2.4, 'a').map((x) => x.id), ['a', 'trip:1']);
    assert.equal(visibleLabels(all, 1.0).length, 4);
  });
  it('only changes bucket at thresholds (avoids re-rendering on every zoom tick)', () => {
    assert.equal(altitudeBucket(2.4), altitudeBucket(2.0));
    assert.notEqual(altitudeBucket(2.4), altitudeBucket(0.6));
  });
});

describe('globeLabel', () => {
  it('folds accents the 3D font cannot draw', () => {
    assert.equal(globeLabel('Český Krumlov'), 'Cesky Krumlov');
    assert.equal(globeLabel('Hội An'), 'Hoi An');
    assert.equal(globeLabel('Reykjavík'), 'Reykjavik');
  });
});
