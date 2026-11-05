/**
 * Website: Google-rendered card for any searched place. After it loads we read the
 * location the UI Kit element exposes (documented Places UI Kit flow).
 */
import { useEffect, useRef } from 'react';

import { loadPlaces } from '@/lib/explore/maps-loader';
import { isValidPlaceId, locationFromUiKitPlace, searchedPlaceMarkup } from '@/lib/explore/ratings';

export function GooglePlaceDetails({ placeId, onLocation, onError }: { placeId: string; onLocation: (loc: { lat: number; lng: number }) => void; onError: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef({ onLocation, onError });
  useEffect(() => {
    cb.current = { onLocation, onError };
  });

  useEffect(() => {
    const h = host.current;
    if (!h || !isValidPlaceId(placeId)) return;
    let alive = true;
    loadPlaces()
      .then(() => {
        if (!alive) return;
        h.innerHTML = searchedPlaceMarkup(placeId);
        const el = h.firstElementChild as HTMLElement & { place?: unknown };
        el.addEventListener('gmp-load', () => {
          if (!alive) return;
          const loc = locationFromUiKitPlace(el.place);
          if (loc) cb.current.onLocation(loc);
          else cb.current.onError();
        });
        el.addEventListener('gmp-error', () => alive && cb.current.onError());
      })
      .catch(() => alive && cb.current.onError());
    return () => {
      alive = false;
      h.innerHTML = '';
    };
  }, [placeId]);

  return <div ref={host} />;
}
