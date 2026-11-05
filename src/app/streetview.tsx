/**
 * Full-screen 360° viewer.
 *
 * Google Maps Platform Terms §3.2.3(e)(ii) forbid showing Street View imagery and a
 * non-Google map on the same screen, so this replaces the globe entirely. Closing it
 * returns to Explore, which stays mounted underneath, so the globe keeps its position.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StreetViewFrame } from '@/components/explore/street-view-frame';
import { Button, Icon } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { GOOGLE_MAPS_BROWSER_KEY, hasBrowserKey, SITE_URL } from '@/lib/explore/config';
import { streetViewEmbedUrl, streetViewMapsUrl } from '@/lib/explore/streetview-core';
import { useEscape } from '@/lib/explore/use-escape';

export default function StreetView() {
  const insets = useSafeAreaInsets();
  const p = useLocalSearchParams<{ lat?: string; lng?: string; pano?: string; name?: string }>();
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  const valid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const title = p.name ? `${p.name} in 360°` : 'Street View in 360°';
  const close = () => (router.canGoBack() ? router.back() : router.replace('/explore'));
  useEscape(close);

  const mapsUrl = valid ? streetViewMapsUrl(lat, lng) : null;
  const canEmbed = valid && hasBrowserKey && (Platform.OS === 'web' || !!SITE_URL);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {canEmbed ? (
        <StreetViewFrame src={streetViewEmbedUrl(GOOGLE_MAPS_BROWSER_KEY, { panoId: p.pano, lat, lng })} title={title} />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl, gap: S.md }}>
          <Icon name="eye-off" size={36} color="#94a3b8" />
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>{valid ? "The 360° viewer isn't set up yet" : 'That location looks invalid'}</Text>
          <Text style={{ color: '#cbd5e1', textAlign: 'center' }}>{valid ? 'You can still look around in Google Maps.' : 'Go back and pick another spot.'}</Text>
        </View>
      )}

      {/* Top bar: always reachable close button + Google Maps link */}
      <View style={{ position: 'absolute', top: insets.top + S.sm, left: S.md, right: S.md, flexDirection: 'row', alignItems: 'center', gap: S.sm }} pointerEvents="box-none">
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close 360° view and return to the globe"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(17,19,39,0.85)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: R.pill, opacity: pressed ? 0.7 : 1 })}>
          <Icon name="close" color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700' }}>Back to globe</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        {mapsUrl && (
          <Pressable
            onPress={() => Linking.openURL(mapsUrl)}
            accessibilityRole="link"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: R.pill, opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: C.text, fontWeight: '700' }}>Open in Google Maps</Text>
            <Icon name="open-outline" size={16} color={C.text} />
          </Pressable>
        )}
      </View>
      {!canEmbed && mapsUrl && (
        <View style={{ position: 'absolute', bottom: insets.bottom + S.xl, left: S.xl, right: S.xl }}>
          <Button title="Open in Google Maps" icon="open-outline" kind="twin" onPress={() => Linking.openURL(mapsUrl)} />
        </View>
      )}
    </View>
  );
}
