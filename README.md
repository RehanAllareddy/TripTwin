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

## Explore: 3D globe, Google ratings and 360° Street View

Open **Explore the world** on the home screen. Spin the globe, search **any place** (city, address, restaurant, landmark; typos are fine), see Google Maps ratings, and tap any dot or anywhere on the globe to stand there in Street View.

- **With the browser key:** search uses Google's Places UI Kit autocomplete (any place worldwide), and 360° views open in TripTwin's full-screen viewer.
- **Without keys:** search covers the ~100 featured places with typo tolerance ("barcelna" → Barcelona), and Street View opens in Google Maps.

### One-time setup

1. **Google Cloud project with billing**, then enable:
   - **Places UI Kit** (`placewidgets.googleapis.com`) and **Maps JavaScript API**: search any place, ratings and place cards
   - **Maps Embed API**: the 360° viewer
   - **Street View Static API**: Street View coverage checks (metadata only, free)
   - **Places API (New)**: only for the verification script's Place ID lookups (IDs-only, free)
2. **Create two API keys** (Credentials → Create credentials → API key):
   - **Browser key** → `EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`
     - Application restriction: *Websites*: `https://YOUR-APP.vercel.app/*`, `https://*-YOUR-TEAM.vercel.app/*` (previews), `http://localhost:8081/*`
     - API restriction: Places UI Kit, Maps JavaScript API, Maps Embed API
   - **Server key** → `GOOGLE_MAPS_SERVER_KEY`
     - Application restriction: none (Vercel has no fixed IPs), so **API restriction is essential**: Street View Static API + Places API (New) only
3. **Set quota caps** (APIs & Services → each API → Quotas) so costs can't run away, e.g. Places UI Kit 1,000/day. Add a billing budget alert. Search is billed per session ("Places UI Kit - Autocomplete Per Session": 10,000 free/month, then about $10 per 1,000).
4. **Environment variables:** copy `.env.example` to `.env.local` for local use, and add the same four names in Vercel → Settings → Environment Variables. Never commit real keys.
5. **Verify destinations** (writes `src/data/destinations.verified.json`, then commit that file):
   ```bash
   npm run verify:destinations
   ```
   It looks up each destination's Place ID and checks Street View coverage. Both calls are free. Places without coverage aren't featured. Until it runs, production shows no featured places (development shows all of them with a "not yet verified" banner).

### Test locally
- `npx expo start --web` → sign in or try the demo → **Explore the world**.
- The `/api/streetview` endpoint runs on Vercel, not in Expo's dev server. To test globe clicks locally, set `EXPO_PUBLIC_API_BASE_URL` to your deployed site (the endpoint allows `localhost` origins), or run `npx vercel dev`.
- Phone app: set `EXPO_PUBLIC_SITE_URL` to the deployed site. The globe and Google content load from there.
- `npm test` runs the unit tests (Places UI Kit markup/attribution, rating states, Street View parsing, input validation, rate limiting, dataset, search, marker decluttering).

### Why it's built this way (Google terms)
- **Ratings use Google's Places UI Kit**, not raw Places API data: the Service Specific Terms (§14.2) forbid showing Places API content with a non-Google map like this globe, while the UI Kit is explicitly allowed with any map (§15.1). Google draws the rating, review count and attribution; TripTwin never reads, stores or computes ratings.
- **The 360° view is full screen**, because the Terms of Service (§3.2.3(e)(ii)) forbid Street View imagery and a non-Google map on the same screen.
- **Stored data** is limited to Place IDs and Street View pano IDs (both cacheable per Google's terms) plus TripTwin's own coordinates.

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
Expo SDK 58 / React Native / TypeScript / Expo Router, react-globe.gl (three.js) for Explore, a Vercel function in `/api`. Data is stored on the device with AsyncStorage, so demos work offline. The simulation engine is pure TypeScript in `src/lib/` (`simulate.ts`, `resilience.ts`, `budget.ts`), so it could move to a server or be unit-tested on its own.
