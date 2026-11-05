/**
 * Website: Google's Places UI Kit "Basic Place Autocomplete" search box.
 * Finds any place worldwide (cities, addresses, restaurants, landmarks) and handles typos.
 * Billed per session under "Places UI Kit - Autocomplete Per Session".
 */
import { useEffect, useRef } from 'react';

import { loadPlaces } from '@/lib/explore/maps-loader';
import { isValidPlaceId } from '@/lib/explore/ratings';

export function GoogleSearch({ onSelect, onError }: { onSelect: (placeId: string) => void; onError: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef({ onSelect, onError });
  useEffect(() => {
    cb.current = { onSelect, onError };
  });

  useEffect(() => {
    let alive = true;
    let el: HTMLElement | null = null;
    loadPlaces()
      .then((lib) => {
        if (!alive || !host.current) return;
        const Ctor = lib.BasicPlaceAutocompleteElement as new () => HTMLElement & { placeholder?: string };
        const ac = new Ctor();
        ac.placeholder = 'Search any place: city, address, restaurant…';
        el = ac;
        el.setAttribute('aria-label', 'Search any place');
        el.style.width = '100%';
        el.style.colorScheme = 'light';
        el.addEventListener('gmp-select', (e) => {
          const id = (e as Event & { place?: { id?: string } }).place?.id;
          if (id && isValidPlaceId(id)) cb.current.onSelect(id);
        });
        el.addEventListener('gmp-error', () => cb.current.onError());
        host.current.appendChild(el);
      })
      .catch(() => alive && cb.current.onError());
    return () => {
      alive = false;
      el?.remove();
    };
  }, []);

  return <div ref={host} style={{ width: '100%', minHeight: 48 }} />;
}
