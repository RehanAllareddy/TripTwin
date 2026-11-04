import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
// @ts-expect-error -- exported by the React Native build of firebase/auth, missing from its web typings.
import { getReactNativePersistence } from 'firebase/auth';

import { firebaseConfig, isFirebaseConfigured } from './firebase-config';

/** iOS / Android: keep people signed in between app launches via AsyncStorage. */
function create(): Auth | null {
  if (!isFirebaseConfigured) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    return getAuth(app); // already initialized (fast refresh)
  }
}

export const auth = create();
