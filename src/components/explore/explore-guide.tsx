import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Icon, type IconName } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { useEscape } from '@/lib/explore/use-escape';

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'hand-left', title: 'Spin the globe', body: 'Drag to turn the Earth. Scroll or pinch to zoom in. More places appear as you get closer.' },
  { icon: 'location', title: 'Pick a place', body: 'Tap a dot, search above, or choose from Popular destinations to see what it’s like.' },
  { icon: 'eye', title: 'Look around in 360°', body: 'Tap “View in 360°” to stand on the street there. You can also tap anywhere on the globe.' },
];

/** Short, skippable first-visit guide. */
export function ExploreGuide({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  useEscape(onDone);

  return (
    <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(3,4,11,0.55)', alignItems: 'center', justifyContent: 'center', padding: S.lg, zIndex: 50 }}>
      <View role="dialog" aria-modal accessibilityLabel={`Explore guide, step ${i + 1} of ${STEPS.length}`} style={{ width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: R.lg, padding: S.xl, gap: S.md }}>
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: C.twinSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={step.icon} size={28} color={C.twin} />
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.twin }}>STEP {i + 1} OF {STEPS.length}</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }} accessibilityRole="header">{step.title}</Text>
        <Text style={{ fontSize: 16, color: C.sub, lineHeight: 22 }}>{step.body}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginVertical: 4 }}>
          {STEPS.map((_, j) => (
            <View key={j} style={{ width: j === i ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: j === i ? C.twin : C.line }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <Pressable onPress={onDone} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: C.sub, fontWeight: '600', fontSize: 15 }}>Skip</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          {i > 0 && (
            <Pressable onPress={() => setI(i - 1)} accessibilityRole="button" accessibilityLabel="Previous step" hitSlop={8}>
              <Icon name="arrow-back" color={C.sub} />
            </Pressable>
          )}
          <View style={{ minWidth: 120 }}>
            <Button title={last ? 'Start exploring' : 'Next'} kind="twin" onPress={() => (last ? onDone() : setI(i + 1))} />
          </View>
        </View>
      </View>
    </View>
  );
}
