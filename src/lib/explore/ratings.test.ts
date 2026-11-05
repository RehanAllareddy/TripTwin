/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  attractionsMarkup,
  destinationMarkup,
  googleMapsPlaceUrl,
  initialRatingsState,
  isValidPlaceId,
  locationFromUiKitPlace,
  searchedPlaceMarkup,
  MSG,
  ratingsReducer,
  ratingsView,
  type RatingsTarget,
} from './ratings';

const PID = 'ChIJO_PkYRozGQ0R0DaQ5L3rAAQ';
const withId: RatingsTarget = { placeId: PID, name: 'Lisbon', country: 'Portugal', lat: 38.7078, lng: -9.1366 };
const noId: RatingsTarget = { name: 'Hallstatt', country: 'Austria', lat: 47.5622, lng: 13.6493 };

describe('Places UI Kit markup', () => {
  it('always includes Google Maps attribution next to the destination rating', () => {
    const html = destinationMarkup(PID);
    assert.match(html, /<gmp-place-rating><\/gmp-place-rating>/);
    assert.match(html, /<gmp-place-attribution[^>]*><\/gmp-place-attribution>/);
    assert.ok(html.indexOf('gmp-place-attribution') > html.indexOf('gmp-place-rating'), 'attribution sits with the rating, inside the same element');
  });

  it('requests only the rating (no reviews, photos or other Places content)', () => {
    const html = destinationMarkup(PID);
    for (const el of ['gmp-place-reviews', 'gmp-place-media', 'gmp-place-all-content', 'gmp-place-standard-content']) assert.ok(!html.includes(el), `${el} should not be requested`);
  });

  it('limits attractions to 3 and keeps Google attribution visible', () => {
    const html = attractionsMarkup(withId);
    assert.match(html, /max-result-count="3"/);
    assert.match(html, /attribution-position="bottom"/);
    assert.match(html, /text-query="top attractions in Lisbon, Portugal"/);
  });

  it('escapes destination names inside attributes', () => {
    const html = attractionsMarkup({ ...withId, name: 'A"B<script>' });
    assert.ok(!html.includes('<script>'));
    assert.match(html, /A&quot;B&lt;script&gt;/);
  });

  it('rejects malformed place IDs instead of rendering them', () => {
    assert.equal(isValidPlaceId('bad id"><x'), false);
    assert.throws(() => destinationMarkup('"><img src=x>'));
    assert.equal(isValidPlaceId(PID), true);
  });

  it('builds a Google Maps listing link from the Place ID only', () => {
    assert.equal(googleMapsPlaceUrl(PID, 'Lisbon'), `https://www.google.com/maps/search/?api=1&query=Lisbon&query_place_id=${PID}`);
  });
});

describe('ratings state', () => {
  it('starts loading and shows no message or numbers while loading', () => {
    const s = initialRatingsState(withId, true);
    const v = ratingsView(s, withId);
    assert.equal(v.loading, true);
    assert.equal(v.destinationMessage, undefined);
    assert.equal(v.mountDestination, true);
  });

  it('shows the rating when Google rendered one', () => {
    const s = ratingsReducer(initialRatingsState(withId, true), { type: 'destinationLoaded', ratingVisible: true });
    const v = ratingsView(s, withId);
    assert.equal(s.destination, 'shown');
    assert.equal(v.destinationMessage, undefined);
    assert.equal(v.showMapsLink, true);
  });

  it('says so when Google has no rating for the destination, but still shows attractions', () => {
    let s = initialRatingsState(withId, true);
    s = ratingsReducer(s, { type: 'destinationLoaded', ratingVisible: false });
    s = ratingsReducer(s, { type: 'attractionsLoaded', count: 3 });
    const v = ratingsView(s, withId);
    assert.equal(v.destinationMessage, MSG.noRating);
    assert.equal(v.destinationMessage, "Google rating isn't available for this destination");
    assert.equal(v.mountAttractions, true);
    assert.equal(v.attractionsMessage, undefined);
  });

  it('treats a destination without a verified Place ID as having no Google rating', () => {
    const s = initialRatingsState(noId, true);
    const v = ratingsView(s, noId);
    assert.equal(v.mountDestination, false);
    assert.equal(v.destinationMessage, MSG.noRating);
    assert.equal(v.mountAttractions, true, 'attractions can still be searched by name');
    assert.equal(v.showMapsLink, false);
  });

  it('on a failed request, removes Google elements so no old numbers stay on screen', () => {
    let s = initialRatingsState(withId, true);
    s = ratingsReducer(s, { type: 'destinationLoaded', ratingVisible: true });
    s = ratingsReducer(s, { type: 'destinationError' });
    s = ratingsReducer(s, { type: 'attractionsError' });
    const v = ratingsView(s, withId);
    assert.equal(v.mountDestination, false);
    assert.equal(v.mountAttractions, false);
    assert.equal(v.destinationMessage, 'Ratings are unavailable right now');
    assert.equal(v.attractionsMessage, undefined, 'one combined message, not two');
  });

  it('times out into the unavailable message rather than spinning forever', () => {
    const s = ratingsReducer(initialRatingsState(withId, true), { type: 'timeout' });
    const v = ratingsView(s, withId);
    assert.equal(v.loading, false);
    assert.equal(v.destinationMessage, MSG.unavailable);
  });

  it('a late load event after a timeout does not resurrect stale results', () => {
    let s = ratingsReducer(initialRatingsState(withId, true), { type: 'timeout' });
    s = ratingsReducer(s, { type: 'destinationLoaded', ratingVisible: true });
    assert.equal(s.destination, 'error');
  });

  it('reports when Google found no attractions', () => {
    const s = ratingsReducer(initialRatingsState(withId, true), { type: 'attractionsLoaded', count: 0 });
    assert.equal(ratingsView(s, withId).attractionsMessage, MSG.noAttractions);
  });

  it('never mounts Google elements when ratings are not configured', () => {
    const v = ratingsView(initialRatingsState(withId, false), withId);
    assert.equal(v.mountDestination, false);
    assert.equal(v.mountAttractions, false);
    assert.equal(v.destinationMessage, MSG.notConfigured);
  });
});

describe('searched places (any restaurant, address or landmark)', () => {
  it('shows Google attribution and only display fields Google renders itself', () => {
    const html = searchedPlaceMarkup(PID);
    assert.match(html, /<gmp-place-attribution[^>]*>/);
    assert.match(html, /<gmp-place-name>/);
    assert.ok(!html.includes('gmp-place-reviews'), 'no reviews');
  });
  it('reads the location from a Google LatLng or a literal, and rejects junk', () => {
    assert.deepEqual(locationFromUiKitPlace({ location: { lat: () => 17.36, lng: () => 78.47 } }), { lat: 17.36, lng: 78.47 });
    assert.deepEqual(locationFromUiKitPlace({ location: { lat: 1, lng: 2 } }), { lat: 1, lng: 2 });
    assert.equal(locationFromUiKitPlace({ location: { lat: 'x', lng: 2 } }), null);
    assert.equal(locationFromUiKitPlace({ location: { lat: 95, lng: 2 } }), null);
    assert.equal(locationFromUiKitPlace(null), null);
  });
});
