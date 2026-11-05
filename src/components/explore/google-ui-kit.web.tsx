/**
 * Website: renders Google's Places UI Kit elements directly in the page.
 * Google draws the rating, review count and attribution. TripTwin only listens for
 * load / error events and never reads or stores the rating values.
 */
import { createElement, useEffect, useRef } from 'react';
import { View } from 'react-native';

import { GOOGLE_MAPS_BROWSER_KEY } from '@/lib/explore/config';
import { attractionsMarkup, destinationMarkup, googleMapsPlaceIdUrl, isValidPlaceId, mapsScriptUrl, type RatingsEvent, type RatingsTarget } from '@/lib/explore/ratings';

type MapsWindow = Window & { google?: { maps?: { importLibrary?: (name: string) => Promise<unknown> } }; [k: string]: unknown };

let placesReady: Promise<void> | null = null;

/** Load the Maps JavaScript API + Places library once per page. */
function loadPlaces(): Promise<void> {
  if (placesReady) return placesReady;
  placesReady = new Promise<void>((resolve, reject) => {
    const w = window as unknown as MapsWindow;
    const done = () => w.google!.maps!.importLibrary!('places').then(() => resolve(), reject);
    if (w.google?.maps?.importLibrary) return void done();
    const cb = '__tripTwinMapsReady';
    w[cb] = done;
    const s = document.createElement('script');
    s.src = mapsScriptUrl(GOOGLE_MAPS_BROWSER_KEY, cb);
    s.async = true;
    s.onerror = () => {
      placesReady = null; // allow a retry next time a card opens
      reject(new Error('Maps JavaScript API failed to load'));
    };
    document.head.appendChild(s);
  });
  return placesReady;
}

/**
 * Whether Google rendered a rating. We only measure layout (we never read the rating itself).
 * A compact element containing just the attribution line is short; with a rating row it is taller.
 */
function ratingRendered(el: HTMLElement) {
  const r = el.querySelector('gmp-place-rating');
  if (r && r.getBoundingClientRect().height > 2) return true;
  return el.getBoundingClientRect().height > 44;
}

export function GoogleUiKit({ target, mountDestination, mountAttractions, onEvent }: { target: RatingsTarget; mountDestination: boolean; mountAttractions: boolean; onEvent: (e: RatingsEvent) => void }) {
  const destRef = useRef<HTMLDivElement>(null);
  const attrRef = useRef<HTMLDivElement>(null);
  const emit = useRef(onEvent);
  useEffect(() => {
    emit.current = onEvent;
  });

  // Destination rating
  useEffect(() => {
    const host = destRef.current;
    if (!host) return;
    if (!mountDestination || !isValidPlaceId(target.placeId)) {
      host.innerHTML = ''; // remove any previous numbers immediately
      return;
    }
    let alive = true;
    const placeId = target.placeId;
    loadPlaces()
      .then(() => {
        if (!alive) return;
        host.innerHTML = destinationMarkup(placeId);
        const el = host.firstElementChild as HTMLElement;
        el.addEventListener('gmp-load', () => setTimeout(() => alive && emit.current({ type: 'destinationLoaded', ratingVisible: ratingRendered(el) }), 60));
        el.addEventListener('gmp-error', () => alive && emit.current({ type: 'destinationError' }));
      })
      .catch(() => alive && emit.current({ type: 'destinationError' }));
    return () => {
      alive = false;
    };
  }, [mountDestination, target.placeId]);

  // Up to 3 attractions
  useEffect(() => {
    const host = attrRef.current;
    if (!host) return;
    if (!mountAttractions) {
      host.innerHTML = '';
      return;
    }
    let alive = true;
    loadPlaces()
      .then(() => {
        if (!alive) return;
        host.innerHTML = attractionsMarkup(target);
        const el = host.firstElementChild as HTMLElement & { places?: unknown[] };
        el.addEventListener('gmp-load', () => alive && emit.current({ type: 'attractionsLoaded', count: el.places?.length ?? 0 }));
        el.addEventListener('gmp-error', () => alive && emit.current({ type: 'attractionsError' }));
        el.addEventListener('gmp-select', (e) => {
          const id = (e as Event & { place?: { id?: string } }).place?.id;
          if (id && isValidPlaceId(id)) window.open(googleMapsPlaceIdUrl(id), '_blank', 'noopener');
        });
      })
      .catch(() => alive && emit.current({ type: 'attractionsError' }));
    return () => {
      alive = false;
    };
    // target fields are stable per destination; re-run only when the destination changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mountAttractions, target.name, target.country]);

  return (
    <View style={{ gap: 12 }}>
      {/* Plain DOM hosts: Google's custom elements are inserted into these. */}
      {createElement('div', { ref: destRef })}
      {createElement('div', { ref: attrRef })}
    </View>
  );
}
