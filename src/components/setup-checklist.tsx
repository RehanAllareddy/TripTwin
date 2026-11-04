import { router } from 'expo-router';
import { Pressable, Share, View } from 'react-native';

import { Body, Card, Icon, Meter, Row, Sub } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { setupSteps, type SetupStep } from '@/lib/resilience';
import type { Trip } from '@/lib/types';

const ICON: Record<SetupStep['key'], 'airplane' | 'bed' | 'compass' | 'wallet'> = {
  travel: 'airplane',
  stay: 'bed',
  activities: 'compass',
  budget: 'wallet',
};

function open(trip: Trip, key: SetupStep['key']) {
  if (key === 'budget') return router.push({ pathname: '/trip/[id]/budget', params: { id: trip.id, edit: '1' } });
  const kind = key === 'travel' ? 'flight' : key === 'stay' ? 'lodging' : 'activity';
  router.push({ pathname: '/item', params: { tripId: trip.id, kind } });
}

/**
 * Guides a new trip to the point where it can be scored and stress tested.
 * Doubles as the first-time experience: every step is one tap from the right form.
 */
export function SetupChecklist({ trip, title = 'Get your trip ready', subtitle }: { trip: Trip; title?: string; subtitle?: string }) {
  const steps = setupSteps(trip);
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  const invited = trip.memberIds.length > 1;

  return (
    <Card style={{ gap: S.md }}>
      <View style={{ gap: 4 }}>
        <Row>
          <Body bold size={18}>{title}</Body>
          <View style={{ flex: 1 }} />
          <Sub>{done} of {steps.length}</Sub>
        </Row>
        <Sub>{subtitle ?? 'Add the basics and TripTwin can score how well your plan holds up, then test it against delays, rain and more.'}</Sub>
        <Meter value={done / steps.length} color={C.twin} />
      </View>

      {steps.map((s) => {
        const isNext = s === next;
        return (
          <Pressable
            key={s.key}
            disabled={s.done}
            onPress={() => open(trip, s.key)}
            accessibilityRole="button"
            accessibilityState={{ disabled: s.done }}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md, borderRadius: 14, opacity: pressed ? 0.7 : 1 },
              isNext ? { backgroundColor: C.twinSoft } : { backgroundColor: C.bg },
            ]}>
            <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: s.done ? C.low : isNext ? C.twin : C.line }}>
              <Icon name={s.done ? 'checkmark' : ICON[s.key]} size={18} color={s.done || isNext ? '#fff' : C.sub} />
            </View>
            <View style={{ flex: 1 }}>
              <Body bold={!s.done} size={15} color={s.done ? C.faint : C.text}>{s.label}</Body>
              {!s.done && <Sub>{s.hint}</Sub>}
            </View>
            {!s.done && <Icon name="add-circle" size={24} color={isNext ? C.twin : C.faint} />}
          </Pressable>
        );
      })}

      {!invited && (
        <Pressable
          onPress={() => Share.share({ message: `Join "${trip.name}" on TripTwin with code ${trip.joinCode}` }).catch(() => {})}
          style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md, borderRadius: 14, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed', opacity: pressed ? 0.7 : 1 }]}>
          <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primarySoft }}>
            <Icon name="person-add" size={18} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Body bold size={15}>Invite your group</Body>
            <Sub>Share code {trip.joinCode} so friends can plan with you</Sub>
          </View>
          <Icon name="share-outline" size={22} color={C.primary} />
        </Pressable>
      )}
    </Card>
  );
}
