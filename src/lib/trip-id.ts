import { createContext, useContext } from 'react';

/**
 * The trip id from /trip/[id], provided by the trip tab layout.
 * Tab screens read it from here because Expo Router does not reliably
 * pass the parent `[id]` param to sibling tabs when switching between them.
 */
export const TripIdContext = createContext<string>('');
export const useTripId = () => useContext(TripIdContext);
