/**
 * The TripTwin simulation engine.
 *
 * Takes the real trip, clones it into a "digital twin", applies one or more
 * disruptions, and traces the ripple effects through schedules, bookings,
 * dependencies, headcount and money. It also proposes concrete fixes the group
 * can adopt as a Plan B.
 */
import { balances } from './budget';
import { computeResilience } from './resilience';
import type { ID, ItineraryItem, Trip, User } from './types';
import { absEnd, absStart, fromMin, money, plannedCost, toMin, uid } from './util';

export type Scenario =
  | { kind: 'flightDelay'; itemId: ID; hours: number }
  | { kind: 'dropout'; userIds: ID[] }
  | { kind: 'lodgingCancel'; itemId: ID }
  | { kind: 'rain'; day: number }
  | { kind: 'budgetCut'; percent: number };

export type Severity = 'high' | 'medium' | 'low';

export interface Impact {
  severity: Severity;
  title: string;
  detail: string;
  itemId?: ID;
  /** What a fix must address to resolve this impact (defaults to itemId). */
  key?: string;
}

export type Change =
  | { op: 'update'; itemId: ID; patch: Partial<ItineraryItem> }
  | { op: 'remove'; itemId: ID }
  | { op: 'add'; item: ItineraryItem }
  | { op: 'addTask'; title: string };

export interface Fix {
  id: ID;
  label: string;
  detail: string;
  costDelta: number;
  changes: Change[];
  /** Impact keys this fix addresses (defaults to the items it updates/removes). */
  resolves?: string[];
}

export interface SimResult {
  scenarios: Scenario[];
  impacts: Impact[];
  fixes: Fix[];
  twin: Trip;
  costBefore: number;
  costAfter: number;
  lostMoney: number;
  perPersonBefore: number;
  perPersonAfter: number;
  budgetAfter: number;
  scoreBefore: number;
  scoreAfter: number;
  scoreWithFixes: number;
}

const BUFFER = 60;
const LATEST_END = 23 * 60;
const PENALTY: Record<Severity, number> = { high: 8, medium: 3, low: 1 };

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export function describeScenario(s: Scenario, trip: Trip, users: User[]): string {
  const item = (id: ID) => trip.items.find((i) => i.id === id)?.title ?? 'booking';
  switch (s.kind) {
    case 'flightDelay':
      return `${item(s.itemId)} delayed ${s.hours}h`;
    case 'dropout':
      return `${s.userIds.map((id) => users.find((u) => u.id === id)?.name ?? '?').join(', ')} drop${s.userIds.length === 1 ? 's' : ''} out`;
    case 'lodgingCancel':
      return `${item(s.itemId)} cancelled`;
    case 'rain':
      return `Rain on day ${s.day + 1}`;
    case 'budgetCut':
      return `Budget cut ${s.percent}%`;
  }
}

/** Every item that (transitively) depends on `id`. */
function dependentsOf(id: ID, items: ItineraryItem[], acc = new Set<ID>()): ItineraryItem[] {
  for (const it of items) {
    if (it.dependsOn?.includes(id) && !acc.has(it.id)) {
      acc.add(it.id);
      dependentsOf(it.id, items, acc);
    }
  }
  return items.filter((i) => acc.has(i.id));
}

function overlapsSomeone(trip: Trip, candidate: ItineraryItem, day: number, startMin: number) {
  const end = startMin + candidate.durationMin;
  return trip.items.some(
    (o) =>
      o.id !== candidate.id &&
      o.kind !== 'lodging' &&
      o.day === day &&
      o.attendeeIds.some((a) => candidate.attendeeIds.includes(a)) &&
      toMin(o.start) < end &&
      toMin(o.start) + o.durationMin > startMin,
  );
}

/** Find the earliest open slot for an item from `fromAbs` onward. */
function findSlot(trip: Trip, item: ItineraryItem, fromAbs: number): { day: number; start: string } | null {
  for (let day = Math.floor(fromAbs / 1440); day < trip.days; day++) {
    const earliest = day === Math.floor(fromAbs / 1440) ? fromAbs % 1440 : 9 * 60;
    for (let m = Math.ceil(earliest / 30) * 30; m + item.durationMin <= LATEST_END; m += 30) {
      if (!overlapsSomeone(trip, item, day, m)) return { day, start: fromMin(m) };
    }
  }
  return null;
}

function flagDependents(twin: Trip, root: ItineraryItem, impacts: Impact[], seen: Set<ID>) {
  for (const d of dependentsOf(root.id, twin.items)) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    impacts.push({
      severity: 'high',
      itemId: d.id,
      title: `${d.title} is at risk`,
      detail: `It depends on "${root.title}". ${d.refundable ? 'Refundable if cancelled.' : `${money(d.cost)} non-refundable.`}`,
    });
  }
}

export function simulate(trip: Trip, scenarios: Scenario[], users: User[]): SimResult {
  const twin = clone(trip);
  const impacts: Impact[] = [];
  const fixes: Fix[] = [];
  const flagged = new Set<ID>();
  let lostMoney = 0;
  /** Non-refundable money on bookings that disappear from the plan — still spent. */
  let sunk = 0;
  const name = (id: ID) => users.find((u) => u.id === id)?.name ?? 'Someone';
  const get = (id: ID) => twin.items.find((i) => i.id === id);

  for (const s of scenarios) {
    switch (s.kind) {
      case 'flightDelay': {
        const f = get(s.itemId);
        if (!f) break;
        const delay = s.hours * 60;
        const origStart = absStart(f);
        const newStartAbs = origStart + delay;
        f.day = Math.floor(newStartAbs / 1440);
        f.start = fromMin(newStartAbs);
        const arrival = absEnd(f);
        impacts.push({
          severity: s.hours >= 4 ? 'high' : 'medium',
          itemId: f.id,
          title: `${f.title} now arrives ${fromMin(arrival)}${arrival >= (Math.floor(origStart / 1440) + 1) * 1440 ? ' (next day)' : ''}`,
          detail: `${f.attendeeIds.length} traveler(s) affected. ${f.alternatives ? `${f.alternatives} alternative route(s) on file.` : 'No alternative routes saved.'}`,
        });
        if (f.alternatives) {
          fixes.push({ id: uid(), label: `Rebook on an alternative to ${f.title}`, detail: 'Check your saved alternative routes before accepting the delay.', costDelta: 0, resolves: [f.id], changes: [{ op: 'addTask', title: `Check alternative routes for ${f.title}` }] });
        }
        const conflicts = twin.items.filter(
          (g) =>
            g.id !== f.id &&
            g.kind !== 'lodging' &&
            absStart(g) >= origStart &&
            absStart(g) < arrival + BUFFER &&
            g.attendeeIds.some((a) => f.attendeeIds.includes(a)),
        );
        for (const g of conflicts) {
          if (flagged.has(g.id)) continue;
          flagged.add(g.id);
          if (g.flexible) {
            const slot = findSlot(twin, g, arrival + BUFFER);
            impacts.push({ severity: 'medium', itemId: g.id, title: `${g.title} overlaps the delay`, detail: 'This plan is flexible and can be moved.' });
            if (slot)
              fixes.push({ id: uid(), label: `Move ${g.title} to day ${slot.day + 1}, ${slot.start}`, detail: 'Next open slot for everyone attending.', costDelta: 0, changes: [{ op: 'update', itemId: g.id, patch: slot }] });
          } else if (g.refundable) {
            impacts.push({ severity: 'high', itemId: g.id, title: `You'll miss ${g.title}`, detail: `It's fixed-time but refundable — cancel to recover ${money(g.cost)}.` });
            fixes.push({ id: uid(), label: `Cancel ${g.title} & get refund`, detail: `Recovers ${money(g.cost)}.`, costDelta: -g.cost, changes: [{ op: 'remove', itemId: g.id }] });
          } else {
            lostMoney += g.cost;
            impacts.push({ severity: 'high', itemId: g.id, title: `You'll miss ${g.title}`, detail: `Fixed-time and non-refundable: ${money(g.cost)} lost.` });
            if (g.backup) {
              const slot = findSlot(twin, { ...g, durationMin: g.durationMin }, arrival + BUFFER);
              fixes.push({ id: uid(), label: `Do "${g.backup.title}" later instead`, detail: `Backup costs ${money(g.backup.cost)}.`, costDelta: g.backup.cost, resolves: [g.id], changes: [{ op: 'add', item: { ...g, id: uid(), title: g.backup.title, cost: g.backup.cost, ...(slot ?? {}), backup: undefined, refundable: true } }] });
            }
          }
          flagDependents(twin, g, impacts, flagged);
        }
        const tod = (arrival + BUFFER) % 1440; // time they'd actually reach the door
        const lodging = twin.items.find((l) => l.kind === 'lodging' && l.day <= Math.floor(arrival / 1440) && l.attendeeIds.some((a) => f.attendeeIds.includes(a)));
        if (lodging && (tod >= 22 * 60 || tod < 5 * 60)) {
          impacts.push({ severity: 'low', itemId: lodging.id, title: `Late check-in at ${lodging.title}`, detail: `Reaching the door around ${fromMin(arrival + BUFFER)}.` });
          fixes.push({ id: uid(), label: `Tell ${lodging.title} you'll arrive late`, detail: 'Adds a to-do to the group checklist.', costDelta: 0, resolves: [lodging.id], changes: [{ op: 'addTask', title: `Call ${lodging.title} about late check-in` }] });
        }
        break;
      }

      case 'dropout': {
        const out = new Set(s.userIds);
        const remaining = twin.memberIds.filter((id) => !out.has(id));
        if (!remaining.length) {
          impacts.push({ severity: 'high', title: 'Nobody is left on the trip', detail: 'Every booking would need to be cancelled.' });
          break;
        }
        const bal = balances(twin);
        for (const id of s.userIds) {
          if ((bal[id] ?? 0) < -1)
            fixes.push({ id: uid(), label: `Collect ${money(-bal[id])} from ${name(id)}`, detail: 'Settle shared expenses before they leave the trip.', costDelta: 0, changes: [{ op: 'addTask', title: `Collect ${money(-bal[id])} from ${name(id)}` }] });
          if ((bal[id] ?? 0) > 1)
            impacts.push({ severity: 'medium', title: `The group owes ${name(id)} ${money(bal[id])}`, detail: 'Settle up before removing them.' });
        }
        for (const it of twin.items) {
          const before = it.attendeeIds.length;
          const after = it.attendeeIds.filter((a) => !out.has(a));
          if (after.length === before || before === 0) continue;
          if (it.costType === 'perPerson') {
            const theirs = (it.cost / before) * (before - after.length);
            if (it.refundable) it.cost -= theirs;
            else {
              lostMoney += theirs;
              impacts.push({ severity: 'low', itemId: it.id, title: `${money(theirs)} in tickets wasted on ${it.title}`, detail: 'Non-refundable seats for people who dropped. Try reselling them.' });
            }
          } else if (after.length && it.cost > 0) {
            impacts.push({ severity: 'medium', itemId: it.id, title: `${it.title}: share rises ${money(it.cost / before)} → ${money(it.cost / after.length)}`, detail: `Fixed ${money(it.cost)} group price now split ${after.length} ways.` });
            if (it.backup && (it.backup.capacity ?? 99) >= after.length && it.backup.cost < it.cost && it.refundable)
              fixes.push({ id: uid(), label: `Downsize to ${it.backup.title}`, detail: `Saves ${money(it.cost - it.backup.cost)} for the smaller group.`, costDelta: it.backup.cost - it.cost, changes: [{ op: 'update', itemId: it.id, patch: { title: it.backup.title, cost: it.backup.cost, backup: { title: it.title, cost: it.cost, capacity: before } } }] });
          }
          if (it.minAttendees && after.length < it.minAttendees) {
            impacts.push({ severity: 'high', itemId: it.id, title: `${it.title} needs ${it.minAttendees} people`, detail: `Only ${after.length} remain.` });
            fixes.push(
              it.refundable
                ? { id: uid(), label: `Cancel ${it.title}`, detail: `Booking minimum no longer met. Recovers ${money(it.cost)}.`, costDelta: -it.cost, changes: [{ op: 'remove', itemId: it.id }] }
                : { id: uid(), label: `Invite friends to fill ${it.title}`, detail: 'Non-refundable — fill the open spots.', costDelta: 0, resolves: [it.id], changes: [{ op: 'addTask', title: `Find ${it.minAttendees - after.length} more for ${it.title}` }] },
            );
          }
          it.attendeeIds = after;
        }
        twin.memberIds = remaining;
        impacts.push({ severity: 'medium', title: `Group shrinks to ${remaining.length}`, detail: `${s.userIds.map(name).join(', ')} removed from every plan.` });
        break;
      }

      case 'lodgingCancel': {
        const l = get(s.itemId);
        if (!l) break;
        impacts.push({
          severity: 'high',
          itemId: l.id,
          title: `${l.title} cancelled`,
          detail: `${l.nights ?? 1} night(s) for ${l.attendeeIds.length} people with nowhere to stay. ${l.refundable ? `Expect a ${money(l.cost)} refund.` : `${money(l.cost)} is at risk — file a dispute.`}`,
        });
        if (!l.refundable) {
          lostMoney += l.cost;
          sunk += l.cost;
        }
        flagDependents(twin, l, impacts, flagged);
        twin.items = twin.items.filter((i) => i.id !== l.id);
        const replacement = (title: string, cost: number): ItineraryItem => ({ ...l, id: uid(), title, cost, backup: undefined, bookingRef: undefined });
        if (l.backup) {
          if ((l.backup.capacity ?? 99) < l.attendeeIds.length)
            impacts.push({ severity: 'medium', title: `Backup only fits ${l.backup.capacity}`, detail: `${l.backup.title} is too small for ${l.attendeeIds.length}.` });
          fixes.push({ id: uid(), label: `Rebook at ${l.backup.title}`, detail: `Your saved backup — ${money(l.backup.cost)}.`, costDelta: l.backup.cost - (l.refundable ? l.cost : 0), resolves: [l.id], changes: [{ op: 'add', item: replacement(l.backup.title, l.backup.cost) }] });
        } else {
          const est = Math.round(l.cost * 1.3);
          fixes.push({ id: uid(), label: 'Book last-minute replacement', detail: `No backup saved — last-minute rates run ~30% higher (≈${money(est)}).`, costDelta: est - (l.refundable ? l.cost : 0), resolves: [l.id], changes: [{ op: 'add', item: replacement('Replacement lodging (TBD)', est) }, { op: 'addTask', title: 'Find replacement lodging' }] });
        }
        break;
      }

      case 'rain': {
        const outdoor = twin.items.filter((i) => i.day === s.day && i.outdoor);
        if (!outdoor.length) {
          impacts.push({ severity: 'low', title: `No outdoor plans on day ${s.day + 1}`, detail: 'Rain will not change anything.' });
          break;
        }
        for (const it of outdoor) {
          if (it.backup) {
            impacts.push({ severity: 'medium', itemId: it.id, title: `${it.title} rained out`, detail: `Plan B ready: ${it.backup.title}.` });
            fixes.push({ id: uid(), label: `Swap to ${it.backup.title}`, detail: it.backup.cost === it.cost ? 'Same cost.' : `${money(it.backup.cost - it.cost)} cost change.`, costDelta: it.backup.cost - it.cost, changes: [{ op: 'update', itemId: it.id, patch: { title: it.backup.title, cost: it.backup.cost, outdoor: !it.backup.indoor, backup: { title: it.title, cost: it.cost } } }] });
          } else {
            impacts.push({ severity: 'high', itemId: it.id, title: `${it.title} rained out — no plan B`, detail: it.cost === 0 ? 'Free, but nothing planned to replace it.' : it.refundable ? 'Refundable, but you have nothing to replace it.' : `${money(it.cost)} non-refundable.` });
            if (!it.refundable) lostMoney += it.cost;
            const slot = it.flexible ? findSlot({ ...twin, items: twin.items }, it, (s.day + 1) * 1440) : null;
            if (slot)
              fixes.push({ id: uid(), label: `Move ${it.title} to day ${slot.day + 1}`, detail: `Open slot at ${slot.start}.`, costDelta: 0, changes: [{ op: 'update', itemId: it.id, patch: slot }] });
          }
        }
        break;
      }

      case 'budgetCut': {
        const newBudget = Math.round(twin.budget * (1 - s.percent / 100));
        twin.budget = newBudget;
        const cost = plannedCost(twin);
        if (cost <= newBudget) {
          impacts.push({ severity: 'low', title: `Still ${money(newBudget - cost)} under the new budget`, detail: `New cap ${money(newBudget)}.` });
          break;
        }
        const gap = cost - newBudget;
        impacts.push({ severity: 'high', key: 'budget', title: `${money(gap)} over the new ${money(newBudget)} budget`, detail: `That's ${money(gap / twin.memberIds.length)} per person.` });
        const options = twin.items
          .filter((i) => i.refundable && i.kind !== 'flight')
          .map((i) => {
            if (i.backup && i.backup.cost < i.cost)
              return { saving: i.cost - i.backup.cost, fix: { id: uid(), label: `Switch ${i.title} → ${i.backup.title}`, detail: `Saves ${money(i.cost - i.backup.cost)}.`, costDelta: i.backup.cost - i.cost, changes: [{ op: 'update', itemId: i.id, patch: { title: i.backup.title, cost: i.backup.cost, backup: { title: i.title, cost: i.cost } } }] as Change[] } };
            if (i.kind === 'activity' || i.kind === 'food')
              return { saving: i.cost, fix: { id: uid(), label: `Drop ${i.title}`, detail: `Saves ${money(i.cost)} (refundable).`, costDelta: -i.cost, changes: [{ op: 'remove', itemId: i.id }] as Change[] } };
            return null;
          })
          .filter((x): x is { saving: number; fix: Fix } => !!x && x.saving > 0)
          .sort((a, b) => b.saving - a.saving);
        let covered = 0;
        for (const o of options) {
          if (covered >= gap) break;
          fixes.push({ ...o.fix, resolves: ['budget', ...o.fix.changes.flatMap((c) => ('itemId' in c ? [c.itemId] : []))] });
          covered += o.saving;
        }
        if (covered < gap)
          impacts.push({ severity: 'high', title: `Cuts only cover ${money(covered)}`, detail: `${money(gap - covered)} still over. Most remaining spend is locked in.` });
        break;
      }
    }
  }

  const scoreBefore = computeResilience(trip).score;
  const fixed = applyChanges(twin, fixes.flatMap((f) => f.changes));
  // The hit lowers the score by its unresolved damage; adopting fixes wins points back.
  const resolved = new Set(fixes.flatMap((f) => f.resolves ?? f.changes.flatMap((c) => ('itemId' in c ? [c.itemId] : []))));
  const penalty = (onlyUnresolved: boolean) =>
    impacts.reduce((p, im) => {
      const key = im.key ?? im.itemId;
      if (onlyUnresolved && key && resolved.has(key)) return p;
      return p + PENALTY[im.severity];
    }, 0);
  const scoreAfter = Math.max(0, Math.min(scoreBefore, computeResilience(twin).score) - penalty(false));
  const scoreWithFixes = Math.max(scoreAfter, Math.min(100, computeResilience(fixed).score - penalty(true)));
  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  impacts.sort((a, b) => order[a.severity] - order[b.severity]);

  const costBefore = plannedCost(trip);
  // Cost after adopting the suggested Plan B, including money already sunk.
  const costAfter = plannedCost(fixed) + sunk;
  return {
    scenarios,
    impacts,
    fixes,
    twin,
    costBefore,
    costAfter,
    lostMoney: Math.round(lostMoney),
    perPersonBefore: costBefore / Math.max(1, trip.memberIds.length),
    perPersonAfter: costAfter / Math.max(1, twin.memberIds.length),
    budgetAfter: twin.budget,
    scoreBefore,
    scoreAfter,
    scoreWithFixes,
  };
}

/** Apply fix changes to a trip and return the new trip (tasks are added to the prep list). */
export function applyChanges(trip: Trip, changes: Change[]): Trip {
  const t = clone(trip);
  for (const c of changes) {
    if (c.op === 'update') t.items = t.items.map((i) => (i.id === c.itemId ? { ...i, ...c.patch } : i));
    else if (c.op === 'remove') t.items = t.items.filter((i) => i.id !== c.itemId);
    else if (c.op === 'add') t.items.push(c.item);
    else if (c.op === 'addTask') t.tasks.push({ id: uid(), title: c.title, done: false, list: 'prep' });
  }
  return t;
}

/** Default "stress test": run each classic disruption on its own and rank them. */
export function stressTest(trip: Trip, users: User[]) {
  const scenarios: Scenario[] = [];
  const flight = [...trip.items].filter((i) => i.kind === 'flight').sort((a, b) => absStart(a) - absStart(b))[0];
  if (flight) scenarios.push({ kind: 'flightDelay', itemId: flight.id, hours: 6 });
  const drop = trip.memberIds.filter((id) => id !== trip.ownerId).slice(0, Math.max(1, Math.floor(trip.memberIds.length / 3)));
  if (trip.memberIds.length > 1) scenarios.push({ kind: 'dropout', userIds: drop });
  const lodging = trip.items.find((i) => i.kind === 'lodging');
  if (lodging) scenarios.push({ kind: 'lodgingCancel', itemId: lodging.id });
  let rainDay = 0;
  let most = -1;
  for (let d = 0; d < trip.days; d++) {
    const n = trip.items.filter((i) => i.day === d && i.outdoor).length;
    if (n > most) [most, rainDay] = [n, d];
  }
  scenarios.push({ kind: 'rain', day: rainDay });
  scenarios.push({ kind: 'budgetCut', percent: 20 });
  return scenarios
    .map((s) => {
      const r = simulate(trip, [s], users);
      const high = r.impacts.filter((i) => i.severity === 'high').length;
      return { scenario: s, label: describeScenario(s, trip, users), result: r, high, damage: high * 10 + r.lostMoney / 50 + Math.max(0, r.costAfter - r.budgetAfter) / 50 };
    })
    .sort((a, b) => b.damage - a.damage);
}
