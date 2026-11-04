import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput } from 'react-native';

import { Avatar, Button, Card, Field, H2, PeoplePicker, Row, Screen, Segmented, Sub, styles } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { useTrip } from '@/lib/store';
import type { Expense } from '@/lib/types';
import { money, uid } from '@/lib/util';

const CATS: { value: Expense['category']; label: string; icon: 'restaurant' }[] = [
  { value: 'food', label: 'Food', icon: 'restaurant' },
  { value: 'activities', label: 'Fun', icon: 'ticket' as 'restaurant' },
  { value: 'transport', label: 'Travel', icon: 'car' as 'restaurant' },
  { value: 'lodging', label: 'Stay', icon: 'bed' as 'restaurant' },
  { value: 'other', label: 'Other', icon: 'pricetag' as 'restaurant' },
];

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
        <Row>
          <Text style={{ fontSize: 28, fontWeight: '800', color: C.sub }}>$</Text>
          <TextInput value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor={C.faint} keyboardType="decimal-pad" autoFocus style={[styles.input, { flex: 1, fontSize: 26, fontWeight: '800', borderWidth: 0 }]} />
        </Row>
        <Field label="What was it for?" placeholder="Groceries" value={title} onChangeText={setTitle} />
        <Segmented options={CATS} value={category} onChange={setCategory} />
      </Card>
      <Card>
        <H2>Who paid?</H2>
        <Row style={{ flexWrap: 'wrap' }} gap={S.md}>
          {t.memberIds.map((m) => (
            <Pressable key={m} onPress={() => setPaidById(m)} accessibilityRole="radio" accessibilityState={{ selected: paidById === m }} style={{ alignItems: 'center', opacity: paidById === m ? 1 : 0.3 }}>
              <Avatar user={user(m)} size={40} />
              <Sub>{m === me.id ? 'Me' : user(m)?.name}</Sub>
            </Pressable>
          ))}
        </Row>
      </Card>
      <Card>
        <H2>Split between</H2>
        <PeoplePicker ids={t.memberIds} selected={split} onChange={setSplit} userOf={user} />
        {split.length > 0 && amt > 0 && <Sub>{money(amt / split.length)} each</Sub>}
      </Card>
      <Button
        title={amt ? `Add ${money(amt)}` : 'Add expense'}
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
