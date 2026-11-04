import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Field, Screen, Stepper, Sub } from '@/components/ui';
import { money } from '@/lib/util';
import { useStore } from '@/lib/store';

export default function NewTrip() {
  const { createTrip } = useStore();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
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
          const id = createTrip({ name: name.trim(), destination: destination.trim(), startDate, days, budget });
          router.replace(`/trip/${id}`);
        }}
      />
    </Screen>
  );
}
