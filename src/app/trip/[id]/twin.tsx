import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Body, Button, Card, H2, Icon, OptionCard, PeoplePicker, Row, ScoreBadge, Screen, Segmented, Stat, Sub, Tag, styles, type IconName } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { applyChanges, describeScenario, simulate, stressTest, type Scenario, type Severity, type SimResult } from '@/lib/simulate';
import { useTrip } from '@/lib/store';
import { useTripId } from '@/lib/trip-id';
import type { Trip } from '@/lib/types';
import { absStart, dayLabel, KIND_ICON, money, uid } from '@/lib/util';

type Kind = Scenario['kind'];

const WHAT_IFS: { k: Kind; q: string; hint: string; icon: IconName }[] = [
  { k: 'flightDelay', q: 'Our flight is delayed', hint: 'See which plans you would miss', icon: 'airplane' },
  { k: 'dropout', q: "Someone can't come", hint: 'See how costs shift for everyone else', icon: 'person-remove' },
  { k: 'lodgingCancel', q: 'Our stay gets cancelled', hint: 'See what it costs to rebook', icon: 'bed' },
  { k: 'rain', q: 'It rains', hint: 'See which outdoor plans are at risk', icon: 'rainy' },
  { k: 'budgetCut', q: 'Our budget shrinks', hint: 'See what you could cut', icon: 'trending-down' },
];

const SEV: Record<Severity, { c: string; bg: string; label: string }> = {
  high: { c: C.high, bg: C.highSoft, label: 'Serious' },
  medium: { c: C.med, bg: C.medSoft, label: 'Heads up' },
  low: { c: C.low, bg: C.lowSoft, label: 'Minor' },
};

/** Pick the most useful default for each what-if so people rarely have to choose anything. */
function defaults(t: Trip) {
  const legs = [...t.items].filter((i) => i.kind === 'flight' || i.kind === 'transport').sort((a, b) => (a.kind === b.kind ? absStart(a) - absStart(b) : a.kind === 'flight' ? -1 : 1));
  let rainDay = 0;
  let most = -1;
  for (let d = 0; d < t.days; d++) {
    const n = t.items.filter((i) => i.day === d && i.outdoor).length;
    if (n > most) [most, rainDay] = [n, d];
  }
  return { legs, lodgings: t.items.filter((i) => i.kind === 'lodging'), rainDay };
}

function summary(r: SimResult) {
  const serious = r.impacts.filter((i) => i.severity === 'high').length;
  const parts = [
    serious ? `${serious} serious problem${serious === 1 ? '' : 's'}` : 'no serious problems',
    r.lostMoney ? `${money(r.lostMoney)} at risk` : 'no money lost',
  ];
  const fixes = r.fixes.length ? `TripTwin found ${r.fixes.length} fix${r.fixes.length === 1 ? '' : 'es'}.` : 'Your plan already handles this.';
  return `This would cause ${parts.join(' and ')}. ${fixes}`;
}

export default function Twin() {
  const id = useTripId();
  const { live } = useLocalSearchParams<{ live?: string }>();
  const { t, update, state, me, user, post } = useTrip(id);
  const isLive = live === '1' || t?.phase === 'active';

  const [setup, setSetup] = useState<Kind | null>(null);
  const [legId, setLegId] = useState<string>();
  const [hours, setHours] = useState(6);
  const [dropIds, setDropIds] = useState<string[]>([]);
  const [lodgingId, setLodgingId] = useState<string>();
  const [rainDay, setRainDay] = useState<number>();
  const [cut, setCut] = useState(20);
  const [base, setBase] = useState<Scenario[]>([]); // what-ifs this one is combined with
  const [result, setResult] = useState<SimResult | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [ranking, setRanking] = useState<ReturnType<typeof stressTest> | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [done, setDone] = useState('');
  if (!t) return null;

  const d = defaults(t);
  const draft = (k: Kind): Scenario | null => {
    switch (k) {
      case 'flightDelay': {
        const leg = legId ?? d.legs[0]?.id;
        return leg ? { kind: k, itemId: leg, hours } : null;
      }
      case 'dropout':
        return dropIds.length ? { kind: k, userIds: dropIds } : null;
      case 'lodgingCancel': {
        const l = lodgingId ?? d.lodgings[0]?.id;
        return l ? { kind: k, itemId: l } : null;
      }
      case 'rain':
        return { kind: k, day: rainDay ?? d.rainDay };
      case 'budgetCut':
        return { kind: k, percent: cut };
    }
  };

  const run = (scenarios: Scenario[]) => {
    const r = simulate(t, scenarios, state.users);
    setResult(r);
    setChosen(new Set(r.fixes.map((f) => f.id)));
    setShowAll(false);
    setSetup(null);
    setDone('');
  };

  const reset = () => {
    setResult(null);
    setSetup(null);
    setBase([]);
  };

  const fixes = result?.fixes.filter((f) => chosen.has(f.id)) ?? [];
  const title = result ? result.scenarios.map((s) => describeScenario(s, t, state.users)).join(' + ') : '';

  const savePlaybook = () => {
    if (!result) return;
    const steps = fixes.length ? fixes.map((f) => f.label) : ['No changes needed. The plan absorbs this.'];
    update((x) => ({ ...x, playbooks: [{ id: uid(), title: `If ${title}`, authorId: me.id, steps, createdAt: Date.now() }, ...x.playbooks] }));
    post(t.id, `📘 ${me.name} saved a Plan B: "If ${title}": ${steps.join('; ')}`, true);
    setDone('Plan B saved and shared with the group.');
    reset();
  };

  const applyReal = () => {
    if (!result) return;
    const next = applyChanges(result.twin, fixes.flatMap((f) => f.changes));
    update((x) => ({ ...x, items: next.items, memberIds: next.memberIds, budget: next.budget, tasks: next.tasks }));
    post(t.id, `⚠️ ${me.name} reported: ${title}. TripTwin updated the plan with ${fixes.length} fix(es).`, true);
    setDone("Trip updated. Everyone's plan now reflects the change.");
    reset();
  };

  // ───────────── Step 2: one focused question for the chosen what-if ─────────────
  if (setup) {
    const w = WHAT_IFS.find((x) => x.k === setup)!;
    const scenario = draft(setup);
    const radio = (on: boolean, label: string, sub: string | undefined, icon: IconName, onPress: () => void, key: string) => (
      <Pressable key={key} onPress={onPress} style={[styles.row, { gap: S.md, paddingVertical: 8 }]}>
        <Icon name={on ? 'radio-button-on' : 'radio-button-off'} color={on ? C.twin : C.faint} size={22} />
        <Icon name={icon} size={16} color={C.sub} />
        <View style={{ flex: 1 }}>
          <Body size={15} bold={on}>{label}</Body>
          {sub && <Sub>{sub}</Sub>}
        </View>
      </Pressable>
    );
    return (
      <Screen>
        <Pressable onPress={() => setSetup(null)} style={[styles.row, { gap: 4 }]}>
          <Icon name="chevron-back" color={C.twin} />
          <Body color={C.twin} bold>All what-ifs</Body>
        </Pressable>
        <Card>
          <Row gap={S.md}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.twinSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={w.icon} size={22} color={C.twin} />
            </View>
            <Body bold size={20}>What if {w.q.toLowerCase()}?</Body>
          </Row>

          {setup === 'flightDelay' &&
            (d.legs.length ? (
              <>
                <Sub>Which one?</Sub>
                {d.legs.map((l) => radio((legId ?? d.legs[0].id) === l.id, l.title, dayLabel(t, l.day), KIND_ICON[l.kind] as IconName, () => setLegId(l.id), l.id))}
                <Sub>How late?</Sub>
                <Segmented options={[2, 4, 6, 12].map((h) => ({ value: h, label: `${h} hrs` }))} value={hours} onChange={setHours} color={C.twin} />
              </>
            ) : (
              <Sub>Add a flight or ride to your plan first.</Sub>
            ))}

          {setup === 'dropout' && (
            <>
              <Sub>Tap who can't make it.</Sub>
              <PeoplePicker ids={t.memberIds} selected={dropIds} onChange={setDropIds} userOf={user} allowEveryone={false} />
            </>
          )}

          {setup === 'lodgingCancel' &&
            (d.lodgings.length > 1 ? (
              <>
                <Sub>Which stay?</Sub>
                {d.lodgings.map((l) => radio((lodgingId ?? d.lodgings[0].id) === l.id, l.title, `${l.nights ?? 1} nights`, 'bed', () => setLodgingId(l.id), l.id))}
              </>
            ) : d.lodgings.length ? (
              <Sub>We'll cancel {d.lodgings[0].title} and see what happens.</Sub>
            ) : (
              <Sub>Add where you're staying to your plan first.</Sub>
            ))}

          {setup === 'rain' && (
            <>
              <Sub>Which day? We picked the one with the most outdoor plans.</Sub>
              {Array.from({ length: t.days }, (_, day) => {
                const outdoor = t.items.filter((i) => i.day === day && i.outdoor).length;
                return radio((rainDay ?? d.rainDay) === day, `Day ${day + 1} · ${dayLabel(t, day)}`, outdoor ? `${outdoor} outdoor plan${outdoor > 1 ? 's' : ''}` : 'Nothing outdoors', 'rainy-outline', () => setRainDay(day), String(day));
              })}
            </>
          )}

          {setup === 'budgetCut' && (
            <>
              <Sub>By how much?</Sub>
              <Segmented options={[10, 20, 30].map((p) => ({ value: p, label: `${p}% less` }))} value={cut} onChange={setCut} color={C.twin} />
              <Sub>New budget would be {money(t.budget * (1 - cut / 100))} (now {money(t.budget)}).</Sub>
            </>
          )}

          {base.length > 0 && <Sub>Combined with: {base.map((s) => describeScenario(s, t, state.users)).join(', ')}</Sub>}
          <Button title="See what happens" icon="play" kind="twin" disabled={!scenario} onPress={() => scenario && run([...base, scenario])} />
        </Card>
      </Screen>
    );
  }

  // ───────────── Step 3: results ─────────────
  if (result) {
    const visible = showAll ? result.impacts : result.impacts.slice(0, 3);
    const overBudget = result.costAfter > result.budgetAfter;
    return (
      <Screen>
        <Pressable onPress={reset} style={[styles.row, { gap: 4 }]}>
          <Icon name="chevron-back" color={C.twin} />
          <Body color={C.twin} bold>Try a different what-if</Body>
        </Pressable>

        <Card>
          <Sub>IF {title.toUpperCase()}</Sub>
          <Body bold size={18}>{summary(result)}</Body>
          <Row style={{ justifyContent: 'space-around', marginVertical: S.sm }}>
            <View style={{ alignItems: 'center', gap: 4 }}><ScoreBadge score={result.scoreBefore} size={60} /><Sub>Today</Sub></View>
            <Icon name="arrow-forward" color={C.faint} />
            <View style={{ alignItems: 'center', gap: 4 }}><ScoreBadge score={result.scoreAfter} size={60} /><Sub>If it happens</Sub></View>
            <Icon name="arrow-forward" color={C.faint} />
            <View style={{ alignItems: 'center', gap: 4 }}><ScoreBadge score={result.scoreWithFixes} size={60} /><Sub>With fixes</Sub></View>
          </Row>
          <Row>
            <Stat label="at risk" value={money(result.lostMoney)} color={result.lostMoney ? C.high : C.low} />
            <Stat label={Math.abs(result.perPersonAfter - result.perPersonBefore) > 1 ? `each (was ${money(result.perPersonBefore)})` : 'per person'} value={money(result.perPersonAfter)} color={result.perPersonAfter > result.perPersonBefore + 1 ? C.high : C.text} />
            <Stat label={overBudget ? 'over budget' : 'under budget'} value={money(Math.abs(result.budgetAfter - result.costAfter))} color={overBudget ? C.high : C.low} />
          </Row>
        </Card>

        <Card>
          <H2>What goes wrong</H2>
          {visible.map((im, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: S.sm, paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
              <View style={{ width: 4, borderRadius: 2, backgroundColor: SEV[im.severity].c }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Body bold size={15}>{im.title}</Body>
                <Sub>{im.detail}</Sub>
              </View>
              <Tag label={SEV[im.severity].label} color={SEV[im.severity].c} bg={SEV[im.severity].bg} />
            </View>
          ))}
          {result.impacts.length > 3 && <Sub onPress={() => setShowAll(!showAll)}>{showAll ? 'Show less' : `Show all ${result.impacts.length}`}</Sub>}
        </Card>

        <Card>
          <H2>How to handle it</H2>
          {result.fixes.length === 0 ? (
            <Sub>Nothing to change. Your plan already absorbs this.</Sub>
          ) : (
            <Sub>We've ticked every fix. Untick any you don't want.</Sub>
          )}
          {result.fixes.map((f) => {
            const on = chosen.has(f.id);
            return (
              <Pressable
                key={f.id}
                onPress={() => setChosen((c) => { const n = new Set(c); if (on) n.delete(f.id); else n.add(f.id); return n; })}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}>
                <Row style={{ alignItems: 'flex-start', paddingVertical: 6 }}>
                  <Icon name={on ? 'checkbox' : 'square-outline'} color={C.twin} size={22} />
                  <View style={{ flex: 1 }}>
                    <Body bold size={15}>{f.label}</Body>
                    <Sub>{f.detail}</Sub>
                  </View>
                  {f.costDelta !== 0 && <Body bold size={13} color={f.costDelta < 0 ? C.low : C.high}>{f.costDelta > 0 ? '+' : ''}{money(f.costDelta)}</Body>}
                </Row>
              </Pressable>
            );
          })}
        </Card>

        {isLive ? (
          <>
            <Button title="Update our trip with these fixes" icon="checkmark-done" onPress={applyReal} />
            <Button title="Just save it as a Plan B" icon="book" kind="ghost" onPress={savePlaybook} />
          </>
        ) : (
          <>
            <Button title="Save as our Plan B" icon="book" kind="twin" onPress={savePlaybook} />
            <Sub>Saves these steps to the group playbook and shares them in chat. Your real plan stays the same.</Sub>
            <Button title="It actually happened: update the trip" icon="alert-circle" kind="ghost" onPress={applyReal} />
          </>
        )}
        <Sub onPress={() => { setBase(result.scenarios); setResult(null); }}>+ Add another what-if on top of this one</Sub>
      </Screen>
    );
  }

  // ───────────── Step 1: pick a what-if ─────────────
  return (
    <Screen>
      {isLive ? (
        <Card style={{ backgroundColor: C.highSoft }}>
          <Row><Icon name="pulse" color={C.high} /><Body bold color={C.high}>Something go wrong?</Body></Row>
          <Sub>Pick what happened. TripTwin shows the knock-on effects and updates everyone's plan in one tap.</Sub>
        </Card>
      ) : (
        <Card style={{ backgroundColor: C.twinSoft }}>
          <Body bold size={18} color={C.text}>How would your trip handle a bad day?</Body>
          <Sub>Try things going wrong here. Nothing changes for real unless you say so.</Sub>
          <Button title="Check for everything at once" icon="flash" kind="twin" onPress={() => setRanking(stressTest(t, state.users))} />
        </Card>
      )}

      {!!done && (
        <Card style={{ backgroundColor: C.lowSoft }}>
          <Row><Icon name="checkmark-circle" color={C.low} /><Body color={C.low} bold>{done}</Body></Row>
        </Card>
      )}

      {ranking && (
        <Card>
          <H2>Your biggest risks</H2>
          <Sub>Tap one to see the details and fixes.</Sub>
          {ranking.map((r, i) => {
            const bad = i === 0 || r.high > 0;
            return (
              <Pressable key={i} onPress={() => run([r.scenario])} style={[styles.row, { gap: S.md, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line }]}>
                <Icon name={bad ? 'warning' : 'checkmark-circle'} color={bad ? C.high : C.low} size={20} />
                <View style={{ flex: 1 }}>
                  <Body bold size={15}>{r.label}</Body>
                  <Sub>{r.high ? `${r.high} serious problem${r.high > 1 ? 's' : ''}` : 'Handled well'}{r.result.lostMoney ? ` · ${money(r.result.lostMoney)} at risk` : ''}</Sub>
                </View>
                <Icon name="chevron-forward" color={C.faint} />
              </Pressable>
            );
          })}
        </Card>
      )}

      <H2>{isLive ? 'What happened?' : 'Or try one what-if'}</H2>
      {WHAT_IFS.map((w) => (
        <OptionCard key={w.k} icon={w.icon} title={isLive ? w.q : `What if ${w.q.toLowerCase()}?`} subtitle={w.hint} color={C.twin} bg={C.twinSoft} onPress={() => setSetup(w.k)} />
      ))}

      {t.playbooks.length > 0 && (
        <Card>
          <H2>Our Plan Bs</H2>
          {t.playbooks.map((p) => (
            <View key={p.id} style={{ gap: 2, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.line }}>
              <Body bold size={14}>{p.title}</Body>
              {p.steps.map((s, i) => <Sub key={i}>• {s}</Sub>)}
              <Sub>Saved by {user(p.authorId)?.name}</Sub>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
