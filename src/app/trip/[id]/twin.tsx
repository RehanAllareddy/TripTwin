import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, Body, Button, Card, Chip, H2, Icon, Row, ScoreBadge, Screen, Stat, Sub, Tag, type IconName } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { applyChanges, describeScenario, simulate, stressTest, type Scenario, type Severity, type SimResult } from '@/lib/simulate';
import { useTrip } from '@/lib/store';
import { money, uid } from '@/lib/util';

type Kind = Scenario['kind'];
const TYPES: { k: Kind; label: string; icon: IconName }[] = [
  { k: 'flightDelay', label: 'Flight delay', icon: 'airplane' },
  { k: 'dropout', label: 'People drop out', icon: 'person-remove' },
  { k: 'lodgingCancel', label: 'Lodging cancelled', icon: 'bed' },
  { k: 'rain', label: 'Rain day', icon: 'rainy' },
  { k: 'budgetCut', label: 'Budget cut', icon: 'trending-down' },
];
const SEV: Record<Severity, { c: string; bg: string; label: string }> = {
  high: { c: C.high, bg: C.highSoft, label: 'Critical' },
  medium: { c: C.med, bg: C.medSoft, label: 'Watch' },
  low: { c: C.low, bg: C.lowSoft, label: 'Minor' },
};

export default function Twin() {
  const { id, live } = useLocalSearchParams<{ id: string; live?: string }>();
  const { t, update, state, me, user, post } = useTrip(id);
  const isLive = live === '1' || t?.phase === 'active';

  const [kind, setKind] = useState<Kind>('flightDelay');
  const [flightId, setFlightId] = useState<string>();
  const [hours, setHours] = useState(6);
  const [dropIds, setDropIds] = useState<string[]>([]);
  const [lodgingId, setLodgingId] = useState<string>();
  const [rainDay, setRainDay] = useState(0);
  const [cut, setCut] = useState(20);
  const [stack, setStack] = useState<Scenario[]>([]);
  const [result, setResult] = useState<SimResult | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [ranking, setRanking] = useState<ReturnType<typeof stressTest> | null>(null);
  const [done, setDone] = useState('');

  const flights = useMemo(() => t?.items.filter((i) => i.kind === 'flight' || i.kind === 'transport') ?? [], [t]);
  const lodgings = useMemo(() => t?.items.filter((i) => i.kind === 'lodging') ?? [], [t]);
  if (!t) return null;

  const draft = (): Scenario | null => {
    switch (kind) {
      case 'flightDelay': {
        const f = flightId ?? flights[0]?.id;
        return f ? { kind, itemId: f, hours } : null;
      }
      case 'dropout':
        return dropIds.length ? { kind, userIds: dropIds } : null;
      case 'lodgingCancel': {
        const l = lodgingId ?? lodgings[0]?.id;
        return l ? { kind, itemId: l } : null;
      }
      case 'rain':
        return { kind, day: rainDay };
      case 'budgetCut':
        return { kind, percent: cut };
    }
  };

  const run = (scenarios: Scenario[]) => {
    if (!scenarios.length) return;
    const r = simulate(t, scenarios, state.users);
    setResult(r);
    setChosen(new Set(r.fixes.map((f) => f.id)));
    setDone('');
  };

  const current = draft();
  const fixes = result?.fixes.filter((f) => chosen.has(f.id)) ?? [];
  const title = result ? result.scenarios.map((s) => describeScenario(s, t, state.users)).join(' + ') : '';

  const savePlaybook = () => {
    if (!result) return;
    const steps = fixes.length ? fixes.map((f) => f.label) : ['No fixes needed — the plan absorbs this.'];
    update((x) => ({ ...x, playbooks: [{ id: uid(), title: `If ${title}`, authorId: me.id, steps, createdAt: Date.now() }, ...x.playbooks] }));
    post(t.id, `📘 ${me.name} saved a Plan B — "If ${title}": ${steps.join('; ')}`, true);
    setDone('Saved to the group playbook and shared in chat.');
  };

  const applyReal = () => {
    if (!result) return;
    const next = applyChanges(result.twin, fixes.flatMap((f) => f.changes));
    update((x) => ({ ...x, items: next.items, memberIds: next.memberIds, budget: next.budget, tasks: next.tasks }));
    post(t.id, `⚠️ ${me.name} reported: ${title}. TripTwin updated the plan with ${fixes.length} fix(es).`, true);
    setDone('The real trip has been updated and the group notified.');
    setResult(null);
    setStack([]);
  };

  return (
    <Screen>
      <Card style={{ backgroundColor: isLive ? C.highSoft : C.twinSoft }}>
        <Row>
          <Icon name={isLive ? 'pulse' : 'git-compare'} color={isLive ? C.high : C.twin} />
          <Body bold color={isLive ? C.high : C.twin}>{isLive ? 'Live mode' : 'Digital twin'}</Body>
        </Row>
        <Sub>
          {isLive
            ? "Tell TripTwin what actually happened. It shows the ripple effects and updates everyone's plan in one tap."
            : 'This is a copy of your trip. Break it on purpose — nothing changes for real until you choose.'}
        </Sub>
      </Card>

      {!!done && (
        <Card style={{ backgroundColor: C.lowSoft }}>
          <Row><Icon name="checkmark-circle" color={C.low} /><Body color={C.low} bold>{done}</Body></Row>
        </Card>
      )}

      {/* One-tap stress test */}
      <Card>
        <H2>Stress test</H2>
        <Sub>Runs the five classic disruptions one by one and ranks what would hurt your trip most.</Sub>
        <Button title="Run full stress test" icon="flash" kind="twin" onPress={() => setRanking(stressTest(t, state.users))} />
        {ranking?.map((r, i) => (
          <Pressable key={i} onPress={() => { setStack([r.scenario]); run([r.scenario]); }}>
            <Row style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line }}>
              <Body bold color={C.sub}>{i + 1}</Body>
              <View style={{ flex: 1 }}>
                <Body size={14} bold>{r.label}</Body>
                <Sub>{r.high} critical · {money(r.result.lostMoney)} at risk · score {r.result.scoreBefore} → {r.result.scoreAfter}</Sub>
              </View>
              <Tag label={i === 0 ? 'Biggest risk' : r.high ? 'Risky' : 'OK'} color={i === 0 || r.high ? C.high : C.low} bg={i === 0 || r.high ? C.highSoft : C.lowSoft} />
            </Row>
          </Pressable>
        ))}
      </Card>

      {/* Scenario builder */}
      <Card>
        <H2>What if…</H2>
        <Row style={{ flexWrap: 'wrap' }}>
          {TYPES.map((x) => <Chip key={x.k} label={x.label} icon={x.icon} color={C.twin} active={kind === x.k} onPress={() => setKind(x.k)} />)}
        </Row>

        {kind === 'flightDelay' && (
          <View style={{ gap: S.sm }}>
            <Sub>Which leg?</Sub>
            <Row style={{ flexWrap: 'wrap' }}>
              {flights.map((f) => <Chip key={f.id} label={f.title} active={(flightId ?? flights[0]?.id) === f.id} onPress={() => setFlightId(f.id)} />)}
            </Row>
            {!flights.length && <Sub>Add a flight or transport leg in the Plan tab first.</Sub>}
            <Sub>Delayed by</Sub>
            <Row>{[2, 4, 6, 12].map((h) => <Chip key={h} label={`${h} hours`} active={hours === h} onPress={() => setHours(h)} />)}</Row>
          </View>
        )}
        {kind === 'dropout' && (
          <View style={{ gap: S.sm }}>
            <Sub>Who can't make it?</Sub>
            <Row style={{ flexWrap: 'wrap' }} gap={S.md}>
              {t.memberIds.map((m) => (
                <Pressable key={m} onPress={() => setDropIds((d) => (d.includes(m) ? d.filter((x) => x !== m) : [...d, m]))} style={{ alignItems: 'center', opacity: dropIds.includes(m) ? 1 : 0.35 }}>
                  <Avatar user={user(m)} size={38} />
                  <Sub>{user(m)?.name}</Sub>
                </Pressable>
              ))}
            </Row>
          </View>
        )}
        {kind === 'lodgingCancel' && (
          <Row style={{ flexWrap: 'wrap' }}>
            {lodgings.map((l) => <Chip key={l.id} label={l.title} active={(lodgingId ?? lodgings[0]?.id) === l.id} onPress={() => setLodgingId(l.id)} />)}
            {!lodgings.length && <Sub>No lodging in the plan yet.</Sub>}
          </Row>
        )}
        {kind === 'rain' && (
          <Row style={{ flexWrap: 'wrap' }}>
            {Array.from({ length: t.days }, (_, d) => <Chip key={d} label={`Day ${d + 1}`} active={rainDay === d} onPress={() => setRainDay(d)} />)}
          </Row>
        )}
        {kind === 'budgetCut' && (
          <Row>{[10, 20, 30].map((p) => <Chip key={p} label={`−${p}%`} active={cut === p} onPress={() => setCut(p)} />)}</Row>
        )}

        <Row gap={S.sm}>
          <View style={{ flex: 1 }}>
            <Button title="Simulate" icon="play" kind="twin" disabled={!current} onPress={() => current && run([...stack, current])} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Stack it" icon="layers" kind="ghost" disabled={!current} onPress={() => current && setStack((s) => [...s, current])} />
          </View>
        </Row>
        {stack.length > 0 && (
          <View style={{ gap: 4 }}>
            <Sub>Combined scenario (runs together with the one above):</Sub>
            {stack.map((s, i) => (
              <Row key={i}>
                <Icon name="layers-outline" size={14} color={C.twin} />
                <Body size={14}>{describeScenario(s, t, state.users)}</Body>
                <Pressable onPress={() => setStack((x) => x.filter((_, j) => j !== i))}><Icon name="close-circle" size={16} color={C.faint} /></Pressable>
              </Row>
            ))}
          </View>
        )}
      </Card>

      {/* Results */}
      {result && (
        <>
          <Card>
            <Sub>SIMULATION</Sub>
            <Body bold size={18}>{title}</Body>
            <Row style={{ justifyContent: 'space-around', marginVertical: S.sm }}>
              <View style={{ alignItems: 'center', gap: 4 }}><ScoreBadge score={result.scoreBefore} size={64} /><Sub>Now</Sub></View>
              <Icon name="arrow-forward" color={C.faint} />
              <View style={{ alignItems: 'center', gap: 4 }}><ScoreBadge score={result.scoreAfter} size={64} /><Sub>After hit</Sub></View>
              <Icon name="arrow-forward" color={C.faint} />
              <View style={{ alignItems: 'center', gap: 4 }}><ScoreBadge score={result.scoreWithFixes} size={64} /><Sub>With fixes</Sub></View>
            </Row>
            <Row>
              <Stat label="money at risk" value={money(result.lostMoney)} color={result.lostMoney ? C.high : C.low} />
              <Stat label="per person" value={`${money(result.perPersonAfter)}`} color={result.perPersonAfter > result.perPersonBefore + 1 ? C.high : C.text} />
              <Stat label={result.costAfter > result.budgetAfter ? 'over budget' : 'under budget'} value={money(Math.abs(result.budgetAfter - result.costAfter))} color={result.costAfter > result.budgetAfter ? C.high : C.low} />
            </Row>
            <Sub>Per person was {money(result.perPersonBefore)} before this scenario.</Sub>
          </Card>

          <Card>
            <H2>Ripple effects ({result.impacts.length})</H2>
            {result.impacts.map((im, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: S.sm, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                <View style={{ width: 4, borderRadius: 2, backgroundColor: SEV[im.severity].c }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Row><Tag label={SEV[im.severity].label} color={SEV[im.severity].c} bg={SEV[im.severity].bg} /></Row>
                  <Body bold size={14}>{im.title}</Body>
                  <Sub>{im.detail}</Sub>
                </View>
              </View>
            ))}
          </Card>

          <Card>
            <H2>Suggested Plan B ({result.fixes.length})</H2>
            {result.fixes.length === 0 && <Sub>No changes needed. Your plan absorbs this one.</Sub>}
            {result.fixes.map((f) => {
              const on = chosen.has(f.id);
              return (
                <Pressable key={f.id} onPress={() => setChosen((c) => { const n = new Set(c); if (on) n.delete(f.id); else n.add(f.id); return n; })}>
                  <Row style={{ alignItems: 'flex-start', paddingVertical: 6 }}>
                    <Icon name={on ? 'checkbox' : 'square-outline'} color={C.twin} size={20} />
                    <View style={{ flex: 1 }}>
                      <Body bold size={14}>{f.label}</Body>
                      <Sub>{f.detail}</Sub>
                    </View>
                    {f.costDelta !== 0 && <Body bold size={13} color={f.costDelta < 0 ? C.low : C.high}>{f.costDelta > 0 ? '+' : ''}{money(f.costDelta)}</Body>}
                  </Row>
                </Pressable>
              );
            })}
            <Button title="Save as group Plan B" icon="book" kind="twin" onPress={savePlaybook} />
            <Button title={isLive ? 'Apply to the real trip now' : 'This really happened — apply it'} icon="checkmark-done" kind={isLive ? 'primary' : 'ghost'} onPress={applyReal} />
          </Card>
        </>
      )}

      <Card>
        <H2>Group playbook ({t.playbooks.length})</H2>
        {t.playbooks.length === 0 && <Sub>Saved Plan Bs appear here so everyone knows what to do if something goes wrong.</Sub>}
        {t.playbooks.map((p) => (
          <View key={p.id} style={{ gap: 2, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.line }}>
            <Body bold size={14}>{p.title}</Body>
            {p.steps.map((s, i) => <Sub key={i}>• {s}</Sub>)}
            <Sub>by {user(p.authorId)?.name}</Sub>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
