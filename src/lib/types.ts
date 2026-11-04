export type ID = string;

export interface User {
  id: ID;
  name: string;
  color: string;
}

export type ItemKind = 'flight' | 'transport' | 'lodging' | 'activity' | 'food';

/** A cheaper / indoor / alternative version of an itinerary item. */
export interface Backup {
  title: string;
  cost: number;
  indoor?: boolean;
  /** For lodging: how many people it fits. */
  capacity?: number;
}

export interface ItineraryItem {
  id: ID;
  title: string;
  kind: ItemKind;
  /** 0-based day of the trip. Lodging spans `nights` from this day. */
  day: number;
  /** "HH:MM" 24h */
  start: string;
  durationMin: number;
  /** Total cost of the item for everyone attending. */
  cost: number;
  /** 'group' = one fixed price shared (rental car, house); 'perPerson' = cost scales with headcount. */
  costType: 'group' | 'perPerson';
  attendeeIds: ID[];
  location?: string;
  bookingRef?: string;
  outdoor?: boolean;
  refundable?: boolean;
  /** Can this item be moved to another time? */
  flexible?: boolean;
  /** Number of alternative routes/carriers if this is transport. */
  alternatives?: number;
  /** Items that must happen first for this item to work (e.g. a tour that needs the rental car). */
  dependsOn?: ID[];
  backup?: Backup;
  /** Lodging only */
  nights?: number;
  /** Minimum group size the booking requires. */
  minAttendees?: number;
  notes?: string;
}

export interface Expense {
  id: ID;
  title: string;
  amount: number;
  paidById: ID;
  splitAmongIds: ID[];
  category: 'lodging' | 'transport' | 'food' | 'activities' | 'other';
  createdAt: number;
}

export interface Message {
  id: ID;
  authorId: ID | 'system';
  text: string;
  createdAt: number;
}

export interface PollOption {
  id: ID;
  label: string;
  voterIds: ID[];
}

export interface Poll {
  id: ID;
  question: string;
  authorId: ID;
  options: PollOption[];
  closed?: boolean;
  createdAt: number;
}

export interface Task {
  id: ID;
  title: string;
  assigneeId?: ID;
  done: boolean;
  /** 'prep' tasks before the trip, 'packing' list items */
  list: 'prep' | 'packing';
}

export interface Playbook {
  id: ID;
  title: string;
  authorId: ID;
  steps: string[];
  createdAt: number;
}

export type TripPhase = 'planning' | 'active' | 'complete';

export interface Trip {
  id: ID;
  name: string;
  destination: string;
  /** yyyy-mm-dd */
  startDate: string;
  days: number;
  joinCode: string;
  phase: TripPhase;
  ownerId: ID;
  memberIds: ID[];
  budget: number;
  items: ItineraryItem[];
  expenses: Expense[];
  messages: Message[];
  polls: Poll[];
  tasks: Task[];
  /** Saved Plan B playbooks from the simulator, shared with the group. */
  playbooks: Playbook[];
  /** Scores over time so the group can see resilience improve. */
  scoreHistory: { at: number; score: number }[];
}

export interface AppState {
  users: User[];
  currentUserId: ID;
  trips: Trip[];
}
