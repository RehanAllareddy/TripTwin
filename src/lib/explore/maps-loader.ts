/**
 * Website only: loads the Maps JavaScript API + Places library (Places UI Kit) once per page.
 * Imported only from *.web.tsx components.
 */
import { GOOGLE_MAPS_BROWSER_KEY } from './config';
import { mapsScriptUrl } from './ratings';

type MapsWindow = { google?: { maps?: { importLibrary?: (name: string) => Promise<unknown> } }; [k: string]: unknown };

let placesReady: Promise<Record<string, unknown>> | null = null;

export function loadPlaces(): Promise<Record<string, unknown>> {
  if (placesReady) return placesReady;
  placesReady = new Promise((resolve, reject) => {
    const w = window as unknown as MapsWindow;
    const done = () => w.google!.maps!.importLibrary!('places').then((lib) => resolve(lib as Record<string, unknown>), reject);
    if (w.google?.maps?.importLibrary) return void done();
    const cb = '__tripTwinMapsReady';
    w[cb] = done;
    const s = document.createElement('script');
    s.src = mapsScriptUrl(GOOGLE_MAPS_BROWSER_KEY, cb);
    s.async = true;
    s.onerror = () => {
      placesReady = null; // allow a retry later
      reject(new Error('Maps JavaScript API failed to load'));
    };
    document.head.appendChild(s);
  });
  return placesReady;
}
