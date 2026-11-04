import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleButton } from '@/components/google-button';
import { Body, Button, Card, Field, Icon, Row, Screen, Segmented, Sub } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { friendlyAuthError, useAuth } from '@/lib/auth';

type Mode = 'signIn' | 'signUp';

export default function Login() {
  const insets = useSafeAreaInsets();
  const { configured, signInWithEmail, signUpWithEmail, resetPassword, continueAsGuest } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const onError = useCallback((m: string) => setError(m), []);

  const valid = /\S+@\S+\.\S+/.test(email) && password.length >= 6 && (mode === 'signIn' || name.trim().length > 0);

  const submit = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'signIn') await signInWithEmail(email, password);
      else await signUpWithEmail(name, email, password);
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError('');
    if (!/\S+@\S+\.\S+/.test(email)) return setError('Type your email above first, then tap "Forgot password?".');
    try {
      await resetPassword(email);
      setNotice(`We sent a reset link to ${email.trim()}.`);
    } catch (e) {
      setError(friendlyAuthError(e));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ alignItems: 'center', gap: S.sm, marginTop: S.xl, marginBottom: S.md }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.twin, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="git-compare" size={32} color="#fff" />
          </View>
          <Text style={{ fontSize: 34, fontWeight: '900', color: C.text, letterSpacing: -0.8 }}>
            Trip<Text style={{ color: C.twin }}>Twin</Text>
          </Text>
          <Sub>Plan together. Test it before you take it.</Sub>
        </View>

        {!configured && (
          <Card style={{ backgroundColor: C.medSoft }}>
            <Row><Icon name="construct" color={C.med} /><Body bold color={C.med}>Sign-in isn't connected yet</Body></Row>
            <Sub>Add your Firebase config to src/lib/firebase-config.ts. You can still try the demo below.</Sub>
          </Card>
        )}

        <Card style={{ gap: S.md }}>
          <GoogleButton onError={onError} />

          <Row>
            <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
            <Sub>or use email</Sub>
            <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
          </Row>

          <Segmented
            options={[{ value: 'signIn', label: 'Sign in' }, { value: 'signUp', label: 'Create account' }]}
            value={mode}
            onChange={(m) => { setMode(m); setError(''); setNotice(''); }}
          />
          {mode === 'signUp' && <Field label="Your name" placeholder="Maya Patel" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />}
          <Field label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
          <Field
            label={mode === 'signUp' ? 'Password (at least 6 characters)' : 'Password'}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
            onSubmitEditing={() => valid && submit()}
          />
          {!!error && (
            <Row style={{ alignItems: 'flex-start' }}>
              <Icon name="alert-circle" color={C.high} />
              <View style={{ flex: 1 }}><Body size={14} color={C.high}>{error}</Body></View>
            </Row>
          )}
          {!!notice && <Body size={14} color={C.low}>{notice}</Body>}
          {busy ? (
            <ActivityIndicator color={C.primary} style={{ paddingVertical: 12 }} />
          ) : (
            <Button title={mode === 'signIn' ? 'Sign in' : 'Create account'} disabled={!valid || !configured} onPress={submit} />
          )}
          {mode === 'signIn' && (
            <Pressable onPress={forgot} style={{ alignSelf: 'center' }}>
              <Sub onPress={forgot}>Forgot password?</Sub>
            </Pressable>
          )}
        </Card>

        <Pressable onPress={continueAsGuest} style={{ alignSelf: 'center', padding: S.md }} accessibilityRole="button">
          <Body size={14} color={C.sub}>Just looking? <Body size={14} bold color={C.primary}>Try the demo without an account</Body></Body>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}
