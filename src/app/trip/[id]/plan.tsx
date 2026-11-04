import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { AvatarStack, Body, Button, Card, Chip, Empty, H2, Icon, Row, Screen, Sub, Tag } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { useTrip } from '@/lib/store';
import { useTripId } from '@/lib/trip-id';
import type { ItineraryItem } from '@/lib/types';
import { absEnd, absStart, dayLabel, fmtTime, KIND_ICON, money, sortItems } from '@/lib/util';

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: S.sm, padding: S.lg, paddingBottom: 0 }}>
        <Chip label="All days" active={day === 'all'} onPress={() => setDay('all')} />
        {Array.from({ length: t.days }, (_, d) => (
          <Chip key={d} label={`Day ${d + 1}`} active={day === d} onPress={() => setDay(d)} />
        ))}
        <Chip label="Bookings" icon="document-text" active={day === 'bookings'} onPress={() => setDay('bookings')} />
        <Chip label="Only mine" icon="person" active={mine} color={C.twin} onPress={() => setMine(!mine)} />
      </ScrollView>
      <Screen>
        <Button title="Add to plan" icon="add" onPress={() => open()} />

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
                      {!stay.backup && <Tag label="no backup" color={C.med} bg={C.medSoft} />}
                    </Row>
                  </Card>
                )}
                {list.length === 0 && <Empty icon="sunny-outline" text="Nothing planned yet" />}
                {list.map((i) => (
                  <Card key={i.id} onPress={() => open(i)} style={conflicts.has(i.id) ? { borderWidth: 1.5, borderColor: C.high } : undefined}>
                    <Row style={{ alignItems: 'flex-start' }} gap={S.md}>
                      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name={KIND_ICON[i.kind] as 'car'} color={C.primary} />
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Sub>{fmtTime(i.start)} · {i.durationMin >= 60 ? `${Math.round(i.durationMin / 6) / 10}h` : `${i.durationMin}m`}</Sub>
                        <Body bold>{i.title}</Body>
                        <Row gap={4} style={{ flexWrap: 'wrap' }}>
                          {conflicts.has(i.id) && <Tag label="schedule conflict" color={C.high} bg={C.highSoft} />}
                          {i.outdoor && <Tag label={i.backup ? 'outdoor · has plan B' : 'outdoor · no plan B'} color={i.backup ? C.low : C.med} bg={i.backup ? C.lowSoft : C.medSoft} />}
                          {!i.refundable && i.cost > 0 && <Tag label="non-refundable" color={C.high} bg={C.highSoft} />}
                          {i.flexible && <Tag label="flexible" color={C.twin} bg={C.twinSoft} />}
                          {!!i.dependsOn?.length && <Tag label={`needs ${t.items.find((x) => x.id === i.dependsOn![0])?.title ?? 'another booking'}`} color={C.sub} bg={C.line} />}
                        </Row>
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
