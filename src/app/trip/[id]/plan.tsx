import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AvatarStack, Body, Button, Card, centered, Chip, H2, Icon, OptionCard, Row, Screen, Segmented, Sub, Tag, type IconName } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { useTrip } from '@/lib/store';
import { useTripId } from '@/lib/trip-id';
import type { ItineraryItem } from '@/lib/types';
import { absEnd, absStart, dayLabel, fmtTime, KIND_ICON, money, sortItems } from '@/lib/util';

/** The single most important thing to know about a plan, or nothing if it's fine. */
function status(i: ItineraryItem, conflict: boolean) {
  if (conflict) return { label: 'Overlaps another plan', color: C.high, bg: C.highSoft };
  if (i.outdoor && !i.backup) return { label: 'No rain plan', color: C.med, bg: C.medSoft };
  if (!i.refundable && i.cost > 0) return { label: 'Non-refundable', color: C.sub, bg: C.line };
  if (i.backup) return { label: 'Has Plan B', color: C.low, bg: C.lowSoft };
  return null;
}

const QUICK_ADD: { kind: ItineraryItem['kind']; title: string; hint: string; icon: IconName }[] = [
  { kind: 'flight', title: 'A flight', hint: 'How you get there and back', icon: 'airplane' },
  { kind: 'lodging', title: 'Where you’re staying', hint: 'Hotel, rental or a friend’s place', icon: 'bed' },
  { kind: 'activity', title: 'Something to do', hint: 'A tour, show, hike or museum', icon: 'compass' },
  { kind: 'food', title: 'A meal', hint: 'Reservations or a must-try spot', icon: 'restaurant' },
];

export default function Plan() {
  const id = useTripId();
  const { t, me, user } = useTrip(id);
  const [day, setDay] = useState<number | 'all' | 'bookings'>('all');
  const [mine, setMine] = useState(false);
  if (!t) return null;

  const visible = sortItems(t.items).filter((i) => !mine || i.attendeeIds.includes(me.id));
  const days = Array.from({ length: t.days }, (_, d) => d).filter((d) => day === 'all' || day === d);
  const open = (item?: ItineraryItem) => router.push({ pathname: '/item', params: { tripId: t.id, ...(item ? { itemId: item.id } : {}) } });

  // Items that overlap for a shared attendee — surfaced as schedule conflicts.
  const conflicts = new Set<string>();
  const timed = visible.filter((i) => i.kind !== 'lodging');
  for (const a of timed)
    for (const b of timed)
      if (a.id < b.id && absStart(a) < absEnd(b) && absStart(b) < absEnd(a) && a.attendeeIds.some((x) => b.attendeeIds.includes(x))) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }

  return (
    <View style={{ flex: 1 }}>
      <View style={[centered, { padding: S.lg, paddingBottom: 0, gap: S.sm }]}>
        <Segmented
          options={[{ value: 'schedule', label: 'Schedule', icon: 'calendar-outline' }, { value: 'bookings', label: 'Confirmations', icon: 'document-text-outline' }]}
          value={day === 'bookings' ? 'bookings' : 'schedule'}
          onChange={(v) => setDay(v === 'bookings' ? 'bookings' : 'all')}
        />
      </View>
      {day !== 'bookings' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[centered, { flexGrow: 0 }]} contentContainerStyle={{ gap: S.sm, paddingHorizontal: S.lg, paddingTop: S.sm }}>
          <Chip label="All days" active={day === 'all'} onPress={() => setDay('all')} />
          {Array.from({ length: t.days }, (_, d) => (
            <Chip key={d} label={`Day ${d + 1}`} active={day === d} onPress={() => setDay(d)} />
          ))}
          <Chip label={mine ? 'Just me ✓' : 'Just me'} icon="person" active={mine} color={C.twin} onPress={() => setMine(!mine)} />
        </ScrollView>
      )}
      <Screen>
        {t.items.length === 0 ? (
          <Card style={{ gap: S.md }}>
            <Body bold size={18}>Start your plan</Body>
            <Sub>What do you already know about this trip? Pick one and we'll fill in the details.</Sub>
            {QUICK_ADD.map((q) => (
              <OptionCard key={q.kind} icon={q.icon} title={q.title} subtitle={q.hint} onPress={() => router.push({ pathname: '/item', params: { tripId: t.id, kind: q.kind } })} />
            ))}
          </Card>
        ) : (
          <Button title="Add to plan" icon="add" onPress={() => open()} />
        )}

        {day === 'bookings' ? (
          <Card>
            <H2>Confirmation vault</H2>
            <Sub>Every booking reference in one place, so no one has to dig through emails.</Sub>
            {visible.filter((i) => i.bookingRef).map((i) => (
              <Row key={i.id} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.line }}>
                <Icon name={KIND_ICON[i.kind] as 'car'} color={C.primary} />
                <View style={{ flex: 1 }}>
                  <Body size={14}>{i.title}</Body>
                  <Sub>{dayLabel(t, i.day)} · {i.refundable ? 'Refundable' : 'Non-refundable'}</Sub>
                </View>
                <Body bold>{i.bookingRef}</Body>
              </Row>
            ))}
          </Card>
        ) : (
          // An empty trip only shows the quick-add card above, not a list of blank days.
          t.items.length > 0 &&
          days.map((d) => {
            const list = visible.filter((i) => i.day === d && i.kind !== 'lodging');
            const stay = visible.find((l) => l.kind === 'lodging' && d >= l.day && d < l.day + (l.nights ?? 1));
            return (
              <View key={d} style={{ gap: S.sm }}>
                <H2 right={<Sub>{money(list.reduce((s, i) => s + i.cost, 0))}</Sub>}>
                  Day {d + 1} · {dayLabel(t, d)}
                </H2>
                {stay && (
                  <Card onPress={() => open(stay)} style={{ backgroundColor: C.primarySoft, paddingVertical: S.md }}>
                    <Row>
                      <Icon name="bed" color={C.primary} />
                      <Body size={14}>Staying at <Body bold size={14}>{stay.title}</Body></Body>
                    </Row>
                  </Card>
                )}
                {list.length === 0 && t.items.length > 0 && (
                  <Pressable onPress={() => router.push({ pathname: '/item', params: { tripId: t.id, day: String(d) } })} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: S.lg, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line }}>
                    <Icon name="add" color={C.primary} />
                    <Body color={C.primary} bold size={14}>Add something to day {d + 1}</Body>
                  </Pressable>
                )}
                {list.map((i) => (
                  <Card key={i.id} onPress={() => open(i)} style={conflicts.has(i.id) ? { borderWidth: 1.5, borderColor: C.high } : undefined}>
                    <Row style={{ alignItems: 'flex-start' }} gap={S.md}>
                      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name={KIND_ICON[i.kind] as 'car'} color={C.primary} />
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Sub>{fmtTime(i.start)} · {i.durationMin >= 60 ? `${Math.round(i.durationMin / 6) / 10}h` : `${i.durationMin}m`}</Sub>
                        <Body bold>{i.title}</Body>
                        {(() => {
                          const st = status(i, conflicts.has(i.id));
                          return st && <Tag label={st.label} color={st.color} bg={st.bg} />;
                        })()}
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <Body bold size={14}>{i.cost ? money(i.cost) : 'Free'}</Body>
                        <AvatarStack users={i.attendeeIds.map(user)} size={20} />
                      </View>
                    </Row>
                  </Card>
                ))}
              </View>
            );
          })
        )}
      </Screen>
    </View>
  );
}
