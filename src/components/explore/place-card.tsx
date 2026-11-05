import { useEffect, useReducer, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';

import { Body, Button, Icon, Row, Sub, Tag } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { hasBrowserKey } from '@/lib/explore/config';
import type { FeaturedDestination } from '@/lib/explore/featured';
import { googleMapsPlaceUrl, initialRatingsState, ratingsReducer, ratingsView, type RatingsTarget } from '@/lib/explore/ratings';
import type { Trip } from '@/lib/types';

import { GoogleUiKit } from './google-ui-kit';

const RATINGS_TIMEOUT_MS = 12000;

/**
 * Google content lives in its own bordered box, separate from TripTwin's content.
 * Ratings are requested only while this card is open, once per destination.
 */
function GoogleRatings({ target }: { target: RatingsTarget }) {
  const [state, dispatch] = useReducer(ratingsReducer, undefined, () => initialRatingsState(target, hasBrowserKey));
  const view = ratingsView(state, target);

  useEffect(() => {
    if (!view.loading) return;
    const t = setTimeout(() => dispatch({ type: 'timeout' }), RATINGS_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [view.loading]);

  return (
    <View
      accessibilityLabel="Ratings from Google Maps"
      style={{ borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: S.md, gap: S.sm, backgroundColor: '#FAFBFD' }}>
      <Row>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#5E5E5E', letterSpacing: 0.3 }}>FROM GOOGLE MAPS</Text>
        <View style={{ flex: 1 }} />
        {view.loading && <ActivityIndicator size="small" color={C.sub} accessibilityLabel="Loading Google ratings" />}
      </Row>

      {!!view.destinationMessage && <Body size={14} color={C.sub}>{view.destinationMessage}</Body>}

      {hasBrowserKey && <GoogleUiKit target={target} mountDestination={view.mountDestination} mountAttractions={view.mountAttractions} onEvent={dispatch} />}

      {!!view.attractionsMessage && <Body size={14} color={C.sub}>{view.attractionsMessage}</Body>}

      {view.showMapsLink && target.placeId && (
        <Pressable onPress={() => Linking.openURL(googleMapsPlaceUrl(target.placeId!, `${target.name}, ${target.country}`))} accessibilityRole="link" style={{ alignSelf: 'flex-start' }}>
          <Row gap={4}>
            <Text style={{ color: C.primary, fontWeight: '700', fontSize: 14 }}>View {target.name} on Google Maps</Text>
            <Icon name="open-outline" size={14} color={C.primary} />
          </Row>
        </Pressable>
      )}
    </View>
  );
}

export function PlaceCard({
  place,
  trips,
  onClose,
  onView360,
  onAddToTrip,
  onStartTrip,
  checking360,
}: {
  place: FeaturedDestination;
  trips: Trip[];
  onClose: () => void;
  onView360: () => void;
  onAddToTrip: (tripId: string) => void;
  onStartTrip: () => void;
  checking360?: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const target: RatingsTarget = { placeId: place.placeId, name: place.name, country: place.country, lat: place.lat, lng: place.lng };

  return (
    <View style={{ gap: S.md }} accessibilityRole="summary" accessibilityLabel={`${place.name}, ${place.country}`}>
      {/* TripTwin content */}
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Row gap={6}>
            <Tag label={place.type === 'city' ? 'City' : 'Town'} color={place.type === 'city' ? C.primary : C.twin} bg={place.type === 'city' ? C.primarySoft : C.twinSoft} />
            {!place.verified && __DEV__ && <Tag label="Not yet verified (dev)" color={C.med} bg={C.medSoft} />}
          </Row>
          <Text style={{ fontSize: 24, fontWeight: '800', color: C.text }} accessibilityRole="header">{place.name}</Text>
          <Sub>{place.country} · {place.continent}</Sub>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close place card" hitSlop={10} style={{ padding: 4 }}>
          <Icon name="close" size={24} color={C.sub} />
        </Pressable>
      </Row>
      <Body size={15}>{place.description}</Body>

      <Button title={checking360 ? 'Finding a 360° view…' : 'View in 360°'} icon="eye" kind="twin" disabled={checking360} onPress={onView360} />

      {trips.length > 0 ? (
        picking ? (
          <View style={{ gap: 6 }}>
            <Sub>Add {place.name} to which trip?</Sub>
            {trips.map((t) => (
              <Pressable key={t.id} onPress={() => onAddToTrip(t.id)} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: R.md, backgroundColor: pressed ? C.primarySoft : C.bg })}>
                <Icon name="briefcase-outline" color={C.primary} />
                <View style={{ flex: 1 }}>
                  <Body bold size={15}>{t.name}</Body>
                  <Sub>{t.destination}</Sub>
                </View>
                <Icon name="add-circle" color={C.primary} />
              </Pressable>
            ))}
            <Sub onPress={() => setPicking(false)}>Cancel</Sub>
          </View>
        ) : (
          <Row>
            <View style={{ flex: 1 }}>
              <Button title="Add to trip" icon="add" kind="ghost" onPress={() => (trips.length === 1 ? onAddToTrip(trips[0].id) : setPicking(true))} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="New trip here" icon="airplane" kind="ghost" onPress={onStartTrip} />
            </View>
          </Row>
        )
      ) : (
        <Button title={`Start a trip to ${place.name}`} icon="airplane" kind="ghost" onPress={onStartTrip} />
      )}

      {/* Google content, visually separated */}
      <GoogleRatings key={place.id} target={target} />
    </View>
  );
}
