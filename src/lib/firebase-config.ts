/**
 * Paste your Firebase web app config here.
 * Firebase console → Project settings → General → Your apps → Web app → "SDK setup and configuration" → Config.
 *
 * These values are safe to ship in the app (they identify your project; they are not secrets).
 * Access is controlled by Firebase Authentication + "Authorized domains".
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyC_UEl814QMM6UTWJtcEqQYtXPU1yQAJwI',
  authDomain: 'triptwin-d0097.firebaseapp.com',
  projectId: 'triptwin-d0097',
  storageBucket: 'triptwin-d0097.firebasestorage.app',
  messagingSenderId: '320918245400',
  appId: '1:320918245400:web:64cbb458d5c3668be5f36d',
  measurementId: 'G-N29FYXJ5HF',
};

/**
 * Only needed for "Continue with Google" inside the iOS / Android app (the website works without these).
 * Google Cloud console → APIs & Services → Credentials → OAuth 2.0 Client IDs.
 * The web client ID is the one Firebase created automatically ("Web client (auto created by Google Service)").
 */
export const googleClientIds = {
  web: '',
  ios: '',
  android: '',
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.appId);
