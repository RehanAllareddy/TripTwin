import { Platform } from 'react-native';

/**
 * Explore configuration, read from environment variables (see .env.example).
 * EXPO_PUBLIC_* values are inlined into the app at build time, so only put
 * browser-safe, restricted keys here. The server key is never referenced from app code.
 */

/** Browser key: Maps JavaScript API (Places UI Kit) + Maps Embed API. Restrict by HTTP referrer. */
export const GOOGLE_MAPS_BROWSER_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? '';

/**
 * The deployed website, e.g. https://triptwin.vercel.app.
 * The phone app uses it to reach /api endpoints and as the page origin for embedded Google content
 * (so the referrer-restricted browser key works inside WebViews).
 */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');

/**
 * Base URL for TripTwin's own API: same origin on the web, the deployed site on phones.
 * EXPO_PUBLIC_API_BASE_URL can point local development at a deployed API (Expo's dev server doesn't run /api).
 */
export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '') || (Platform.OS === 'web' ? '' : SITE_URL);

export const hasBrowserKey = GOOGLE_MAPS_BROWSER_KEY.length > 0;
