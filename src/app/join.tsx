import { router } from 'expo-router';
import { useState } from 'react';

import { Body, Button, Card, Field, Screen, Sub } from '@/components/ui';
import { C } from '@/constants/theme';
import { useStore } from '@/lib/store';

export default function Join() {
  const { joinTrip, me } = useStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  return (
    <Screen>
      <Card>
        <Field label="Join code" placeholder="e.g. LIS27X" value={code} onChangeText={(v) => { setCode(v.toUpperCase()); setError(''); }} autoCapitalize="characters" maxLength={6} />
        {!!error && <Body color={C.high}>{error}</Body>}
        <Button
          title={`Join as ${me.name}`}
          icon="enter"
          disabled={code.length < 6}
          onPress={() => {
            const id = joinTrip(code);
            if (!id) return setError('No trip found with that code.');
            router.replace(`/trip/${id}`);
          }}
        />
      </Card>
      <Sub>Ask the trip organizer for the code. It's on their trip's Group tab. Tip: try LIS27X after switching to a new traveler.</Sub>
    </Screen>
  );
}
