import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Body, Button, Card, H2, Icon, Meter, Row, ScoreBadge, Screen, Stat, Sub, Tag } from '@/components/ui';
import { C, S, scoreColor } from '@/constants/theme';
import { settleUp, spent } from '@/lib/budget';
import { computeResilience } from '@/lib/resilience';
import { useTrip } from '@/lib/store';
import type { TripPhase } from '@/lib/types';
import { clamp, dayLabel, daysUntil, fmtTime, KIND_ICON, money, plannedCost, sortItems } from '@/lib/util';

const PHASES: { key: TripPhase; label: string; icon: 'create' | 'navigate' | 'flag' }[] = [
  { key: 'planning', label: 'Plan', icon: 'create' },
  { key: 'active', label: 'Travel', icon: 'navigate' },
  { key: 'complete', label: 'Wrap up', icon: 'flag' },
];

export default function Overview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, update, me, user, post } = useTrip(id);
  if (!t) return null;
  const r = computeResilience(t);
  const cost = plannedCost(t);
  const phaseIdx = PHASES.findIndex((p) => p.key === t.phase);
  const myTasks = t.tasks.filter((k) => k.assigneeId === me.id && !k.done);
  const today = clamp(-daysUntil(t), 0, t.days - 1);
  const todays = sortItems(t.items.filter((i) => i.day === today && i.kind !== 'lodging'));
  const history = t.scoreHistory.slice(-8);

  const setPhase = (phase: TripPhase) => {
    update((x) => ({ ...x, phase }));
    post(t.id, `${me.name} moved the trip to "${PHASES.find((p) => p.key === phase)?.label}".`, true);
  };

  return (
    <Screen>
      {/* Lifecycle: planning → travel → wrap-up */}
      <Card>
        <Row>
          {PHASES.map((p, i) => (
            <Pressable key={p.key} style={{ flex: 1, alignItems: 'center', gap: 4 }} onPress={() => setPhase(p.key)}>
              <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: i <= phaseIdx ? C.primary : C.line }}>
                <Icon name={p.icon} size={16} color={i <= phaseIdx ? '#fff' : C.sub} />
              </View>
              <Sub>{p.label}</Sub>
            </Pressable>
          ))}
        </Row>
        {t.phase === 'planning' && <Sub>{daysUntil(t) > 0 ? `${daysUntil(t)} days until ${t.destination}.` : 'Trip starts today!'} Tap a stage to move the trip forward.</Sub>}
      </Card>

      {/* Signature feature */}
      <Card>
        <Row gap={S.lg}>
          <ScoreBadge score={r.score} label="/100" />
          <View style={{ flex: 1, gap: 4 }}>
            <Sub>TRIP RESILIENCE SCORE</Sub>
            <Body bold size={22} color={scoreColor(r.score)}>{r.grade}</Body>
            <Sub>How well this plan holds up when things go wrong.</Sub>
            {history.length > 1 && (
              <Row gap={3} style={{ alignItems: 'flex-end', height: 26 }}>
                {history.map((h, i) => (
                  <View key={i} style={{ width: 8, height: 4 + (h.score / 100) * 22, borderRadius: 2, backgroundColor: scoreColor(h.score) }} />
                ))}
                <Sub> trend</Sub>
              </Row>
            )}
          </View>
        </Row>
        {r.factors.map((f) => (
          <View key={f.key} style={{ gap: 4, marginTop: 4 }}>
            <Row>
              <Body bold size={14}>{f.label}</Body>
              <View style={{ flex: 1 }} />
              <Body bold size={14} color={scoreColor(f.score)}>{f.score}</Body>
            </Row>
            <Meter value={f.score / 100} />
            <Sub>{f.summary}</Sub>
          </View>
        ))}
        <Button title="Stress test this trip" icon="flash" kind="twin" onPress={() => router.push(`/trip/${t.id}/twin`)} />
      </Card>

      {r.tips.length > 0 && (
        <Card>
          <H2>Make it stronger</H2>
          {r.tips.slice(0, 4).map((tip, i) => (
            <Pressable key={i} onPress={() => tip.itemId && router.push({ pathname: '/item', params: { tripId: t.id, itemId: tip.itemId } })}>
              <Row style={{ alignItems: 'flex-start', paddingVertical: 4 }}>
                <Icon name="bulb-outline" color={C.med} />
                <View style={{ flex: 1 }}>
                  <Body size={14}>{tip.text}</Body>
                </View>
                <Tag label={`+${tip.gain}`} color={C.low} bg={C.lowSoft} />
              </Row>
            </Pressable>
          ))}
        </Card>
      )}

      {t.phase === 'active' && (
        <Card>
          <H2 right={<Tag label={dayLabel(t, today)} color={C.twin} bg={C.twinSoft} />}>Today</H2>
          {todays.length === 0 && <Sub>Nothing scheduled — free day!</Sub>}
          {todays.map((i) => (
            <Row key={i.id}>
              <Icon name={KIND_ICON[i.kind] as 'car'} color={C.primary} />
              <Body size={14}>{fmtTime(i.start)}  {i.title}</Body>
            </Row>
          ))}
          <Button title="Something went wrong — report it" icon="warning" kind="danger" onPress={() => router.push({ pathname: '/trip/[id]/twin', params: { id: t.id, live: '1' } })} />
        </Card>
      )}

      {t.phase === 'complete' && (
        <Card>
          <H2>Trip recap</H2>
          <Row>
            <Stat label="spent" value={money(spent(t))} />
            <Stat label="per person" value={money(spent(t) / t.memberIds.length)} />
            <Stat label="plans" value={String(t.items.length)} />
          </Row>
          <Sub>{t.playbooks.length} Plan B playbook(s) prepared · {t.messages.length} messages · {t.polls.length} group decisions</Sub>
          {settleUp(t).length > 0 ? (
            <Button title={`${settleUp(t).length} payment(s) left to settle`} icon="cash" kind="ghost" onPress={() => router.push(`/trip/${t.id}/budget`)} />
          ) : (
            <Body color={C.low} bold>Everyone is settled up 🎉</Body>
          )}
        </Card>
      )}

      <Row gap={S.md}>
        <Card style={{ flex: 1 }} onPress={() => router.push(`/trip/${t.id}/budget`)}>
          <Sub>Planned cost</Sub>
          <Body bold size={20}>{money(cost)}</Body>
          <Meter value={cost / Math.max(1, t.budget)} color={cost > t.budget ? C.high : C.primary} />
          <Sub>of {money(t.budget)} budget</Sub>
        </Card>
        <Card style={{ flex: 1 }} onPress={() => router.push(`/trip/${t.id}/group`)}>
          <Sub>Group</Sub>
          <Body bold size={20}>{t.memberIds.length} travelers</Body>
          <Sub>{t.polls.filter((p) => !p.closed).length} open poll(s)</Sub>
          <Sub>Code {t.joinCode}</Sub>
        </Card>
      </Row>

      <Card>
        <H2>Your to-dos</H2>
        {myTasks.length === 0 ? <Sub>You're all caught up, {me.name}.</Sub> : myTasks.map((k) => (
          <Pressable key={k.id} onPress={() => update((x) => ({ ...x, tasks: x.tasks.map((y) => (y.id === k.id ? { ...y, done: true } : y)) }))}>
            <Row style={{ paddingVertical: 4 }}>
              <Icon name="ellipse-outline" color={C.primary} />
              <Body size={14}>{k.title}</Body>
            </Row>
          </Pressable>
        ))}
        <Sub>Assigned by the group · {t.tasks.filter((k) => !k.done && k.list === 'prep').length} open tasks total{user(t.ownerId) ? ` · organizer ${user(t.ownerId)?.name}` : ''}</Sub>
      </Card>
    </Screen>
  );
}
