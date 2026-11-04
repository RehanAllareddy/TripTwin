import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { computeResilience } from './resilience';
import { seedState } from './seed';
import type { AppState, ID, Trip, User } from './types';
import { joinCode, uid } from './util';

const KEY = 'triptwin/state/v1';
const COLORS = ['#6366F1', '#F97316', '#14B8A6', '#EF4444', '#EAB308', '#A855F7', '#0EA5E9', '#22C55E'];

interface Store {
  ready: boolean;
  state: AppState;
  me: User;
  user: (id: ID) => User | undefined;
  trip: (id: ID) => Trip | undefined;
  updateTrip: (id: ID, fn: (t: Trip) => Trip) => void;
  createTrip: (input: Pick<Trip, 'name' | 'destination' | 'startDate' | 'days' | 'budget'>) => ID;
  joinTrip: (code: string) => ID | null;
  switchUser: (id: ID) => void;
  addUser: (name: string) => ID;
  /** Create or refresh a signed-in account's profile and make it the current user. */
  signInAs: (u: Pick<User, 'id' | 'name' | 'email' | 'photoURL'>) => void;
  updateUser: (id: ID, patch: Partial<Omit<User, 'id'>>) => void;
  /** Post a message into a trip's group chat as the current user (or the system). */
  post: (tripId: ID, text: string, asSystem?: boolean) => void;
  resetDemo: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(seedState);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setState(JSON.parse(raw)))
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  const updateTrip = useCallback((id: ID, fn: (t: Trip) => Trip) => {
    setState((s) => ({
      ...s,
      trips: s.trips.map((t) => {
        if (t.id !== id) return t;
        const next = fn(t);
        // Track resilience over time whenever the plan changes.
        const r = computeResilience(next);
        const last = next.scoreHistory[next.scoreHistory.length - 1];
        if (!r.ready || last?.score === r.score) return next;
        return { ...next, scoreHistory: [...next.scoreHistory, { at: Date.now(), score: r.score }].slice(-30) };
      }),
    }));
  }, []);

  const signInAs = useCallback(
    (u: Pick<User, 'id' | 'name' | 'email' | 'photoURL'>) =>
      setState((s) => {
        const existing = s.users.find((x) => x.id === u.id);
        const users = existing
          ? s.users.map((x) => (x.id === u.id ? { ...x, email: u.email, photoURL: u.photoURL ?? x.photoURL, name: x.name || u.name } : x))
          : [...s.users, { ...u, color: COLORS[s.users.length % COLORS.length] }];
        return { ...s, users, currentUserId: u.id };
      }),
    [],
  );

  const store = useMemo<Store>(() => {
    const me = state.users.find((u) => u.id === state.currentUserId) ?? state.users[0];
    return {
      ready,
      state,
      me,
      user: (id) => state.users.find((u) => u.id === id),
      trip: (id) => state.trips.find((t) => t.id === id),
      updateTrip,
      createTrip: (input) => {
        const id = uid();
        const trip: Trip = {
          ...input,
          id,
          joinCode: joinCode(),
          phase: 'planning',
          ownerId: me.id,
          memberIds: [me.id],
          items: [],
          expenses: [],
          polls: [],
          tasks: [],
          playbooks: [],
          scoreHistory: [],
          messages: [{ id: uid(), authorId: 'system', text: `${me.name} created the trip. Share the join code to invite your group.`, createdAt: Date.now() }],
        };
        setState((s) => ({ ...s, trips: [trip, ...s.trips] }));
        return id;
      },
      joinTrip: (code) => {
        const t = state.trips.find((x) => x.joinCode.toUpperCase() === code.trim().toUpperCase());
        if (!t) return null;
        if (!t.memberIds.includes(me.id))
          updateTrip(t.id, (x) => ({
            ...x,
            memberIds: [...x.memberIds, me.id],
            messages: [...x.messages, { id: uid(), authorId: 'system', text: `${me.name} joined the trip 👋`, createdAt: Date.now() }],
          }));
        return t.id;
      },
      switchUser: (id) => setState((s) => ({ ...s, currentUserId: id })),
      addUser: (name) => {
        const id = uid();
        setState((s) => ({ ...s, users: [...s.users, { id, name, color: COLORS[s.users.length % COLORS.length] }], currentUserId: id }));
        return id;
      },
      signInAs,
      updateUser: (id, patch) => setState((s) => ({ ...s, users: s.users.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
      post: (tripId, text, asSystem) =>
        updateTrip(tripId, (t) => ({ ...t, messages: [...t.messages, { id: uid(), authorId: asSystem ? 'system' : me.id, text, createdAt: Date.now() }] })),
      resetDemo: () =>
        setState((s) => {
          // Keep real accounts when restoring the sample trip.
          const fresh = seedState();
          const accounts = s.users.filter((u) => !fresh.users.some((f) => f.id === u.id) && u.email);
          const current = accounts.find((u) => u.id === s.currentUserId);
          return { ...fresh, users: [...fresh.users, ...accounts], currentUserId: current?.id ?? fresh.currentUserId };
        }),
    };
  }, [state, ready, updateTrip, signInAs]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

/** Convenience hook for screens under /trip/[id]. */
export function useTrip(id: ID) {
  const store = useStore();
  const trip = store.trip(id);
  const update = useCallback((fn: (t: Trip) => Trip) => store.updateTrip(id, fn), [store, id]);
  return { ...store, t: trip, update };
}
