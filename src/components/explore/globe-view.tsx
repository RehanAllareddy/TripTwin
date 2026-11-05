/**
 * Phone app globe: runs globe.gl inside a WebView (see globe-view.web.tsx for the website version).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { C } from '@/constants/theme';
import { SITE_URL } from '@/lib/explore/config';
import { altitudeBucket, START_ALTITUDE, visibleLabels, visibleMarkers, type GlobeProps } from '@/lib/explore/globe-logic';
import { buildGlobeHtml } from '@/lib/explore/globe-html';

import { WebView, type WebViewHandle, type WebViewMessageEvent } from './web-view';

const BUCKET_ALT = [0.6, 1.2, 1.5, 2.4];

export function GlobeView({ markers, selectedId, focus, onMarkerPress, onGlobePress, onInteract, onAltitudeChange }: GlobeProps) {
  const web = useRef<WebViewHandle>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [bucket, setBucket] = useState(altitudeBucket(START_ALTITUDE));
  const html = useMemo(() => buildGlobeHtml(SITE_URL), []);

  const run = useCallback((js: string) => web.current?.injectJavaScript(`${js};true;`), []);

  // Push the visible markers whenever zoom level, selection or data changes.
  useEffect(() => {
    if (!ready) return;
    const points = visibleMarkers(markers, BUCKET_ALT[bucket], selectedId);
    const data = {
      selectedId,
      points,
      labels: visibleLabels(points, BUCKET_ALT[bucket], selectedId),
      rings: points.filter((m) => m.kind === 'trip' || m.id === selectedId),
    };
    run(`window.TT&&window.TT.setData(${JSON.stringify(data)})`);
  }, [ready, markers, bucket, selectedId, run]);

  useEffect(() => {
    if (ready && focus) run(`window.TT&&window.TT.focus(${focus.lat},${focus.lng},${focus.altitude})`);
  }, [ready, focus, run]);

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { type?: string; id?: string; lat?: number; lng?: number; alt?: number };
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.type === 'ready') setReady(true);
    else if (m.type === 'error') setFailed(true);
    else if (m.type === 'interact') onInteract?.();
    else if (m.type === 'marker' && typeof m.id === 'string') onMarkerPress(m.id);
    else if (m.type === 'globe' && Number.isFinite(m.lat) && Number.isFinite(m.lng)) onGlobePress(m.lat!, m.lng!, m.alt ?? START_ALTITUDE);
    else if (m.type === 'alt' && Number.isFinite(m.alt)) {
      onAltitudeChange?.(m.alt!);
      const b = altitudeBucket(m.alt!);
      setBucket((cur) => (cur === b ? cur : b));
    }
  };

  if (!SITE_URL || failed)
    return (
      <View style={{ flex: 1, backgroundColor: '#03040B', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, textAlign: 'center' }}>The globe couldn't load</Text>
        <Text style={{ color: '#cbd5e1', textAlign: 'center', marginTop: 6 }}>
          {SITE_URL ? 'Check your internet connection and try again.' : 'Set EXPO_PUBLIC_SITE_URL so the app can load the globe.'} You can still use the list below.
        </Text>
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: '#03040B' }} accessibilityLabel="Interactive globe. Drag to spin, pinch to zoom, or pick a place from the list.">
      <WebView
        ref={web}
        // baseUrl gives the page the site's origin, so the globe images load from TripTwin.
        source={{ html, baseUrl: SITE_URL }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        style={{ backgroundColor: '#03040B' }}
        onError={() => setFailed(true)}
      />
      {!ready && (
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 10 }} pointerEvents="none">
          <ActivityIndicator color={C.twinSoft} />
          <Text style={{ color: '#cbd5e1' }}>Loading the globe…</Text>
        </View>
      )}
    </View>
  );
}
