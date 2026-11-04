import type { ItineraryItem, Trip } from './types';
import { absEnd, absStart, clamp, plannedCost, sortItems } from './util';

export interface Factor {
  key: 'schedule' | 'budget' | 'transport' | 'dependencies' | 'backups';
  label: string;
  score: number; // 0-100
  summary: string;
}

export interface Tip {
  factor: Factor['key'];
  text: string;
  itemId?: string;
  /** Rough number of points this would add to the overall score. */
  gain: number;
}

export interface SetupStep {
  key: 'travel' | 'stay' | 'activities' | 'budget';
  label: string;
  hint: string;
  done: boolean;
}

export interface Resilience {
  /** False until the trip has enough in it for the score to mean anything. */
  ready: boolean;
  /** What's still missing before we can score the trip honestly. */
  setup: SetupStep[];
  score: number;
  grade: 'Fragile' | 'Shaky' | 'Steady' | 'Resilient' | 'Bulletproof';
  factors: Factor[];
  tips: Tip[];
}

const BUFFER_MIN = 45;

export function gradeFor(score: number): Resilience['grade'] {
  if (score >= 90) return 'Bulletproof';
  if (score >= 75) return 'Resilient';
  if (score >= 60) return 'Steady';
  if (score >= 40) return 'Shaky';
  return 'Fragile';
}

/** Longest chain of `dependsOn` links ending at `id`. */
function chainLength(id: string, byId: Map<string, ItineraryItem>, seen = new Set<string>()): number {
  const it = byId.get(id);
  if (!it || seen.has(id) || !it.dependsOn?.length) return 1;
  seen.add(id);
  return 1 + Math.max(...it.dependsOn.map((d) => chainLength(d, byId, seen)));
}

/**
 * A trip with nothing in it would otherwise score a perfect 100 (nothing can go wrong
 * with no plans). We only score once the core of a trip exists.
 */
export function setupSteps(trip: Trip): SetupStep[] {
  const has = (k: ItineraryItem['kind'][]) => trip.items.filter((i) => k.includes(i.kind)).length;
  const steps: SetupStep[] = [
    { key: 'travel', label: 'Add how you are getting there', hint: 'A flight, train or drive', done: has(['flight', 'transport']) > 0 },
    { key: 'stay', label: "Add where you're staying", hint: 'Hotel, rental or friend’s place', done: trip.days <= 1 || has(['lodging']) > 0 },
    { key: 'activities', label: 'Add at least 2 things to do', hint: `Activities or meals (${Math.min(2, has(['activity', 'food']))} of 2)`, done: has(['activity', 'food']) >= 2 },
    { key: 'budget', label: 'Set a group budget', hint: 'So we can tell if you can afford surprises', done: trip.budget > 0 },
  ];
  return steps;
}

export function computeResilience(trip: Trip): Resilience {
  const setup = setupSteps(trip);
  const ready = setup.every((s) => s.done);
  const items = sortItems(trip.items);
  const tips: Tip[] = [];
  const timed = items.filter((i) => i.kind !== 'lodging');

  // 1. Schedule flexibility — movable items + breathing room between back-to-back plans.
  const flexShare = timed.length ? timed.filter((i) => i.flexible).length / timed.length : 1;
  let gaps = 0;
  let tightGaps = 0;
  for (let i = 1; i < timed.length; i++) {
    const prev = timed[i - 1];
    const cur = timed[i];
    if (prev.day !== cur.day) continue;
    gaps++;
    if (absStart(cur) - absEnd(prev) < BUFFER_MIN) {
      tightGaps++;
      if (tightGaps <= 2)
        tips.push({ factor: 'schedule', itemId: cur.id, gain: 3, text: `Add a ${BUFFER_MIN}-min buffer before "${cur.title}" — it starts right after "${prev.title}".` });
    }
  }
  const bufferShare = gaps ? 1 - tightGaps / gaps : 1;
  const schedule = Math.round(100 * (0.5 * flexShare + 0.5 * bufferShare));
  timed.filter((i) => !i.flexible && i.kind === 'activity').slice(0, 1).forEach((i) =>
    tips.push({ factor: 'schedule', itemId: i.id, gain: 2, text: `Ask if "${i.title}" can be rescheduled — it's locked to one time slot.` }),
  );

  // 2. Budget flexibility — headroom under the cap + how much spend is refundable.
  const cost = plannedCost(trip);
  const headroom = trip.budget > 0 ? (trip.budget - cost) / trip.budget : 0;
  const refundableShare = cost ? items.filter((i) => i.refundable).reduce((s, i) => s + i.cost, 0) / cost : 1;
  const budget = Math.round(100 * (0.6 * clamp(headroom / 0.15) + 0.4 * refundableShare));
  if (headroom < 0.1)
    tips.push({ factor: 'budget', gain: 5, text: `Only ${Math.round(headroom * 100)}% budget headroom. Aim for 10–15% to absorb surprises.` });
  const bigLocked = items.filter((i) => !i.refundable && i.cost > 0).sort((a, b) => b.cost - a.cost)[0];
  if (bigLocked)
    tips.push({ factor: 'budget', itemId: bigLocked.id, gain: 3, text: `"${bigLocked.title}" is your biggest non-refundable cost. Look for a free-cancellation rate.` });

  // 3. Transportation alternatives.
  const transport = items.filter((i) => i.kind === 'flight' || i.kind === 'transport');
  const transportScore = transport.length
    ? Math.round((100 * transport.reduce((s, i) => s + Math.min(i.alternatives ?? 0, 3) / 3, 0)) / transport.length)
    : 100;
  transport.filter((i) => (i.alternatives ?? 0) < 2).slice(0, 2).forEach((i) =>
    tips.push({ factor: 'transport', itemId: i.id, gain: 3, text: `"${i.title}" has ${i.alternatives ?? 0} backup route(s). Save a second option.` }),
  );

  // 4. Reservation dependencies — long chains mean one failure topples many plans.
  const byId = new Map(items.map((i) => [i.id, i]));
  const dependent = items.filter((i) => i.dependsOn?.length);
  const longest = items.reduce((m, i) => Math.max(m, chainLength(i.id, byId)), 1);
  const dependencies = Math.round(100 * clamp(1 - (items.length ? dependent.length / items.length : 0) * 1.2 - (longest - 1) * 0.12));
  if (longest >= 3) {
    const tail = items.find((i) => chainLength(i.id, byId) === longest);
    tips.push({ factor: 'dependencies', itemId: tail?.id, gain: 4, text: `${longest} bookings depend on each other in a chain ending at "${tail?.title}". Break the chain with a fallback.` });
  }

  // 5. Backup activities — outdoor plans and lodging should have a plan B.
  const needsBackup = items.filter((i) => i.outdoor || i.kind === 'lodging');
  const backups = needsBackup.length
    ? Math.round((100 * needsBackup.filter((i) => i.backup).length) / needsBackup.length)
    : 100;
  needsBackup.filter((i) => !i.backup).slice(0, 3).forEach((i) =>
    tips.push({ factor: 'backups', itemId: i.id, gain: 4, text: i.outdoor ? `Add an indoor backup for "${i.title}" in case of rain.` : `Save a backup place to stay in case "${i.title}" falls through.` }),
  );

  const factors: Factor[] = [
    { key: 'schedule', label: 'Schedule flexibility', score: schedule, summary: `${Math.round(flexShare * 100)}% of plans movable · ${tightGaps} tight gap(s)` },
    { key: 'budget', label: 'Budget flexibility', score: budget, summary: `${Math.round(headroom * 100)}% headroom · ${Math.round(refundableShare * 100)}% refundable` },
    { key: 'transport', label: 'Transport alternatives', score: transportScore, summary: `${transport.length} leg(s) checked for backup routes` },
    { key: 'dependencies', label: 'Reservation dependencies', score: dependencies, summary: `${dependent.length} dependent booking(s) · longest chain ${longest}` },
    { key: 'backups', label: 'Backup activities', score: backups, summary: `${needsBackup.filter((i) => i.backup).length}/${needsBackup.length} risky plans have a plan B` },
  ];
  const score = Math.round(factors.reduce((s, f) => s + f.score, 0) / factors.length);
  tips.sort((a, b) => b.gain - a.gain);
  return { ready, setup, score, grade: gradeFor(score), factors, tips };
}
