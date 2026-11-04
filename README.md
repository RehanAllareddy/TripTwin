# TripTwin

**Don't just plan your trip. Test it before you take it.**

TripTwin is a group trip planner built around a *digital twin* of your trip. Your group plans everything together: itinerary, budget, chat, polls and checklists. Every booking, dependency and backup feeds a model you can stress test with "what if" scenarios before anything goes wrong.

## Run it

```bash
npm install
npx expo start      # then press i (iOS), a (Android) or w (web), or scan the QR code with Expo Go
```

The app opens with a sample trip, **Lisbon Spring Break** (6 travelers, 5 days), so every feature can be demoed right away. Tap your profile circle (top left of the home screen) to edit your name and avatar or sign out. Under **Demo tools** you can act as another traveler to show multi-user collaboration from one device, or reset the sample trip.

## Sign-in setup (Firebase)

1. Firebase console → **Project settings → General → Your apps** → add a **Web app** if you haven't, then copy its config into `src/lib/firebase-config.ts`.
2. **Authentication → Sign-in method**: enable **Google** and **Email/Password**.
3. **Authentication → Settings → Authorized domains**: add your Vercel domain (e.g. `triptwin.vercel.app`). `localhost` is there by default.
4. Optional, for Google sign-in inside the iOS/Android app: put OAuth client IDs in `googleClientIds` in the same file. Email sign-in and the website don't need them.

Without a config the app still runs: the login page offers **Try the demo without an account**.

## How it meets the "Together We Go" rubric

| Rubric area | TripTwin feature |
|---|---|
| **Multiple users** | Join a trip with a 6-character code; switch travelers; every message, vote, expense and simulation is attributed to a person |
| **Collaboration** | Shared itinerary anyone can edit; group polls with live tallies, "waiting on" lists and a final decision; Plan B playbooks the whole group can see |
| **Communication** | Group chat, plus automatic system updates when plans, budgets, polls or disruptions change |
| **Scheduling** | Day-by-day itinerary, per-person "only mine" view, automatic schedule-conflict detection, attendee assignment per plan |
| **Budgeting** | Group budget vs. planned cost, each person's share, expense splitting, category breakdown, balances, and fewest-payments settle-up |
| **Organization** | Confirmation vault (every booking number in one place), assigned prep to-dos, shared packing list |
| **Trip management, planning → completion** | Lifecycle: **Plan → Travel → Wrap up**. Travel mode shows today's schedule and a live "report a disruption" flow; Wrap up shows a recap and remaining settle-ups |

## Signature features

### Trip Resilience Score (0–100)
Averages five factors, each explained, with tips that show how many points they add:
- **Schedule flexibility**: share of plans that can move, plus buffers between back-to-back plans
- **Budget flexibility**: headroom under the cap, plus how much spend is refundable
- **Transportation alternatives**: backup routes saved for each flight or transport leg
- **Reservation dependencies**: how many bookings rely on others, and the longest chain
- **Backup activities**: outdoor plans and lodging that have a Plan B

### The Twin simulator
Simulate one disruption, or stack several together:
- Flight delayed *N* hours: finds overlaps, moves flexible plans, flags missed non-refundable bookings and dependent plans, and warns about late check-in
- People drop out: per-person cost increases on fixed group prices, wasted non-refundable seats, booking minimums no longer met, and money to collect before they leave
- Lodging cancelled: nights left uncovered, refunds versus money at risk, rebooking at the saved backup or an estimated last-minute rate
- Rain on day *N*: outdoor plans rained out, swapping to indoor backups, moving to an open slot
- Budget cut *X*%: the shortfall, and the smallest set of refundable cuts or swaps that covers it

Each simulation shows the score **now → after the hit → with fixes**, money at risk, per-person cost and budget status. The group can then:
- **Save as group Plan B**: posts a playbook to chat so everyone knows what to do
- **Apply to the real trip**: in Travel mode, applies the change and the chosen fixes to the real plan in one tap

**Stress test** runs all five classic disruptions and ranks which would hurt this trip most.

## Tech
Expo SDK 58 / React Native / TypeScript / Expo Router. Data is stored on the device with AsyncStorage, so demos work offline. The simulation engine is pure TypeScript in `src/lib/` (`simulate.ts`, `resilience.ts`, `budget.ts`), so it could move to a server or be unit-tested on its own.
