import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

import { firebaseConfig, isFirebaseConfigured } from './firebase-config';

/** Web: the browser keeps the session in IndexedDB automatically. */
export const auth: Auth | null = isFirebaseConfigured ? getAuth(getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;
