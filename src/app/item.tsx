import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, Body, Button, Card, Chip, Field, H2, Row, Screen, Sub, Toggle } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { useTrip } from '@/lib/store';
import type { ItemKind, ItineraryItem } from '@/lib/types';
import { uid } from '@/lib/util';

const KINDS: { k: ItemKind; label: string }[] = [
  { k: 'activity', label: 'Activity' },
  { k: 'food', label: 'Food' },
  { k: 'flight', label: 'Flight' },
  { k: 'transport', label: 'Transport' },
  { k: 'lodging', label: 'Lodging' },
];

export default function ItemEditor() {
  const { tripId, itemId } = useLocalSearchParams<{ tripId: string; itemId?: string }>();
  const { t, update, me, user, post } = useTrip(tripId);
  const nav = useNavigation();
  const existing = t?.items.find((i) => i.id === itemId);
  const [it, setIt] = useState<ItineraryItem>(
    existing ?? { id: uid(), title: '', kind: 'activity', day: 0, start: '10:00', durationMin: 120, cost: 0, costType: 'perPerson', attendeeIds: t?.memberIds ?? [], refundable: true, flexible: true },
  );
  const [hasBackup, setHasBackup] = useState(!!existing?.backup);

  useLayoutEffect(() => nav.setOptions({ title: existing ? 'Edit plan' : 'Add to plan' }), [nav, existing]);
  if (!t) return null;

  const set = <K extends keyof ItineraryItem>(k: K, v: ItineraryItem[K]) => setIt((x) => ({ ...x, [k]: v }));
  const num = (s: string) => Number(s.replace(/[^0-9.]/g, '')) || 0;
  const toggleIn = (arr: string[] = [], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const timeOk = /^([01]\d|2[0-3]):[0-5]\d$/.test(it.start);

  const save = () => {
    const item: ItineraryItem = { ...it, title: it.title.trim(), backup: hasBackup && it.backup?.title ? it.backup : undefined };
    update((x) => ({ ...x, items: existing ? x.items.map((i) => (i.id === item.id ? item : i)) : [...x.items, item] }));
    if (!existing) post(t.id, `${me.name} added "${item.title}" to day ${item.day + 1}.`, true);
    router.back();
  };

  const remove = () => {
    update((x) => ({ ...x, items: x.items.filter((i) => i.id !== it.id).map((i) => ({ ...i, dependsOn: i.dependsOn?.filter((d) => d !== it.id) })) }));
    post(t.id, `${me.name} removed "${it.title}" from the plan.`, true);
    router.back();
  };

  return (
    <Screen>
      <Card>
        <Field label="What is it?" placeholder="Kayak tour" value={it.title} onChangeText={(v) => set('title', v)} />
        <Row style={{ flexWrap: 'wrap' }}>
          {KINDS.map((k) => <Chip key={k.k} label={k.label} active={it.kind === k.k} onPress={() => set('kind', k.k)} />)}
        </Row>
        <Sub>Day</Sub>
        <Row style={{ flexWrap: 'wrap' }}>
          {Array.from({ length: t.days }, (_, d) => <Chip key={d} label={`${d + 1}`} active={it.day === d} onPress={() => set('day', d)} />)}
        </Row>
        <Row gap={S.md}>
          <View style={{ flex: 1 }}><Field label="Start (HH:MM)" value={it.start} onChangeText={(v) => set('start', v)} /></View>
          <View style={{ flex: 1 }}><Field label="Length (min)" value={String(it.durationMin)} onChangeText={(v) => set('durationMin', num(v))} keyboardType="number-pad" /></View>
        </Row>
        {!timeOk && <Body color={C.high} size={13}>Use 24-hour time like 09:30.</Body>}
        {it.kind === 'lodging' && <Field label="Nights" value={String(it.nights ?? 1)} onChangeText={(v) => set('nights', Math.max(1, num(v)))} keyboardType="number-pad" />}
        <Field label="Location" placeholder="Optional" value={it.location ?? ''} onChangeText={(v) => set('location', v)} />
        <Field label="Confirmation / booking #" placeholder="Optional" value={it.bookingRef ?? ''} onChangeText={(v) => set('bookingRef', v)} autoCapitalize="characters" />
      </Card>

      <Card>
        <H2>Cost</H2>
        <Field label="Total cost for the group ($)" value={String(it.cost)} onChangeText={(v) => set('cost', num(v))} keyboardType="decimal-pad" />
        <Row>
          <Chip label="Per person" active={it.costType === 'perPerson'} onPress={() => set('costType', 'perPerson')} />
          <Chip label="Fixed group price" active={it.costType === 'group'} onPress={() => set('costType', 'group')} />
        </Row>
        <Sub>{it.costType === 'group' ? 'Shares rise if people drop out (e.g. a rental house).' : 'Cost scales with headcount (e.g. tickets).'}</Sub>
      </Card>

      <Card>
        <H2>Who's going</H2>
        <Row style={{ flexWrap: 'wrap' }} gap={S.md}>
          {t.memberIds.map((m) => (
            <Pressable key={m} onPress={() => set('attendeeIds', toggleIn(it.attendeeIds, m))} style={{ alignItems: 'center', opacity: it.attendeeIds.includes(m) ? 1 : 0.3 }}>
              <Avatar user={user(m)} size={38} />
              <Sub>{user(m)?.name}</Sub>
            </Pressable>
          ))}
        </Row>
        <Field label="Minimum group size required (optional)" value={it.minAttendees ? String(it.minAttendees) : ''} onChangeText={(v) => set('minAttendees', num(v) || undefined)} keyboardType="number-pad" />
      </Card>

      <Card style={{ borderWidth: 1.5, borderColor: C.twinSoft }}>
        <H2>Twin settings</H2>
        <Sub>These tell the simulator how this plan reacts to disruptions.</Sub>
        <Toggle label="Outdoor" hint="Affected by rain" value={!!it.outdoor} onChange={(v) => set('outdoor', v)} />
        <Toggle label="Refundable" hint="Can be cancelled for money back" value={!!it.refundable} onChange={(v) => set('refundable', v)} />
        <Toggle label="Flexible time" hint="Can move to another slot" value={!!it.flexible} onChange={(v) => set('flexible', v)} />
        {(it.kind === 'flight' || it.kind === 'transport') && (
          <Field label="Alternative routes / carriers saved" value={String(it.alternatives ?? 0)} onChangeText={(v) => set('alternatives', num(v))} keyboardType="number-pad" />
        )}
        <Sub>Depends on (must happen first)</Sub>
        <Row style={{ flexWrap: 'wrap' }}>
          {t.items.filter((o) => o.id !== it.id).map((o) => (
            <Chip key={o.id} label={o.title} active={!!it.dependsOn?.includes(o.id)} color={C.twin} onPress={() => set('dependsOn', toggleIn(it.dependsOn, o.id))} />
          ))}
        </Row>
        <Toggle label="Has a Plan B" hint={it.kind === 'lodging' ? 'Backup place to stay' : 'Backup activity or option'} value={hasBackup} onChange={setHasBackup} />
        {hasBackup && (
          <View style={{ gap: S.sm }}>
            <Field label="Backup name" value={it.backup?.title ?? ''} onChangeText={(v) => set('backup', { cost: 0, ...it.backup, title: v })} />
            <Field label="Backup cost ($)" value={String(it.backup?.cost ?? 0)} onChangeText={(v) => set('backup', { title: '', ...it.backup, cost: num(v) })} keyboardType="decimal-pad" />
            {it.kind === 'lodging' ? (
              <Field label="Backup fits how many?" value={String(it.backup?.capacity ?? '')} onChangeText={(v) => set('backup', { title: '', cost: 0, ...it.backup, capacity: num(v) })} keyboardType="number-pad" />
            ) : (
              <Toggle label="Backup is indoors" value={!!it.backup?.indoor} onChange={(v) => set('backup', { title: '', cost: 0, ...it.backup, indoor: v })} />
            )}
          </View>
        )}
      </Card>

      <Button title={existing ? 'Save changes' : 'Add to plan'} icon="checkmark" disabled={!it.title.trim() || !timeOk || !it.attendeeIds.length} onPress={save} />
      {existing && <Button title="Remove from plan" icon="trash" kind="danger" onPress={remove} />}
    </Screen>
  );
}
