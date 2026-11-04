import { router } from 'expo-router';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, AvatarStack, Body, Button, Card, Empty, H2, Icon, Row, ScoreBadge, Screen, Sub, Tag } from '@/components/ui';
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
  const { state, me, user, resetDemo } = useStore();
  const insets = useSafeAreaInsets();
  const mine = state.trips.filter((t) => t.memberIds.includes(me.id));

  const confirmReset = () => {
    if (Platform.OS === 'web') return resetDemo();
    Alert.alert('Reset demo data?', 'Restores the sample Lisbon trip.', [{ text: 'Cancel' }, { text: 'Reset', style: 'destructive', onPress: resetDemo }]);
  };

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: C.bg }}>
      <Screen>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 30, fontWeight: '900', color: C.text, letterSpacing: -0.8 }}>
              Trip<Text style={{ color: C.twin }}>Twin</Text>
            </Text>
            <Sub>Don't just plan your trip. Test it before you take it.</Sub>
          </View>
          <Pressable onPress={() => router.push('/profile')} accessibilityLabel="Switch traveler">
            <Avatar user={me} size={42} />
          </Pressable>
        </Row>

        <Row>
          <View style={{ flex: 1 }}>
            <Button title="New trip" icon="add" onPress={() => router.push('/new-trip')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Join with code" icon="people" kind="ghost" onPress={() => router.push('/join')} />
          </View>
        </Row>

        <H2>Your trips</H2>
        {mine.length === 0 && <Empty icon="airplane-outline" text="No trips yet. Create one or join your group's trip with a code." />}
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
                  <ScoreBadge score={r.score} size={72} />
                  <Sub>{r.grade}</Sub>
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

        <Pressable onPress={confirmReset} style={{ alignSelf: 'center', padding: S.md }}>
          <Sub>Reset demo data</Sub>
        </Pressable>
      </Screen>
    </View>
  );
}
