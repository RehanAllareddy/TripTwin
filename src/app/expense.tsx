import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { Avatar, Button, Card, Chip, Field, H2, Row, Screen, Sub } from '@/components/ui';
import { S } from '@/constants/theme';
import { useTrip } from '@/lib/store';
import type { Expense } from '@/lib/types';
import { money, uid } from '@/lib/util';

const CATS: Expense['category'][] = ['food', 'activities', 'transport', 'lodging', 'other'];

export default function AddExpense() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { t, update, me, user, post } = useTrip(tripId);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Expense['category']>('food');
  const [paidById, setPaidById] = useState(me.id);
  const [split, setSplit] = useState<string[]>(t?.memberIds ?? []);
  if (!t) return null;
  const amt = Number(amount.replace(/[^0-9.]/g, '')) || 0;

  return (
    <Screen>
      <Card>
        <Field label="What for?" placeholder="Groceries" value={title} onChangeText={setTitle} />
        <Field label="Amount ($)" placeholder="0" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Row style={{ flexWrap: 'wrap' }}>
          {CATS.map((c) => <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />)}
        </Row>
      </Card>
      <Card>
        <H2>Paid by</H2>
        <Row style={{ flexWrap: 'wrap' }} gap={S.md}>
          {t.memberIds.map((m) => (
            <Pressable key={m} onPress={() => setPaidById(m)} style={{ alignItems: 'center', opacity: paidById === m ? 1 : 0.3 }}>
              <Avatar user={user(m)} size={38} />
              <Sub>{user(m)?.name}</Sub>
            </Pressable>
          ))}
        </Row>
      </Card>
      <Card>
        <H2>Split between</H2>
        <Row style={{ flexWrap: 'wrap' }} gap={S.md}>
          {t.memberIds.map((m) => (
            <Pressable key={m} onPress={() => setSplit((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]))} style={{ alignItems: 'center', opacity: split.includes(m) ? 1 : 0.3 }}>
              <Avatar user={user(m)} size={38} />
              <Sub>{user(m)?.name}</Sub>
            </Pressable>
          ))}
        </Row>
        {split.length > 0 && amt > 0 && <Sub>{money(amt / split.length)} each</Sub>}
      </Card>
      <Button
        title="Add expense"
        icon="checkmark"
        disabled={!title.trim() || !amt || !split.length}
        onPress={() => {
          update((x) => ({ ...x, expenses: [...x.expenses, { id: uid(), title: title.trim(), amount: amt, paidById, splitAmongIds: split, category, createdAt: Date.now() }] }));
          post(t.id, `🧾 ${user(paidById)?.name} paid ${money(amt)} for ${title.trim()}.`, true);
          router.back();
        }}
      />
    </Screen>
  );
}
