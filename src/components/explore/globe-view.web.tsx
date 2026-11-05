import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { GlobeMethods } from 'react-globe.gl';

import { altitudeBucket, FOCUS_ALTITUDE, markerStyle, START_ALTITUDE, visibleLabels, visibleMarkers, type GlobeMarker, type GlobeProps } from '@/lib/explore/globe-logic';

// Lazy-load three.js + globe so the rest of TripTwin never pays for it.
const Globe = lazy(() => import('react-globe.gl'));

const IMG = { earth: '/globe/earth-blue-marble.jpg', bump: '/globe/earth-topology.png', sky: '/globe/night-sky.png' };

export function GlobeView({ markers, selectedId, focus, onMarkerPress, onGlobePress, onInteract, onAltitudeChange }: GlobeProps) {
  const globe = useRef<GlobeMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [bucket, setBucket] = useState(altitudeBucket(START_ALTITUDE));
  const altitude = useRef(START_ALTITUDE);
  const interacted = useRef(false);
  const cleanup = useRef<() => void>(() => {});

  const stopIntro = useCallback(() => {
    const controls = globe.current?.controls();
    if (controls) controls.autoRotate = false;
    if (!interacted.current) {
      interacted.current = true;
      onInteract?.();
    }
  }, [onInteract]);

  const onReady = useCallback(() => {
    const g = globe.current;
    if (!g) return;
    g.pointOfView({ lat: 20, lng: 0, altitude: START_ALTITUDE }, 0);
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;
    controls.enableDamping = true;
    controls.minDistance = 101; // just above the surface
    controls.maxDistance = 600;
    controls.addEventListener('start', stopIntro);
    cleanup.current = () => controls.removeEventListener('start', stopIntro);
  }, [stopIntro]);

  // Release WebGL resources and listeners when leaving Explore.
  useEffect(
    () => () => {
      cleanup.current();
      globe.current?.pauseAnimation();
      const renderer = globe.current?.renderer();
      renderer?.dispose();
    },
    [],
  );

  useEffect(() => {
    if (!focus || !globe.current) return;
    stopIntro();
    globe.current.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: focus.altitude ?? FOCUS_ALTITUDE }, 1200);
  }, [focus, stopIntro]);

  const onZoom = useCallback(
    (pov: { altitude: number }) => {
      altitude.current = pov.altitude;
      onAltitudeChange?.(pov.altitude);
      setBucket((b) => (altitudeBucket(pov.altitude) === b ? b : altitudeBucket(pov.altitude)));
    },
    [onAltitudeChange],
  );

  // Recompute the visible set only when zoom crosses a threshold (keeps it smooth with all markers).
  const points = useMemo(() => visibleMarkers(markers, bucketAlt(bucket), selectedId), [markers, bucket, selectedId]);
  const labels = useMemo(() => visibleLabels(points, bucketAlt(bucket), selectedId), [points, bucket, selectedId]);
  const rings = useMemo(() => points.filter((m) => m.kind === 'trip' || m.id === selectedId), [points, selectedId]);

  return (
    <View
      style={{ flex: 1, backgroundColor: '#03040B' }}
      onLayout={(e) => setSize({ width: Math.round(e.nativeEvent.layout.width), height: Math.round(e.nativeEvent.layout.height) })}
      accessibilityLabel="Interactive globe. Drag to spin, scroll or pinch to zoom. You can also choose places with the search box or the Popular destinations list.">
      {size.width > 0 && (
        <Suspense fallback={<Loading />}>
          <Globe
            ref={globe}
            width={size.width}
            height={size.height}
            globeImageUrl={IMG.earth}
            bumpImageUrl={IMG.bump}
            backgroundImageUrl={IMG.sky}
            showAtmosphere
            atmosphereColor="#9ec5ff"
            atmosphereAltitude={0.18}
            onGlobeReady={onReady}
            onZoom={onZoom}
            onGlobeClick={({ lat, lng }) => {
              stopIntro();
              onGlobePress(lat, lng, altitude.current);
            }}
            pointsData={points}
            pointLat="lat"
            pointLng="lng"
            pointAltitude={(m: object) => ((m as GlobeMarker).kind === 'trip' ? 0.03 : 0.012)}
            pointRadius={(m: object) => markerStyle(m as GlobeMarker, selectedId).radius}
            pointColor={(m: object) => markerStyle(m as GlobeMarker, selectedId).color}
            pointLabel={(m: object) => escapeHtml((m as GlobeMarker).label)}
            pointsTransitionDuration={300}
            onPointClick={(m: object) => {
              stopIntro();
              onMarkerPress((m as GlobeMarker).id);
            }}
            labelsData={labels}
            labelLat="lat"
            labelLng="lng"
            labelText="label"
            labelSize={(m: object) => ((m as GlobeMarker).id === selectedId ? 1.1 : 0.75)}
            labelDotRadius={0}
            labelAltitude={0.02}
            labelColor={(m: object) => markerStyle(m as GlobeMarker, selectedId).label}
            labelResolution={2}
            onLabelClick={(m: object) => {
              stopIntro();
              onMarkerPress((m as GlobeMarker).id);
            }}
            ringsData={rings}
            ringLat="lat"
            ringLng="lng"
            ringColor={(m: object) => ((m as GlobeMarker).id === selectedId ? 'rgba(249,115,22,0.8)' : 'rgba(129,140,248,0.7)')}
            ringMaxRadius={2.2}
            ringPropagationSpeed={1.6}
            ringRepeatPeriod={1400}
          />
        </Suspense>
      )}
    </View>
  );
}

/** A representative altitude for each bucket, used to filter markers. */
function bucketAlt(bucket: number) {
  return [0.6, 1.2, 1.5, 2.4][bucket] ?? 2.4;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <ActivityIndicator color="#fff" />
      <Text style={{ color: '#cbd5e1' }}>Loading the globe…</Text>
    </View>
  );
}
