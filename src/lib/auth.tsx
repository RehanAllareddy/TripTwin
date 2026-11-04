import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User as FbUser,
} from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { auth } from './firebase';
import { isFirebaseConfigured } from './firebase-config';
import { useStore } from './store';

const GUEST_KEY = 'triptwin/guest';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'guest';

interface Auth {
  status: AuthStatus;
  /** The Firebase account, when signed in. */
  account: FbUser | null;
  configured: boolean;
  signInWithGooglePopup: () => Promise<void>;
  signInWithGoogleIdToken: (idToken: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
  continueAsGuest: () => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Auth | null>(null);

/** Turn Firebase error codes into sentences people understand. */
export function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': "That email address doesn't look right.",
    'auth/missing-password': 'Enter your password.',
    'auth/weak-password': 'Use at least 6 characters for your password.',
    'auth/email-already-in-use': 'An account already uses that email. Try signing in instead.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/user-not-found': 'No account with that email. Create one instead?',
    'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
    'auth/network-request-failed': 'No internet connection. Check your connection and try again.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before finishing.',
    'auth/cancelled-popup-request': 'Google sign-in was closed before finishing.',
    'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups and try again.',
    'auth/unauthorized-domain': "This website isn't on your Firebase project's list of authorized domains yet.",
    'auth/operation-not-allowed': 'This sign-in method is turned off in your Firebase project.',
    'auth/configuration-not-found': "Sign-in isn't set up in Firebase yet. Open Authentication in the Firebase console and click Get started.",
  };
  return map[code] ?? 'Something went wrong. Please try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { ready, signInAs, updateUser } = useStore();
  const [account, setAccount] = useState<FbUser | null>(null);
  const [authReady, setAuthReady] = useState(!auth);
  const [guest, setGuest] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(GUEST_KEY)
      .then((v) => setGuest(v === '1'))
      .catch(() => setGuest(false));
  }, []);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setAccount(u);
      setAuthReady(true);
    });
  }, []);

  // Once both the saved app data and the account are known, make this account the current traveler.
  useEffect(() => {
    if (ready && account)
      signInAs({ id: account.uid, name: account.displayName || account.email?.split('@')[0] || 'Traveler', email: account.email ?? undefined, photoURL: account.photoURL ?? undefined });
  }, [ready, account, signInAs]);

  const value = useMemo<Auth>(() => {
    const need = () => {
      if (!auth) throw Object.assign(new Error('Firebase not configured'), { code: 'app/not-configured' });
      return auth;
    };
    const leaveGuest = () => {
      setGuest(false);
      AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
    };
    const status: AuthStatus = !authReady || guest === null ? 'loading' : account ? 'signedIn' : guest ? 'guest' : 'signedOut';
    return {
      status,
      account,
      configured: isFirebaseConfigured,
      signInWithGooglePopup: async () => {
        await signInWithPopup(need(), new GoogleAuthProvider());
        leaveGuest();
      },
      signInWithGoogleIdToken: async (idToken) => {
        await signInWithCredential(need(), GoogleAuthProvider.credential(idToken));
        leaveGuest();
      },
      signInWithEmail: async (email, password) => {
        await signInWithEmailAndPassword(need(), email.trim(), password);
        leaveGuest();
      },
      signUpWithEmail: async (name, email, password) => {
        const cred = await createUserWithEmailAndPassword(need(), email.trim(), password);
        await updateProfile(cred.user, { displayName: name.trim() });
        // onAuthStateChanged fired before the name was set, so push it through now.
        signInAs({ id: cred.user.uid, name: name.trim(), email: cred.user.email ?? undefined });
        updateUser(cred.user.uid, { name: name.trim() });
        leaveGuest();
      },
      resetPassword: async (email) => {
        await sendPasswordResetEmail(need(), email.trim());
      },
      setDisplayName: async (name) => {
        if (auth?.currentUser) await updateProfile(auth.currentUser, { displayName: name });
      },
      continueAsGuest: () => {
        setGuest(true);
        AsyncStorage.setItem(GUEST_KEY, '1').catch(() => {});
      },
      signOut: async () => {
        leaveGuest();
        if (auth) await fbSignOut(auth);
      },
    };
  }, [account, authReady, guest, signInAs, updateUser]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const a = useContext(Ctx);
  if (!a) throw new Error('useAuth outside AuthProvider');
  return a;
}
