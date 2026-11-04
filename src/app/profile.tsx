import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';

import { Avatar, Body, Button, Card, Expandable, Field, H2, Icon, Row, Screen, Sub } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { SEED_USERS } from '@/lib/seed';
import { useStore } from '@/lib/store';

const COLORS = ['#6366F1', '#0EA5A4', '#F97316', '#EF4444', '#EAB308', '#A855F7', '#0EA5E9', '#22C55E'];

function confirm(title: string, body: string, ok: string, run: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${body}`)) run();
    return;
  }
  Alert.alert(title, body, [{ text: 'Cancel', style: 'cancel' }, { text: ok, style: 'destructive', onPress: run }]);
}

export default function Profile() {
  const { me, state, updateUser, switchUser, resetDemo } = useStore();
  const { status, account, setDisplayName, signOut } = useAuth();
  const [name, setName] = useState(me.name);
  const [saved, setSaved] = useState(false);
  const trips = state.trips.filter((t) => t.memberIds.includes(me.id)).length;
  const provider = account?.providerData[0]?.providerId === 'google.com' ? 'Google' : 'email';
  const nameChanged = name.trim() !== me.name && name.trim().length > 0;
  const isGuest = status === 'guest';

  const saveName = async () => {
    updateUser(me.id, { name: name.trim() });
    await setDisplayName(name.trim()).catch(() => {});
    setSaved(true);
  };

  const leave = () =>
    confirm(isGuest ? 'Leave the demo?' : 'Sign out?', isGuest ? 'You can sign in or create an account next.' : 'Your trips stay saved on this device.', isGuest ? 'Leave' : 'Sign out', async () => {
      await signOut();
      router.replace('/login');
    });

  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: S.sm }}>
        <Avatar user={{ ...me, name: name || me.name }} size={88} />
        <Body bold size={22}>{me.name}</Body>
        <Sub>{isGuest ? 'Demo mode · not signed in' : `${account?.email ?? ''} · signed in with ${provider}`}</Sub>
        <Sub>{trips} trip{trips === 1 ? '' : 's'}</Sub>
      </Card>

      <Card>
        <H2>Your profile</H2>
        <Field label="Name the group sees" value={name} onChangeText={(v) => { setName(v); setSaved(false); }} autoComplete="name" />
        {nameChanged && <Button small title="Save name" icon="checkmark" onPress={saveName} />}
        {saved && !nameChanged && <Body size={14} color={C.low}>Saved ✓</Body>}

        {!me.photoURL && (
          <>
            <Sub>Avatar color</Sub>
            <Row style={{ flexWrap: 'wrap' }} gap={S.md}>
              {COLORS.map((c) => (
                <Pressable key={c} onPress={() => updateUser(me.id, { color: c })} accessibilityLabel={`Color ${c}`} accessibilityState={{ selected: me.color === c }}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, alignItems: 'center', justifyContent: 'center', borderWidth: me.color === c ? 3 : 0, borderColor: C.text }}>
                  {me.color === c && <Icon name="checkmark" color="#fff" size={18} />}
                </Pressable>
              ))}
            </Row>
          </>
        )}
        {!!me.photoURL && <Sub>Your photo comes from your Google account.</Sub>}
      </Card>

      {isGuest && (
        <Card style={{ backgroundColor: C.primarySoft }}>
          <Body bold>Save your trips to an account</Body>
          <Sub>Sign in with Google or email so your group can find you.</Sub>
          <Button title="Sign in or create account" icon="log-in" onPress={leave} />
        </Card>
      )}

      <Expandable title="Demo tools" subtitle="For presentations: act as another traveler" icon="people">
        <Sub>See the trip from a friend's point of view. Messages, votes and expenses are recorded as them until you switch back.</Sub>
        {[...state.users.filter((u) => u.id === account?.uid), ...SEED_USERS].map((u) => {
          const user = state.users.find((x) => x.id === u.id) ?? u;
          return (
            <Pressable key={user.id} onPress={() => { switchUser(user.id); router.back(); }}>
              <Row style={{ paddingVertical: 6 }}>
                <Avatar user={user} />
                <View style={{ flex: 1 }}>
                  <Body bold={user.id === me.id}>{user.name}{user.id === account?.uid ? ' (you)' : ''}</Body>
                </View>
                {user.id === me.id && <Icon name="checkmark-circle" color={C.primary} />}
              </Row>
            </Pressable>
          );
        })}
        <Button small kind="ghost" title="Reset the sample trip" icon="refresh" onPress={() => confirm('Reset the sample trip?', 'Restores the Lisbon demo to how it started.', 'Reset', resetDemo)} />
      </Expandable>

      <Button title={isGuest ? 'Leave demo' : 'Sign out'} icon="log-out" kind="danger" onPress={leave} />
    </Screen>
  );
}
