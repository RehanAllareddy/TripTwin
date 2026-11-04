import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { Avatar, Body, Button, Card, Field, Icon, Row, Screen, Sub } from '@/components/ui';
import { C } from '@/constants/theme';
import { useStore } from '@/lib/store';

/** Lets one device act as any traveler, so a whole group's collaboration can be demoed. */
export default function Profile() {
  const { state, me, switchUser, addUser } = useStore();
  const [name, setName] = useState('');

  return (
    <Screen>
      <Sub>Pick who is using the app. Every message, vote, expense and simulation is recorded under this traveler.</Sub>
      <Card>
        {state.users.map((u) => (
          <Pressable key={u.id} onPress={() => { switchUser(u.id); router.back(); }}>
            <Row style={{ paddingVertical: 6 }}>
              <Avatar user={u} />
              <Body bold={u.id === me.id}>{u.name}</Body>
              <Row style={{ flex: 1, justifyContent: 'flex-end' }}>{u.id === me.id && <Icon name="checkmark-circle" color={C.primary} />}</Row>
            </Row>
          </Pressable>
        ))}
      </Card>
      <Card>
        <Field label="New traveler" placeholder="Your name" value={name} onChangeText={setName} />
        <Button title="Create & switch" icon="person-add" disabled={!name.trim()} onPress={() => { addUser(name.trim()); router.back(); }} />
      </Card>
    </Screen>
  );
}
