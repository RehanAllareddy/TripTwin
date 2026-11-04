import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Avatar, Body, Button, Card, H2, Icon, Meter, Row, Screen, Stat, Sub } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { balances, settleUp, spent, spentByCategory } from '@/lib/budget';
import { useTrip } from '@/lib/store';
import { useTripId } from '@/lib/trip-id';
import { money, plannedCost, uid } from '@/lib/util';

const CATS = ['lodging', 'transport', 'food', 'activities', 'other'] as const;

export default function Budget() {
  const id = useTripId();
  const { t, update, me, user, post } = useTrip(id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  if (!t) return null;

  const planned = plannedCost(t);
  const paid = spent(t);
  const bal = balances(t);
  const transfers = settleUp(t);
  const byCat = spentByCategory(t);
  const myShare = t.items.reduce((s, i) => (i.attendeeIds.includes(me.id) ? s + i.cost / i.attendeeIds.length : s), 0);

  const markPaid = (fromId: string, toId: string, amount: number) => {
    update((x) => ({ ...x, expenses: [...x.expenses, { id: uid(), title: `Settle-up: ${user(fromId)?.name} → ${user(toId)?.name}`, amount, paidById: fromId, splitAmongIds: [toId], category: 'other', createdAt: Date.now() }] }));
    post(t.id, `💸 ${user(fromId)?.name} paid ${user(toId)?.name} ${money(amount)}.`, true);
  };

  return (
    <Screen>
      <Card>
        <Row>
          <Sub>GROUP BUDGET</Sub>
          <View style={{ flex: 1 }} />
          {!editing && <Sub onPress={() => { setDraft(String(t.budget)); setEditing(true); }}>Edit</Sub>}
        </Row>
        {editing ? (
          <Row>
            <TextInput value={draft} onChangeText={setDraft} keyboardType="number-pad" autoFocus style={{ flex: 1, fontSize: 26, fontWeight: '800', color: C.text, borderBottomWidth: 1, borderColor: C.line }} />
            <Button small title="Save" onPress={() => { update((x) => ({ ...x, budget: Number(draft) || 0 })); post(t.id, `${me.name} set the budget to ${money(Number(draft) || 0)}.`, true); setEditing(false); }} />
          </Row>
        ) : (
          <Body bold size={28}>{money(t.budget)}</Body>
        )}
        <Meter value={planned / Math.max(1, t.budget)} color={planned > t.budget ? C.high : C.primary} height={10} />
        <Row>
          <Stat label="planned" value={money(planned)} />
          <Stat label={planned > t.budget ? 'over' : 'left'} value={money(Math.abs(t.budget - planned))} color={planned > t.budget ? C.high : C.low} />
          <Stat label="your share" value={money(myShare)} color={C.primary} />
        </Row>
      </Card>

      <Card>
        <H2 right={<Sub>{money(paid)} paid so far</Sub>}>Spending</H2>
        {CATS.map((c) => (
          <View key={c} style={{ gap: 4 }}>
            <Row><Body size={14}>{c[0].toUpperCase() + c.slice(1)}</Body><View style={{ flex: 1 }} /><Body size={14} bold>{money(byCat[c] ?? 0)}</Body></Row>
            <Meter value={(byCat[c] ?? 0) / Math.max(1, paid)} color={C.primary} height={6} />
          </View>
        ))}
      </Card>

      <Card>
        <H2>Settle up</H2>
        {transfers.length === 0 && <Body color={C.low} bold>Everyone is even 🎉</Body>}
        {transfers.map((tr, i) => (
          <Row key={i} style={{ paddingVertical: 4 }}>
            <Avatar user={user(tr.fromId)} size={28} />
            <Icon name="arrow-forward" size={14} color={C.faint} />
            <Avatar user={user(tr.toId)} size={28} />
            <View style={{ flex: 1 }}>
              <Body size={14}>{user(tr.fromId)?.name} owes {user(tr.toId)?.name}</Body>
            </View>
            <Body bold>{money(tr.amount)}</Body>
            <Button small kind="ghost" title="Paid" onPress={() => markPaid(tr.fromId, tr.toId, tr.amount)} />
          </Row>
        ))}
        <Sub>Fewest possible payments to settle everyone up.</Sub>
      </Card>

      <Card>
        <H2>Balances</H2>
        {t.memberIds.map((m) => (
          <Row key={m}>
            <Avatar user={user(m)} size={26} />
            <Body size={14}>{user(m)?.name}</Body>
            <View style={{ flex: 1 }} />
            <Body bold size={14} color={(bal[m] ?? 0) >= 0 ? C.low : C.high}>{(bal[m] ?? 0) >= 0 ? 'gets back ' : 'owes '}{money(Math.abs(bal[m] ?? 0))}</Body>
          </Row>
        ))}
      </Card>

      <Button title="Add expense" icon="add" onPress={() => router.push({ pathname: '/expense', params: { tripId: t.id } })} />

      <Card>
        <H2>Expenses</H2>
        {[...t.expenses].reverse().map((e) => (
          <Row key={e.id} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.line }} gap={S.md}>
            <Avatar user={user(e.paidById)} size={28} />
            <View style={{ flex: 1 }}>
              <Body size={14}>{e.title}</Body>
              <Sub>{user(e.paidById)?.name} paid · split {e.splitAmongIds.length} ways</Sub>
            </View>
            <Body bold>{money(e.amount)}</Body>
          </Row>
        ))}
      </Card>
    </Screen>
  );
}
