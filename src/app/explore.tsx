import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DestinationSearch, type TypeFilter } from '@/components/explore/destination-search';
import { ExploreGuide } from '@/components/explore/explore-guide';
import { GlobeView } from '@/components/explore/globe-view';
import { PlaceCard } from '@/components/explore/place-card';
import { Body, Button, Icon, Row, Sub, type IconName } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { DESTINATIONS } from '@/data/destinations';
import { distanceKm, featuredDestinations, nearestDestination, showingUnverified, type FeaturedDestination } from '@/lib/explore/featured';
import { FOCUS_ALTITUDE, globeLabel, type GlobeFocus, type GlobeMarker } from '@/lib/explore/globe-logic';
import { checkStreetView } from '@/lib/explore/streetview-client';
import { radiusForAltitude } from '@/lib/explore/streetview-core';
import { useEscape } from '@/lib/explore/use-escape';
import { useStore } from '@/lib/store';
import type { Trip } from '@/lib/types';

const GUIDE_KEY = 'triptwin/explore-guide-dismissed';

type Notice =
  | { kind: 'checking' }
  | { kind: 'none'; suggestion?: FeaturedDestination & { km: number } }
  | { kind: 'error'; message: string };

/** Where a trip is on the globe: saved coords, or a name match with our destination list. */
function tripCoords(t: Trip) {
  if (t.coords) return t.coords;
  const city = t.destination.split(',')[0].trim().toLowerCase();
  const d = DESTINATIONS.find((x) => x.name.toLowerCase() === city);
  return d ? { lat: d.lat, lng: d.lng } : null;
}

export default function Explore() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { state, me } = useStore();

  const featured = useMemo(() => featuredDestinations(), []);
  const devUnverified = showingUnverified(featured);
  const myTrips = useMemo(() => state.trips.filter((t) => t.memberIds.includes(me.id)), [state.trips, me.id]);

  const [filter, setFilter] = useState<TypeFilter>('all');
  const [selectedId, setSelectedId] = useState<string>();
  const [focus, setFocus] = useState<GlobeFocus>();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [opening360, setOpening360] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [guide, setGuide] = useState(false);

  const selected = featured.find((d) => d.id === selectedId);
  const visibleList = useMemo(() => (filter === 'all' ? featured : featured.filter((d) => d.type === filter)), [featured, filter]);
  const popular = useMemo(() => [...visibleList].sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name)), [visibleList]);

  // First visit: show the 3-step guide once.
  useEffect(() => {
    AsyncStorage.getItem(GUIDE_KEY)
      .then((v) => v !== '1' && setGuide(true))
      .catch(() => setGuide(true));
  }, []);
  const closeGuide = () => {
    setGuide(false);
    AsyncStorage.setItem(GUIDE_KEY, '1').catch(() => {});
  };

  const markers = useMemo<GlobeMarker[]>(() => {
    const trips = myTrips.flatMap((t) => {
      const c = tripCoords(t);
      return c ? [{ trip: t, ...c, near: visibleList.find((d) => distanceKm(d.lat, d.lng, c.lat, c.lng) < 40) }] : [];
    });
    const dest: GlobeMarker[] = visibleList.map((d) => {
      // A trip on top of a featured place gets one merged label instead of two overlapping ones.
      const mine = trips.find((x) => x.near?.id === d.id);
      return { id: d.id, lat: d.lat, lng: d.lng, label: globeLabel(mine ? `${d.name} - your trip` : d.name), kind: d.type, tier: d.tier };
    });
    const tripMarkers: GlobeMarker[] = trips.map((x) => ({ id: `trip:${x.trip.id}`, lat: x.lat, lng: x.lng, label: x.near ? '' : globeLabel(`${x.trip.name} (your trip)`), kind: 'trip', tier: 1 }));
    return [...dest, ...tripMarkers];
  }, [visibleList, myTrips]);

  const select = useCallback((d: FeaturedDestination) => {
    setSelectedId(d.id);
    setFocus({ lat: d.lat, lng: d.lng, altitude: FOCUS_ALTITUDE, nonce: Date.now() });
    setNotice(null);
    setSheetOpen(true);
  }, []);

  const onMarkerPress = useCallback(
    (id: string) => {
      if (id.startsWith('trip:')) {
        const trip = myTrips.find((t) => `trip:${t.id}` === id);
        const match = trip && featured.find((d) => d.name.toLowerCase() === trip.destination.split(',')[0].trim().toLowerCase());
        if (match) return select(match);
        if (trip) router.push(`/trip/${trip.id}`);
        return;
      }
      const d = featured.find((x) => x.id === id);
      if (d) select(d);
    },
    [featured, myTrips, select],
  );

  const surprise = () => {
    if (!visibleList.length) return;
    const pool = visibleList.filter((d) => d.id !== selectedId);
    select(pool[Math.floor(Math.random() * pool.length)] ?? visibleList[0]);
  };

  const openViewer = (lat: number, lng: number, pano: string | undefined, name?: string) =>
    router.push({ pathname: '/streetview', params: { lat: String(lat), lng: String(lng), ...(pano ? { pano } : {}), ...(name ? { name } : {}) } });

  // Clicking empty globe: look for the nearest Street View imagery.
  const onGlobePress = useCallback(
    async (lat: number, lng: number, altitude: number) => {
      if (notice?.kind === 'checking') return;
      setNotice({ kind: 'checking' });
      const r = await checkStreetView(lat, lng, radiusForAltitude(altitude));
      if (r.status === 'ok') {
        setNotice(null);
        openViewer(r.lat, r.lng, r.panoId);
      } else if (r.status === 'none') {
        setNotice({ kind: 'none', suggestion: nearestDestination(lat, lng, featured, 2500) ?? undefined });
      } else {
        setNotice({ kind: 'error', message: "Couldn't check for Street View right now. Please try again." });
      }
    },
    [featured, notice?.kind],
  );

  const view360 = async (d: FeaturedDestination) => {
    if (d.panoId) return openViewer(d.lat, d.lng, d.panoId, d.name);
    // Unverified (development only): check first so we never open an empty viewer.
    setOpening360(true);
    const r = await checkStreetView(d.lat, d.lng, 1000);
    setOpening360(false);
    if (r.status === 'ok') openViewer(r.lat, r.lng, r.panoId, d.name);
    else setNotice(r.status === 'none' ? { kind: 'none' } : { kind: 'error', message: "Couldn't open the 360° view right now. Please try again." });
  };

  const addToTrip = (tripId: string, d: FeaturedDestination) =>
    router.push({ pathname: '/item', params: { tripId, kind: 'activity', title: `Explore ${d.name}`, location: `${d.name}, ${d.country}` } });
  const startTrip = (d: FeaturedDestination) =>
    router.push({ pathname: '/new-trip', params: { destination: `${d.name}, ${d.country}`, lat: String(d.lat), lng: String(d.lng) } });

  // Escape closes the place card (the guide and search handle their own Escape).
  useEscape(() => {
    if (selectedId) setSelectedId(undefined);
    else setNotice(null);
  }, !guide);

  const panelBody = selected ? (
    <PlaceCard
      place={selected}
      trips={myTrips}
      checking360={opening360}
      onClose={() => setSelectedId(undefined)}
      onView360={() => view360(selected)}
      onAddToTrip={(id) => addToTrip(id, selected)}
      onStartTrip={() => startTrip(selected)}
    />
  ) : (
    <PopularList list={popular} onSelect={select} />
  );

  const header = (
    <Row gap={S.sm}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel="Back to your trips" hitSlop={8} style={iconBtn(wide)}>
        <Icon name="chevron-back" color={wide ? C.primary : '#fff'} size={22} />
      </Pressable>
      <Text style={{ flex: 1, fontSize: 22, fontWeight: '800', color: wide ? C.text : '#fff' }} accessibilityRole="header">Explore</Text>
      <Pressable onPress={() => setGuide(true)} accessibilityRole="button" accessibilityLabel="How to use Explore" hitSlop={8} style={iconBtn(wide)}>
        <Icon name="help" color={wide ? C.primary : '#fff'} size={20} />
      </Pressable>
    </Row>
  );

  const searchAndActions = (
    <View style={{ gap: S.sm, zIndex: 10 }}>
      <DestinationSearch list={featured} filter={filter} onFilter={setFilter} onSelect={select} />
      <Button title="Surprise me" icon="shuffle" kind="ghost" small onPress={surprise} disabled={!visibleList.length} />
    </View>
  );

  return (
    <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', backgroundColor: '#03040B' }}>
      {wide && (
        <View style={{ width: 400, backgroundColor: C.bg, borderRightWidth: 1, borderRightColor: C.line, paddingTop: insets.top + S.md }}>
          <View style={{ paddingHorizontal: S.lg, gap: S.md, zIndex: 10 }}>
            {header}
            {searchAndActions}
            {devUnverified && <DevBanner />}
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: S.lg, gap: S.md }}>
            {panelBody}
            <GoogleNotice />
          </ScrollView>
        </View>
      )}

      <View style={{ flex: 1 }}>
        <GlobeView markers={markers} selectedId={selectedId} focus={focus} onMarkerPress={onMarkerPress} onGlobePress={onGlobePress} />

        {!wide && (
          <View style={{ position: 'absolute', top: insets.top + S.sm, left: S.md, right: S.md, gap: S.sm }} pointerEvents="box-none">
            {header}
            {searchAndActions}
            {devUnverified && <DevBanner />}
          </View>
        )}

        <Legend hasTrips={markers.some((m) => m.kind === 'trip')} bottom={wide ? S.lg : 96 + insets.bottom} />

        {notice && <NoticeToast notice={notice} onClose={() => setNotice(null)} onSuggest={select} at={wide ? { top: S.lg } : { bottom: 92 + insets.bottom }} />}

        {!wide && (
          <BottomSheet open={sheetOpen || !!selected} onToggle={() => (selected ? setSelectedId(undefined) : setSheetOpen(!sheetOpen))} title={selected ? selected.name : 'Popular destinations'} bottomInset={insets.bottom}>
            {panelBody}
            <GoogleNotice />
          </BottomSheet>
        )}
      </View>

      {guide && <ExploreGuide onDone={closeGuide} />}
    </View>
  );
}

const iconBtn = (wide: boolean) => ({
  width: 40,
  height: 40,
  borderRadius: 20,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: wide ? C.primarySoft : 'rgba(17,19,39,0.7)',
});

function PopularList({ list, onSelect }: { list: FeaturedDestination[]; onSelect: (d: FeaturedDestination) => void }) {
  if (!list.length)
    return (
      <View style={{ padding: S.lg, alignItems: 'center', gap: 6 }}>
        <Icon name="earth" size={28} color={C.faint} />
        <Body bold>No destinations to show yet</Body>
        <Sub>Featured places appear here once their Street View has been verified.</Sub>
      </View>
    );
  return (
    <View style={{ gap: 4 }} role="list" accessibilityLabel="Popular destinations">
      <Sub>Not sure where to start? Pick one.</Sub>
      {list.map((d) => (
        <Pressable
          key={d.id}
          role="listitem"
          onPress={() => onSelect(d)}
          accessibilityRole="button"
          accessibilityLabel={`${d.name}, ${d.country}, ${d.type}`}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: R.md, backgroundColor: pressed || hovered ? C.primarySoft : 'transparent' })}>
          <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: d.type === 'city' ? C.primarySoft : C.twinSoft }}>
            <Icon name={d.type === 'city' ? 'business' : 'home'} size={16} color={d.type === 'city' ? C.primary : C.twin} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{d.name}</Text>
            <Text style={{ fontSize: 13, color: C.sub }}>{d.country}</Text>
          </View>
          <Icon name="chevron-forward" size={16} color={C.faint} />
        </Pressable>
      ))}
    </View>
  );
}

function BottomSheet({ open, onToggle, title, bottomInset, children }: { open: boolean; onToggle: () => void; title: string; bottomInset: number; children: React.ReactNode }) {
  const { height } = useWindowDimensions();
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: open ? height * 0.62 : 76 + bottomInset, backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, elevation: 12 }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={open ? 'Collapse panel' : `Show ${title}`} style={{ paddingTop: 8, paddingBottom: 12, paddingHorizontal: S.lg, gap: 8 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: C.line }} />
        <Row>
          <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: C.text }} numberOfLines={1}>{title}</Text>
          <Icon name={open ? 'chevron-down' : 'chevron-up'} color={C.sub} />
        </Row>
      </Pressable>
      {open && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: S.lg, paddingBottom: S.xl + bottomInset, gap: S.md }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      )}
    </View>
  );
}

function NoticeToast({ notice, onClose, onSuggest, at }: { notice: Notice; onClose: () => void; onSuggest: (d: FeaturedDestination) => void; at: { top: number } | { bottom: number } }) {
  const icon: IconName = notice.kind === 'checking' ? 'search' : notice.kind === 'none' ? 'eye-off' : 'alert-circle';
  return (
    <View role="status" aria-live="polite" style={{ position: 'absolute', ...at, zIndex: 20, alignSelf: 'center', maxWidth: 420, width: '92%', backgroundColor: '#fff', borderRadius: R.lg, padding: S.md, gap: S.sm, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 }}>
      <Row style={{ alignItems: 'flex-start' }}>
        {notice.kind === 'checking' ? <ActivityIndicator color={C.twin} /> : <Icon name={icon} color={notice.kind === 'error' ? C.high : C.sub} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Body bold size={15}>
            {notice.kind === 'checking' ? 'Looking for Street View here…' : notice.kind === 'none' ? 'No street-level imagery here' : 'Something went wrong'}
          </Body>
          {notice.kind === 'none' && <Sub>{notice.suggestion ? `${notice.suggestion.name} is about ${Math.round(notice.suggestion.km).toLocaleString()} km away and has a 360° view.` : 'Try tapping closer to a town or road, or pick a place from the list.'}</Sub>}
          {notice.kind === 'error' && <Sub>{notice.message}</Sub>}
        </View>
        {notice.kind !== 'checking' && (
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={8}>
            <Icon name="close" color={C.sub} />
          </Pressable>
        )}
      </Row>
      {notice.kind === 'none' && notice.suggestion && <Button small kind="twin" title={`Go to ${notice.suggestion.name}`} icon="navigate" onPress={() => onSuggest(notice.suggestion!)} />}
    </View>
  );
}

function Legend({ hasTrips, bottom }: { hasTrips: boolean; bottom: number }) {
  const dot = (color: string, label: string) => (
    <Row gap={6}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ color: '#e2e8f0', fontSize: 12 }}>{label}</Text>
    </Row>
  );
  return (
    <View style={{ position: 'absolute', right: S.md, bottom, backgroundColor: 'rgba(3,4,11,0.6)', borderRadius: R.md, padding: 10, gap: 6 }} pointerEvents="none" accessibilityElementsHidden>
      {dot('#FFFFFF', 'City')}
      {dot('#5EEAD4', 'Town')}
      {hasTrips && dot('#818CF8', 'Your trips')}
    </View>
  );
}

function DevBanner() {
  return (
    <View style={{ backgroundColor: C.medSoft, borderRadius: R.md, padding: 10 }}>
      <Text style={{ color: C.med, fontSize: 12, fontWeight: '600' }}>Development only: destinations aren't verified yet, so all are shown. Run `npm run verify:destinations` before release.</Text>
    </View>
  );
}

/** Required notice: Google Maps features are subject to Google's terms and privacy policy. */
function GoogleNotice() {
  const link = (label: string, url: string) => (
    <Text style={{ color: C.primary, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(url)} accessibilityRole="link">
      {label}
    </Text>
  );
  return (
    <Text style={{ fontSize: 12, color: C.sub, lineHeight: 17, marginTop: S.sm }}>
      Ratings and 360° views are Google Maps features, subject to the {link('Google Maps Additional Terms', 'https://maps.google.com/help/terms_maps/')} and {link('Google Privacy Policy', 'https://policies.google.com/privacy')}. Earth imagery: NASA Blue Marble.
    </Text>
  );
}

