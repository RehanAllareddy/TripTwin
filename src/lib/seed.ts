import type { AppState, ItineraryItem, Trip, User } from './types';

export const SEED_USERS: User[] = [
  { id: 'u-maya', name: 'Maya', color: '#6366F1' },
  { id: 'u-jordan', name: 'Jordan', color: '#F97316' },
  { id: 'u-priya', name: 'Priya', color: '#14B8A6' },
  { id: 'u-leo', name: 'Leo', color: '#EF4444' },
  { id: 'u-sam', name: 'Sam', color: '#EAB308' },
  { id: 'u-ava', name: 'Ava', color: '#A855F7' },
];

const ALL = SEED_USERS.map((u) => u.id);

const items: ItineraryItem[] = [
  { id: 'i-fly-out', title: 'TAP 210 JFK → LIS', kind: 'flight', day: 0, start: '08:00', durationMin: 420, cost: 1950, costType: 'perPerson', attendeeIds: ALL, bookingRef: 'TP8KQ2', alternatives: 2, location: 'JFK Terminal 1' },
  { id: 'i-transfer', title: 'Airport van to Alfama', kind: 'transport', day: 0, start: '15:45', durationMin: 45, cost: 90, costType: 'group', attendeeIds: ALL, refundable: true, flexible: true, alternatives: 3, dependsOn: ['i-fly-out'] },
  { id: 'i-house', title: 'Alfama Townhouse', kind: 'lodging', day: 0, start: '16:30', durationMin: 60, nights: 5, cost: 2400, costType: 'group', attendeeIds: ALL, bookingRef: 'HMX4P9TQ', location: 'Rua de São Miguel 12', backup: { title: 'Lisboa Central — 3 private rooms', cost: 1500, capacity: 6 } },
  { id: 'i-dinner', title: 'Welcome dinner at Time Out Market', kind: 'food', day: 0, start: '17:30', durationMin: 120, cost: 240, costType: 'perPerson', attendeeIds: ALL, refundable: true, flexible: true },
  { id: 'i-tram', title: 'Tram 28 & Alfama walking tour', kind: 'activity', day: 1, start: '10:00', durationMin: 180, cost: 150, costType: 'perPerson', attendeeIds: ALL, outdoor: true, refundable: true, flexible: true, minAttendees: 4, backup: { title: 'National Tile Museum', cost: 60, indoor: true } },
  { id: 'i-fado', title: 'Fado night in Bairro Alto', kind: 'activity', day: 1, start: '21:00', durationMin: 120, cost: 300, costType: 'perPerson', attendeeIds: ALL, bookingRef: 'FADO-221' },
  { id: 'i-car', title: 'Rental car pickup', kind: 'transport', day: 2, start: '08:30', durationMin: 30, cost: 220, costType: 'group', attendeeIds: ALL, refundable: true, alternatives: 1, bookingRef: 'EUR-55710' },
  { id: 'i-sintra', title: 'Sintra palaces day trip', kind: 'activity', day: 2, start: '09:15', durationMin: 420, cost: 330, costType: 'perPerson', attendeeIds: ALL, outdoor: true, dependsOn: ['i-car'], bookingRef: 'PSML-90321' },
  { id: 'i-cascais', title: 'Cascais sunset beach', kind: 'activity', day: 2, start: '17:00', durationMin: 120, cost: 0, costType: 'group', attendeeIds: ALL, outdoor: true, flexible: true, dependsOn: ['i-sintra'] },
  { id: 'i-surf', title: 'Surf lesson in Ericeira', kind: 'activity', day: 3, start: '10:00', durationMin: 180, cost: 420, costType: 'perPerson', attendeeIds: ['u-maya', 'u-jordan', 'u-leo', 'u-sam', 'u-ava'], outdoor: true, refundable: true, flexible: true, minAttendees: 4, dependsOn: ['i-car'], backup: { title: 'Lisbon Bouldering Gym', cost: 180, indoor: true } },
  { id: 'i-lx', title: 'LX Factory & food crawl', kind: 'food', day: 3, start: '16:00', durationMin: 180, cost: 210, costType: 'perPerson', attendeeIds: ALL, refundable: true, flexible: true },
  { id: 'i-car-return', title: 'Rental car return', kind: 'transport', day: 4, start: '09:30', durationMin: 30, cost: 0, costType: 'group', attendeeIds: ['u-leo'], flexible: true, alternatives: 1, dependsOn: ['i-car'] },
  { id: 'i-fly-home', title: 'TAP 209 LIS → JFK', kind: 'flight', day: 4, start: '13:00', durationMin: 480, cost: 1950, costType: 'perPerson', attendeeIds: ALL, bookingRef: 'TP8KQ2', alternatives: 1 },
];

const now = Date.now();
const H = 3600000;

export const SEED_TRIP: Trip = {
  id: 't-lisbon',
  name: 'Lisbon Spring Break',
  destination: 'Lisbon, Portugal',
  startDate: '2027-03-20',
  days: 5,
  joinCode: 'LIS27X',
  phase: 'planning',
  ownerId: 'u-maya',
  memberIds: ALL,
  budget: 9000,
  items,
  expenses: [
    { id: 'e1', title: 'Alfama Townhouse (5 nights)', amount: 2400, paidById: 'u-maya', splitAmongIds: ALL, category: 'lodging', createdAt: now - 72 * H },
    { id: 'e2', title: 'Round-trip flights ×6', amount: 3900, paidById: 'u-jordan', splitAmongIds: ALL, category: 'transport', createdAt: now - 70 * H },
    { id: 'e3', title: 'Fado tickets', amount: 300, paidById: 'u-priya', splitAmongIds: ALL, category: 'activities', createdAt: now - 30 * H },
    { id: 'e4', title: 'Surf lesson deposit', amount: 200, paidById: 'u-leo', splitAmongIds: ['u-maya', 'u-jordan', 'u-leo', 'u-sam', 'u-ava'], category: 'activities', createdAt: now - 20 * H },
  ],
  messages: [
    { id: 'm1', authorId: 'u-maya', text: 'Townhouse is booked! 🏠 Confirmation is in the Plan tab.', createdAt: now - 72 * H },
    { id: 'm2', authorId: 'u-jordan', text: 'Flights done too. Everyone Venmo me $650 when you can 🙏', createdAt: now - 70 * H },
    { id: 'm3', authorId: 'u-priya', text: "I'm skipping surf, I'll meet you all at LX Factory", createdAt: now - 25 * H },
    { id: 'm4', authorId: 'system', text: 'Leo ran a stress test: the trip scored 51 (Shaky). Rain on day 3 is the biggest risk.', createdAt: now - 4 * H },
    { id: 'm5', authorId: 'u-leo', text: 'Sintra has no rain plan and the tickets are non-refundable 😬 can someone look into it?', createdAt: now - 3 * H },
  ],
  polls: [
    {
      id: 'p1',
      question: 'Last night: what should we do?',
      authorId: 'u-ava',
      createdAt: now - 10 * H,
      options: [
        { id: 'o1', label: 'Rooftop bar in Chiado', voterIds: ['u-ava', 'u-sam'] },
        { id: 'o2', label: 'Sunset cruise on the Tagus', voterIds: ['u-maya', 'u-priya', 'u-leo'] },
        { id: 'o3', label: 'Early night before the flight', voterIds: [] },
      ],
    },
  ],
  tasks: [
    { id: 'k1', title: 'Book Sintra palace tickets', assigneeId: 'u-priya', done: true, list: 'prep' },
    { id: 'k2', title: 'Renew passport', assigneeId: 'u-sam', done: false, list: 'prep' },
    { id: 'k3', title: 'Buy travel insurance', assigneeId: 'u-maya', done: false, list: 'prep' },
    { id: 'k4', title: "Add Leo as rental car driver", assigneeId: 'u-leo', done: false, list: 'prep' },
    { id: 'k5', title: 'EU power adapters (Type F)', done: false, list: 'packing' },
    { id: 'k6', title: 'Rain jackets', done: false, list: 'packing' },
    { id: 'k7', title: 'Comfy walking shoes (the hills!)', done: true, list: 'packing' },
  ],
  playbooks: [],
  scoreHistory: [],
};

export const seedState = (): AppState => ({
  users: SEED_USERS,
  currentUserId: 'u-maya',
  trips: [JSON.parse(JSON.stringify(SEED_TRIP))],
});
