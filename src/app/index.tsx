import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, AvatarStack, Body, Button, Card, Empty, H2, Icon, OptionCard, Row, ScoreBadge, Screen, Sub, Tag } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { computeResilience } from '@/lib/resilience';
import { useStore } from '@/lib/store';
import { dayLabel, daysUntil } from '@/lib/util';

const PHASE = {
  planning: { label: 'Planning', color: C.primary, bg: C.primarySoft },
  active: { label: 'On the trip', color: C.twin, bg: C.twinSoft },
  complete: { label: 'Completed', color: C.sub, bg: C.line },
};

export default function Home() {
  const { state, me, user, joinTrip } = useStore();
  const insets = useSafeAreaInsets();
  const mine = state.trips.filter((t) => t.memberIds.includes(me.id));

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: C.bg }}>
      <Screen>
        <Row gap={S.md}>
          <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel="Profile and settings" hitSlop={8}>
            <Avatar user={me} size={44} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Sub>Hi, {me.name.split(' ')[0]} 👋</Sub>
            <Text style={{ fontSize: 28, fontWeight: '900', color: C.text, letterSpacing: -0.8 }}>
              Trip<Text style={{ color: C.twin }}>Twin</Text>
            </Text>
          </View>
        </Row>
        <Sub>Don't just plan your trip. Test it before you take it.</Sub>

        <Row>
          <View style={{ flex: 1 }}>
            <Button title="New trip" icon="add" onPress={() => router.push('/new-trip')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Join with code" icon="people" kind="ghost" onPress={() => router.push('/join')} />
          </View>
        </Row>

        <OptionCard icon="earth" title="Explore the world" subtitle="Spin a 3D globe, find your next destination and look around in 360°" color={C.twin} bg={C.twinSoft} onPress={() => router.push('/explore')} />

        <H2>Your trips</H2>
        {mine.length === 0 && (
          <Card style={{ alignItems: 'center' }}>
            <Empty icon="airplane-outline" text="No trips yet. Create one, or join your group's trip with their code." />
            <Button title="Explore the sample Lisbon trip" icon="compass" kind="twin" onPress={() => { const id = joinTrip('LIS27X'); if (id) router.push(`/trip/${id}`); }} />
          </Card>
        )}
        {mine.map((t) => {
          const r = computeResilience(t);
          const d = daysUntil(t);
          const p = PHASE[t.phase];
          return (
            <Card key={t.id} onPress={() => router.push(`/trip/${t.id}`)}>
              <Row gap={S.lg}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Tag label={p.label} color={p.color} bg={p.bg} />
                  <Body bold size={18}>{t.name}</Body>
                  <Row gap={4}>
                    <Icon name="location-outline" size={14} color={C.sub} />
                    <Sub>{t.destination}</Sub>
                  </Row>
                  <Sub>
                    {dayLabel(t, 0)} · {t.days} days{t.phase === 'planning' && d > 0 ? ` · in ${d} days` : ''}
                  </Sub>
                  <AvatarStack users={t.memberIds.map(user)} />
                </View>
                <View style={{ alignItems: 'center', gap: 4 }}>
                  {r.ready ? (
                    <>
                      <ScoreBadge score={r.score} size={72} />
                      <Sub>{r.grade}</Sub>
                    </>
                  ) : (
                    <>
                      <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 6, borderColor: C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
                        <Body bold size={18} color={C.twin}>{r.setup.filter((x) => x.done).length}/{r.setup.length}</Body>
                      </View>
                      <Sub>Setting up</Sub>
                    </>
                  )}
                </View>
              </Row>
            </Card>
          );
        })}

        <Card style={{ backgroundColor: C.twinSoft }}>
          <Row>
            <Icon name="git-compare" color={C.twin} />
            <Body bold color={C.twin}>How TripTwin works</Body>
          </Row>
          <Sub>1. Plan together: itinerary, budget, chat, polls and checklists in one shared trip.</Sub>
          <Sub>2. Build the twin: every booking, dependency and backup becomes part of a digital model.</Sub>
          <Sub>3. Stress test it: simulate delays, dropouts, cancellations, rain and budget cuts, then adopt Plan B fixes before anything goes wrong.</Sub>
        </Card>

      </Screen>
    </View>
  );
}
