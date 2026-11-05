import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';

import { Body, Button, Icon, Row, Sub } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { googleMapsPlaceIdUrl } from '@/lib/explore/ratings';
import type { Trip } from '@/lib/types';

import { GooglePlaceDetails } from './google-place-details';

/**
 * Card for any place found with Google search (restaurant, address, landmark…).
 * Everything describing the place is drawn by Google inside the bordered box;
 * TripTwin only adds actions around it.
 */
export function SearchedPlaceCard({
  placeId,
  located,
  failed,
  trips,
  checking360,
  onLocation,
  onError,
  onClose,
  onView360,
  onAddToTrip,
}: {
  placeId: string;
  located: boolean;
  failed: boolean;
  trips: Trip[];
  checking360?: boolean;
  onLocation: (loc: { lat: number; lng: number }) => void;
  onError: () => void;
  onClose: () => void;
  onView360: () => void;
  onAddToTrip: (tripId: string) => void;
}) {
  return (
    <View style={{ gap: S.md }}>
      <Row>
        <Sub>SEARCH RESULT</Sub>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close search result" hitSlop={10} style={{ padding: 4 }}>
          <Icon name="close" size={24} color={C.sub} />
        </Pressable>
      </Row>

      <View accessibilityLabel="Place details from Google Maps" style={{ borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: S.md, gap: S.sm, backgroundColor: '#FAFBFD' }}>
        <Row>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#5E5E5E', letterSpacing: 0.3 }}>FROM GOOGLE MAPS</Text>
          <View style={{ flex: 1 }} />
          {!located && !failed && <ActivityIndicator size="small" color={C.sub} accessibilityLabel="Loading place" />}
        </Row>
        {failed ? <Body size={14} color={C.sub}>Place details are unavailable right now.</Body> : <GooglePlaceDetails key={placeId} placeId={placeId} onLocation={onLocation} onError={onError} />}
        <Pressable onPress={() => Linking.openURL(googleMapsPlaceIdUrl(placeId))} accessibilityRole="link" style={{ alignSelf: 'flex-start' }}>
          <Row gap={4}>
            <Text style={{ color: C.primary, fontWeight: '700', fontSize: 14 }}>Open in Google Maps</Text>
            <Icon name="open-outline" size={14} color={C.primary} />
          </Row>
        </Pressable>
      </View>

      <Button title={checking360 ? 'Finding a 360° view…' : located ? 'View in 360°' : 'Finding the place…'} icon="eye" kind="twin" disabled={!located || checking360} onPress={onView360} />
      {trips.length > 0 && (
        <View style={{ gap: 6 }}>
          <Sub>Save it to a trip</Sub>
          {trips.map((t) => (
            <Pressable key={t.id} onPress={() => onAddToTrip(t.id)} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: R.md, backgroundColor: pressed ? C.primarySoft : C.bg })}>
              <Icon name="briefcase-outline" color={C.primary} />
              <Body bold size={15}>{t.name}</Body>
              <View style={{ flex: 1 }} />
              <Icon name="add-circle" color={C.primary} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
