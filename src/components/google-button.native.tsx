import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { GoogleLook } from './google-button';
import { friendlyAuthError, useAuth } from '@/lib/auth';
import { googleClientIds } from '@/lib/firebase-config';

WebBrowser.maybeCompleteAuthSession();

/** iOS / Android: sign in with Google in a browser sheet, then hand the token to Firebase. */
export function GoogleButton({ onError }: { onError: (msg: string) => void }) {
  const { signInWithGoogleIdToken, configured } = useAuth();
  const [busy, setBusy] = useState(false);
  const platformId = Platform.OS === 'ios' ? googleClientIds.ios : googleClientIds.android;
  // The hook requires an id for this platform even when unconfigured; the button is disabled in that case.
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: googleClientIds.web || 'unset',
    iosClientId: googleClientIds.ios || 'unset',
    androidClientId: googleClientIds.android || 'unset',
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.params.id_token;
    signInWithGoogleIdToken(idToken)
      .catch((e) => onError(friendlyAuthError(e)))
      .finally(() => setBusy(false));
  }, [response, signInWithGoogleIdToken, onError]);

  return (
    <GoogleLook
      busy={busy}
      disabled={!configured || !request}
      onPress={() => {
        if (!platformId) return onError('Google sign-in in the phone app needs an OAuth client ID in firebase-config.ts. Use email for now, or open the website.');
        onError('');
        setBusy(true);
        promptAsync()
          .then((r) => r.type !== 'success' && setBusy(false))
          .catch(() => setBusy(false));
      }}
    />
  );
}
