import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useLayoutEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Body, Button, Card, Expandable, Field, H2, Icon, PeoplePicker, Row, Screen, Segmented, Stepper, Sub, YesNo, styles } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { useTrip } from '@/lib/store';
import type { ItemKind, ItineraryItem } from '@/lib/types';
import { absStart, dayLabel, fmtTime, fromMin, KIND_ICON, money, toMin, uid } from '@/lib/util';

const KINDS: { value: ItemKind; label: string; icon: 'compass' }[] = [
  { value: 'activity', label: 'Activity', icon: 'compass' },
  { value: 'food', label: 'Food', icon: 'restaurant' as 'compass' },
  { value: 'flight', label: 'Flight', icon: 'airplane' as 'compass' },
  { value: 'transport', label: 'Ride', icon: 'car' as 'compass' },
  { value: 'lodging', label: 'Stay', icon: 'bed' as 'compass' },
];

/** Sensible starting values per type, so a new plan needs as few edits as possible. */
function newItem(kind: ItemKind, day: number, attendeeIds: string[], tripDays: number): ItineraryItem {
  const base: ItineraryItem = { id: uid(), title: '', kind, day, start: '10:00', durationMin: 120, cost: 0, costType: 'perPerson', attendeeIds, refundable: true, flexible: true };
  switch (kind) {
    case 'flight':
      return { ...base, start: '08:00', durationMin: 180, refundable: false, flexible: false, alternatives: 1 };
    case 'transport':
      return { ...base, start: '09:00', durationMin: 60, costType: 'group', alternatives: 1 };
    case 'lodging':
      return { ...base, day: 0, start: '15:00', durationMin: 60, costType: 'group', flexible: false, nights: Math.max(1, tripDays - 1) };
    case 'food':
      return { ...base, start: '19:00', durationMin: 90 };
    default:
      return base;
  }
}

const duration = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`);

export default function ItemEditor() {
  const { tripId, itemId, kind, day, title, location } = useLocalSearchParams<{ tripId: string; itemId?: string; kind?: ItemKind; day?: string; title?: string; location?: string }>();
  const { t, update, me, user, post } = useTrip(tripId);
  const nav = useNavigation();
  const existing = t?.items.find((i) => i.id === itemId);
  const [it, setIt] = useState<ItineraryItem>(() => existing ?? { ...newItem(kind ?? 'activity', Number(day) || 0, t?.memberIds ?? [], t?.days ?? 1), title: title ?? '', location: location || undefined });
  const [hasBackup, setHasBackup] = useState(!!existing?.backup);
  const [needsMin, setNeedsMin] = useState(!!existing?.minAttendees);
  const [costText, setCostText] = useState(existing?.cost ? String(existing.cost) : '');

  useLayoutEffect(() => nav.setOptions({ title: existing ? 'Edit plan' : 'Add to plan' }), [nav, existing]);
  if (!t) return null;

  const set = <K extends keyof ItineraryItem>(k: K, v: ItineraryItem[K]) => setIt((x) => ({ ...x, [k]: v }));
  const setKind = (k: ItemKind) => setIt((x) => (existing ? { ...x, kind: k } : { ...newItem(k, x.day, x.attendeeIds, t.days), id: x.id, title: x.title, cost: x.cost }));
  const isLodging = it.kind === 'lodging';
  const isTravel = it.kind === 'flight' || it.kind === 'transport';
  const canBeOutdoor = it.kind === 'activity' || it.kind === 'food';
  const earlier = t.items.filter((o) => o.id !== it.id && absStart(o) <= absStart(it));
  const n = Math.max(1, it.attendeeIds.length);

  const save = () => {
    const item: ItineraryItem = {
      ...it,
      title: it.title.trim(),
      outdoor: canBeOutdoor ? it.outdoor : false,
      backup: hasBackup && it.backup?.title?.trim() ? it.backup : undefined,
      minAttendees: needsMin ? it.minAttendees : undefined,
    };
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
      {/* 1. What */}
      <Card>
        <TextInput
          value={it.title}
          onChangeText={(v) => set('title', v)}
          placeholder={isLodging ? 'Where are you staying?' : "What's the plan?"}
          placeholderTextColor={C.faint}
          autoFocus={!existing}
          style={{ fontSize: 22, fontWeight: '700', color: C.text, paddingVertical: 4 }}
        />
        <Segmented options={KINDS} value={it.kind} onChange={setKind} />
      </Card>

      {/* 2. When */}
      <Card>
        <H2>When</H2>
        <Stepper label="Day" value={it.day} min={0} max={t.days - 1} onChange={(d) => set('day', d)} format={(d) => dayLabel(t, d)} />
        <Stepper label={isLodging ? 'Check-in' : 'Starts'} value={toMin(it.start)} step={30} min={0} max={23 * 60 + 30} onChange={(m) => set('start', fromMin(m))} format={(m) => fmtTime(fromMin(m))} />
        {isLodging ? (
          <Stepper label="Nights" value={it.nights ?? 1} min={1} max={t.days} onChange={(v) => set('nights', v)} />
        ) : (
          <Stepper label="Takes" value={it.durationMin} step={it.durationMin >= 120 ? 30 : 15} min={15} max={24 * 60} onChange={(v) => set('durationMin', v)} format={duration} />
        )}
      </Card>

      {/* 3. Cost */}
      <Card>
        <H2>Cost</H2>
        <Row>
          <Text style={{ fontSize: 22, fontWeight: '700', color: C.sub }}>$</Text>
          <TextInput
            value={costText}
            onChangeText={(v) => {
              const clean = v.replace(/[^0-9.]/g, '');
              setCostText(clean);
              set('cost', Number(clean) || 0);
            }}
            placeholder="0"
            placeholderTextColor={C.faint}
            keyboardType="decimal-pad"
            style={[styles.input, { flex: 1, fontSize: 20, fontWeight: '700' }]}
          />
        </Row>
        <Segmented
          options={[{ value: 'perPerson', label: 'Per person' }, { value: 'group', label: 'Shared price' }]}
          value={it.costType}
          onChange={(v) => set('costType', v)}
        />
        <Sub>
          {it.cost ? `Total ${money(it.cost)} · about ${money(it.cost / n)} each. ` : 'Leave at 0 if free. '}
          {it.costType === 'group' ? 'Shared prices (like a rental house) cost each person more if someone drops out.' : 'Tickets like this scale with the number of people.'}
        </Sub>
      </Card>

      {/* 4. Who */}
      <Card>
        <H2>Who's going</H2>
        <PeoplePicker ids={t.memberIds} selected={it.attendeeIds} onChange={(ids) => set('attendeeIds', ids)} userOf={user} />
      </Card>

      {/* Optional detail */}
      <Expandable title="Booking details" subtitle={it.bookingRef ? `Confirmation ${it.bookingRef}` : 'Optional: address and confirmation number'} icon="document-text">
        <Field label="Address or meeting point" placeholder="Optional" value={it.location ?? ''} onChangeText={(v) => set('location', v)} />
        <Field label="Confirmation number" placeholder="Optional" value={it.bookingRef ?? ''} onChangeText={(v) => set('bookingRef', v)} autoCapitalize="characters" />
      </Expandable>

      <Expandable title="Protect this plan" subtitle="A few quick questions so TripTwin can plan for surprises" icon="shield-checkmark">
        {canBeOutdoor && <YesNo question="Is it outdoors?" hint="Rain could ruin it." value={!!it.outdoor} onChange={(v) => set('outdoor', v)} />}
        <YesNo question="Can you get your money back if you cancel?" value={!!it.refundable} onChange={(v) => set('refundable', v)} />
        {!isLodging && <YesNo question="Could it happen at a different time?" hint="Flexible plans can be moved if something runs late." value={!!it.flexible} onChange={(v) => set('flexible', v)} />}
        {isTravel && (
          <Stepper label="Other routes or carriers you could switch to" value={it.alternatives ?? 0} max={5} onChange={(v) => set('alternatives', v)} />
        )}
        <YesNo question={isLodging ? 'Do you have a backup place to stay?' : 'Do you have a Plan B?'} value={hasBackup} onChange={setHasBackup} />
        {hasBackup && (
          <View style={{ gap: S.sm, paddingLeft: S.md, borderLeftWidth: 3, borderLeftColor: C.twinSoft }}>
            <Field label="Plan B" placeholder={isLodging ? 'Hotel near the station' : 'Museum visit'} value={it.backup?.title ?? ''} onChangeText={(v) => set('backup', { cost: 0, ...it.backup, title: v })} />
            <Field label="Plan B total cost ($)" placeholder="0" value={it.backup?.cost ? String(it.backup.cost) : ''} onChangeText={(v) => set('backup', { title: '', ...it.backup, cost: Number(v.replace(/[^0-9.]/g, '')) || 0 })} keyboardType="decimal-pad" />
            {isLodging ? (
              <Stepper label="Sleeps" value={it.backup?.capacity ?? n} min={1} max={30} onChange={(v) => set('backup', { title: '', cost: 0, ...it.backup, capacity: v })} />
            ) : (
              canBeOutdoor && <YesNo question="Is the Plan B indoors?" value={!!it.backup?.indoor} onChange={(v) => set('backup', { title: '', cost: 0, ...it.backup, indoor: v })} />
            )}
          </View>
        )}
        <YesNo question="Does the booking need a minimum number of people?" value={needsMin} onChange={(v) => { setNeedsMin(v); if (v && !it.minAttendees) set('minAttendees', Math.min(4, n)); }} />
        {needsMin && <Stepper label="At least" value={it.minAttendees ?? 2} min={2} max={t.memberIds.length} onChange={(v) => set('minAttendees', v)} format={(v) => `${v} people`} />}
        {earlier.length > 0 && (
          <View style={{ gap: 6 }}>
            <Body size={15}>Does it rely on an earlier booking?</Body>
            <Sub>e.g. a day trip that needs the rental car. Tap any that apply.</Sub>
            {earlier.map((o) => {
              const on = !!it.dependsOn?.includes(o.id);
              return (
                <Pressable key={o.id} onPress={() => set('dependsOn', on ? it.dependsOn!.filter((d) => d !== o.id) : [...(it.dependsOn ?? []), o.id])} style={[styles.row, { gap: S.sm, paddingVertical: 6 }]}>
                  <Icon name={on ? 'checkbox' : 'square-outline'} color={on ? C.twin : C.faint} size={20} />
                  <Icon name={KIND_ICON[o.kind] as 'car'} size={15} color={C.sub} />
                  <Body size={14}>{o.title}</Body>
                </Pressable>
              );
            })}
          </View>
        )}
      </Expandable>

      <Button title={existing ? 'Save changes' : 'Add to plan'} icon="checkmark" disabled={!it.title.trim() || !it.attendeeIds.length} onPress={save} />
      {existing && <Button title="Remove from plan" icon="trash" kind="danger" onPress={remove} />}
    </Screen>
  );
}
