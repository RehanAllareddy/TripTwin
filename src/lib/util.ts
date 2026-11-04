import type { ItineraryItem, Trip } from './types';

export const uid = () => Math.random().toString(36).slice(2, 10);

export const joinCode = () =>
  Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const fromMin = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export const fmtTime = (hhmm: string) => {
  const m = toMin(hhmm);
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  return `${((h + 11) % 12) + 1}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
};

/** Absolute minutes from trip start — lets us compare across days. */
export const absStart = (it: Pick<ItineraryItem, 'day' | 'start'>) => it.day * 1440 + toMin(it.start);
export const absEnd = (it: ItineraryItem) => absStart(it) + it.durationMin;

export const money = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export const dayDate = (trip: Trip, day: number) => {
  const d = new Date(trip.startDate + 'T12:00:00');
  d.setDate(d.getDate() + day);
  return d;
};

export const dayLabel = (trip: Trip, day: number) =>
  dayDate(trip, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export const daysUntil = (trip: Trip) => {
  const start = new Date(trip.startDate + 'T00:00:00').getTime();
  return Math.ceil((start - Date.now()) / 86400000);
};

export const sortItems = (items: ItineraryItem[]) => [...items].sort((a, b) => absStart(a) - absStart(b));

export const plannedCost = (trip: Trip) => trip.items.reduce((s, i) => s + i.cost, 0);

export const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

export const KIND_ICON: Record<ItineraryItem['kind'], string> = {
  flight: 'airplane',
  transport: 'car',
  lodging: 'bed',
  activity: 'compass',
  food: 'restaurant',
};
