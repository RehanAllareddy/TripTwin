import type { ID, Trip } from './types';

/** Positive = the group owes this person; negative = this person owes the group. */
export function balances(trip: Trip): Record<ID, number> {
  const bal: Record<ID, number> = Object.fromEntries(trip.memberIds.map((id) => [id, 0]));
  for (const e of trip.expenses) {
    const split = e.splitAmongIds.length ? e.splitAmongIds : trip.memberIds;
    bal[e.paidById] = (bal[e.paidById] ?? 0) + e.amount;
    const share = e.amount / split.length;
    for (const id of split) bal[id] = (bal[id] ?? 0) - share;
  }
  return bal;
}

export interface Transfer {
  fromId: ID;
  toId: ID;
  amount: number;
}

/** Greedy minimum set of payments that settles everyone up. */
export function settleUp(trip: Trip): Transfer[] {
  const bal = balances(trip);
  const debtors = Object.entries(bal).filter(([, v]) => v < -0.5).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v);
  const creditors = Object.entries(bal).filter(([, v]) => v > 0.5).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[j].v);
    out.push({ fromId: debtors[i].id, toId: creditors[j].id, amount: Math.round(amt * 100) / 100 });
    debtors[i].v -= amt;
    creditors[j].v -= amt;
    if (debtors[i].v < 0.5) i++;
    if (creditors[j].v < 0.5) j++;
  }
  return out;
}

export const spent = (trip: Trip) => trip.expenses.reduce((s, e) => s + e.amount, 0);

export function spentByCategory(trip: Trip) {
  const out: Record<string, number> = {};
  for (const e of trip.expenses) out[e.category] = (out[e.category] ?? 0) + e.amount;
  return out;
}
