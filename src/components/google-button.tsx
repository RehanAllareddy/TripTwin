import { useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { Icon } from '@/components/ui';
import { C, R } from '@/constants/theme';
import { friendlyAuthError, useAuth } from '@/lib/auth';

/** Web: Firebase opens Google's sign-in popup. */
export function GoogleButton({ onError }: { onError: (msg: string) => void }) {
  const { signInWithGooglePopup, configured } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <GoogleLook
      busy={busy}
      disabled={!configured}
      onPress={async () => {
        setBusy(true);
        onError('');
        try {
          await signInWithGooglePopup();
        } catch (e) {
          onError(friendlyAuthError(e));
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

export function GoogleLook({ onPress, busy, disabled }: { onPress: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: R.md, paddingVertical: 14, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}>
      {busy ? <ActivityIndicator color={C.text} /> : <Icon name="logo-google" size={20} color="#4285F4" />}
      <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>Continue with Google</Text>
    </Pressable>
  );
}
