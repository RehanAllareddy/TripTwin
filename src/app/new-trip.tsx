import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Field, Screen, Stepper, Sub } from '@/components/ui';
import { money } from '@/lib/util';
import { useStore } from '@/lib/store';

export default function NewTrip() {
  const { createTrip } = useStore();
  // Explore can pre-fill the destination (and its globe position) via params.
  const p = useLocalSearchParams<{ destination?: string; lat?: string; lng?: string }>();
  const coords = p.lat && p.lng && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) ? { lat: Number(p.lat), lng: Number(p.lng) } : undefined;
  const [name, setName] = useState(() => (p.destination ? `Trip to ${p.destination.split(',')[0]}` : ''));
  const [destination, setDestination] = useState(p.destination ?? '');
  const [startDate, setStartDate] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [days, setDays] = useState(4);
  const [budget, setBudget] = useState(3000);

  const valid = name.trim() && destination.trim() && /^\d{4}-\d{2}-\d{2}$/.test(startDate) && days > 0;

  return (
    <Screen>
      <Card>
        <Field label="Trip name" placeholder="Summer reunion" value={name} onChangeText={setName} />
        <Field label="Destination" placeholder="San Diego, CA" value={destination} onChangeText={setDestination} />
        <Field label="First day (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} autoCapitalize="none" />
        <Stepper label="How many days?" value={days} min={1} max={30} onChange={setDays} />
        <Stepper label="Group budget" value={budget} step={250} min={0} max={100000} onChange={setBudget} format={money} />
      </Card>
      <Sub>You'll get a 6-character join code to share with your group.</Sub>
      <Button
        title="Create trip"
        icon="checkmark"
        disabled={!valid}
        onPress={() => {
          const id = createTrip({ name: name.trim(), destination: destination.trim(), startDate, days, budget, coords });
          router.replace(`/trip/${id}`);
        }}
      />
    </Screen>
  );
}
