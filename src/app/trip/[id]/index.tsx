import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { SetupChecklist } from '@/components/setup-checklist';
import { Body, Button, Card, Expandable, H2, Icon, Meter, Row, ScoreBadge, Screen, Stat, Sub, Tag } from '@/components/ui';
import { C, S, scoreColor } from '@/constants/theme';
import { settleUp, spent } from '@/lib/budget';
import { computeResilience, type Factor, type Resilience, type Tip } from '@/lib/resilience';
import { useTrip } from '@/lib/store';
import { useTripId } from '@/lib/trip-id';
import type { TripPhase } from '@/lib/types';
import { clamp, dayLabel, daysUntil, fmtTime, KIND_ICON, money, plannedCost, sortItems } from '@/lib/util';

const PHASES: { key: TripPhase; label: string; icon: 'create' | 'navigate' | 'flag' }[] = [
  { key: 'planning', label: 'Plan', icon: 'create' },
  { key: 'active', label: 'Travel', icon: 'navigate' },
  { key: 'complete', label: 'Wrap up', icon: 'flag' },
];

const GRADE_LINE: Record<Resilience['grade'], string> = {
  Fragile: 'One surprise could unravel this trip. A few small changes will help a lot.',
  Shaky: 'Some surprises would really hurt. See the quick win below.',
  Steady: 'Handles most surprises. A couple of gaps left.',
  Resilient: 'Ready for most things that could go wrong.',
  Bulletproof: 'This trip can take almost anything. Nice planning!',
};

const WEAK_LINE: Record<Factor['key'], string> = {
  schedule: 'plans are packed back-to-back with little wiggle room.',
  budget: "there's not much money left over for surprises.",
  transport: 'few backup options if a flight or ride falls through.',
  dependencies: 'several bookings rely on each other, so one problem can knock over others.',
  backups: "some outdoor plans and stays don't have a Plan B.",
};

export default function Overview() {
  const id = useTripId();
  const { t, update, me, user, post } = useTrip(id);
  if (!t) return null;
  const r = computeResilience(t);
  const cost = plannedCost(t);
  const phaseIdx = PHASES.findIndex((p) => p.key === t.phase);
  const myTasks = t.tasks.filter((k) => k.assigneeId === me.id && !k.done);
  const today = clamp(-daysUntil(t), 0, t.days - 1);
  const todays = sortItems(t.items.filter((i) => i.day === today && i.kind !== 'lodging'));
  const history = t.scoreHistory.slice(-8);
  const weakest = [...r.factors].sort((a, b) => a.score - b.score)[0];
  const topTip = r.tips[0];
  const openTip = (tip: Tip) =>
    tip.itemId ? router.push({ pathname: '/item', params: { tripId: t.id, itemId: tip.itemId } }) : router.push(`/trip/${t.id}/budget`);

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
        {t.phase === 'planning' && <Sub>{daysUntil(t) > 0 ? `${daysUntil(t)} days until ${t.destination}.` : 'Trip starts today!'} When you leave, tap Travel.</Sub>}
      </Card>

      {r.ready ? (
        <>
        {/* Signature feature: one clear number, one sentence, one next step */}
        <Card>
          <Row gap={S.lg}>
            <ScoreBadge score={r.score} label="/100" />
            <View style={{ flex: 1, gap: 4 }}>
              <Sub>TRIP RESILIENCE SCORE</Sub>
              <Body bold size={22} color={scoreColor(r.score)}>{r.grade}</Body>
              <Sub>{GRADE_LINE[r.grade]}</Sub>
            </View>
          </Row>
          {weakest.score < 75 && (
            <Body size={14}>
              Weakest spot: <Body bold size={14}>{WEAK_LINE[weakest.key]}</Body>
            </Body>
          )}
          <Button title="See what could go wrong" icon="flash" kind="twin" onPress={() => router.push(`/trip/${t.id}/twin`)} />
        </Card>

        {topTip && (
          <Card style={{ borderWidth: 1.5, borderColor: C.lowSoft }}>
            <Row>
              <Icon name="bulb" color={C.med} />
              <Body bold>Quick win</Body>
              <View style={{ flex: 1 }} />
              <Tag label={`+${topTip.gain} points`} color={C.low} bg={C.lowSoft} />
            </Row>
            <Body size={15}>{topTip.text}</Body>
            <Button small kind="ghost" title={topTip.itemId ? 'Fix it now' : 'Open budget'} icon="arrow-forward" onPress={() => openTip(topTip)} />
          </Card>
        )}

        <Expandable title="Why this score?" subtitle={`5 checks${r.tips.length > 1 ? ` · ${r.tips.length - 1} more ideas` : ''}`} icon="stats-chart">
          {r.factors.map((f) => (
            <View key={f.key} style={{ gap: 4 }}>
              <Row>
                <Body bold size={14}>{f.label}</Body>
                <View style={{ flex: 1 }} />
                <Body bold size={14} color={scoreColor(f.score)}>{f.score}</Body>
              </Row>
              <Meter value={f.score / 100} />
              <Sub>{f.summary}</Sub>
            </View>
          ))}
          {history.length > 1 && (
            <Row gap={3} style={{ alignItems: 'flex-end', height: 30, marginTop: 4 }}>
              <Sub>Score over time </Sub>
              {history.map((h, i) => (
                <View key={i} style={{ width: 8, height: 4 + (h.score / 100) * 24, borderRadius: 2, backgroundColor: scoreColor(h.score) }} />
              ))}
            </Row>
          )}
          {r.tips.slice(1, 6).map((tip, i) => (
            <Pressable key={i} onPress={() => openTip(tip)}>
              <Row style={{ alignItems: 'flex-start', paddingVertical: 4 }}>
                <Icon name="bulb-outline" color={C.med} />
                <View style={{ flex: 1 }}>
                  <Body size={14}>{tip.text}</Body>
                </View>
                <Tag label={`+${tip.gain}`} color={C.low} bg={C.lowSoft} />
              </Row>
            </Pressable>
          ))}
        </Expandable>
        </>
      ) : (
        <SetupChecklist trip={t} />
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
          <Body bold size={20}>{t.memberIds.length} traveler{t.memberIds.length === 1 ? '' : 's'}</Body>
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
