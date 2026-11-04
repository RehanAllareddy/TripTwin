import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { C, R, S, scoreColor } from '@/constants/theme';
import type { User } from '@/lib/types';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export const Icon = ({ name, size = 18, color = C.text }: { name: IconName; size?: number; color?: string }) => (
  <Ionicons name={name} size={size} color={color} />
);

export function Screen({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: padded ? S.lg : 0, paddingBottom: 48, gap: S.md }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const body = <View style={[styles.card, style]}>{children}</View>;
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: StyleSheet.flatten(style)?.flex }, pressed && { opacity: 0.7 }]}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

export const H1 = ({ children }: { children: ReactNode }) => <Text style={styles.h1}>{children}</Text>;
export const H2 = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <View style={styles.row}>
    <Text style={[styles.h2, { flex: 1 }]}>{children}</Text>
    {right}
  </View>
);
export const Body = ({ children, color = C.text, bold, size = 15 }: { children: ReactNode; color?: string; bold?: boolean; size?: number }) => (
  <Text style={{ color, fontSize: size, fontWeight: bold ? '700' : '400', lineHeight: size * 1.35 }}>{children}</Text>
);
export const Sub = ({ children, onPress }: { children: ReactNode; onPress?: () => void }) => (
  <Text style={[styles.sub, onPress && { color: C.primary, fontWeight: '700' }]} onPress={onPress}>
    {children}
  </Text>
);

export function Button({ title, onPress, icon, kind = 'primary', small, disabled }: { title: string; onPress: () => void; icon?: IconName; kind?: 'primary' | 'twin' | 'ghost' | 'danger'; small?: boolean; disabled?: boolean }) {
  const bg = { primary: C.primary, twin: C.twin, ghost: C.primarySoft, danger: C.highSoft }[kind];
  const fg = kind === 'ghost' ? C.primary : kind === 'danger' ? C.high : '#fff';
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.btn, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1, paddingVertical: small ? 8 : 13 }]}>
      {icon && <Icon name={icon} size={small ? 15 : 18} color={fg} />}
      <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 13 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, color = C.primary, icon }: { label: string; active?: boolean; onPress?: () => void; color?: string; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active ? { backgroundColor: color, borderColor: color } : null]}>
      {icon && <Icon name={icon} size={13} color={active ? '#fff' : C.sub} />}
      <Text style={{ color: active ? '#fff' : C.sub, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Tag({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: R.pill, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Avatar({ user, size = 30, ring }: { user?: User; size?: number; ring?: boolean }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: user?.color ?? C.faint, alignItems: 'center', justifyContent: 'center', borderWidth: ring ? 2 : 0, borderColor: '#fff' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.42 }}>{user?.name[0] ?? '?'}</Text>
    </View>
  );
}

export function AvatarStack({ users, size = 26 }: { users: (User | undefined)[]; size?: number }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {users.slice(0, 6).map((u, i) => (
        <View key={u?.id ?? i} style={{ marginLeft: i ? -size / 3 : 0 }}>
          <Avatar user={u} size={size} ring />
        </View>
      ))}
    </View>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={C.faint} {...props} style={[styles.input, props.multiline && { minHeight: 70 }]} />
    </View>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={[styles.row, { paddingVertical: 6 }]}>
      <View style={{ flex: 1 }}>
        <Body>{label}</Body>
        {hint && <Sub>{hint}</Sub>}
      </View>
      <View style={[styles.switch, value && { backgroundColor: C.twin }]}>
        <View style={[styles.knob, value && { alignSelf: 'flex-end' }]} />
      </View>
    </Pressable>
  );
}

/** Horizontal meter used for each Resilience factor and budget bars. */
export function Meter({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: C.line, overflow: 'hidden' }}>
      <View style={{ width: `${v * 100}%`, height, borderRadius: height, backgroundColor: color ?? scoreColor(v * 100) }} />
    </View>
  );
}

/** Big circular-looking score badge (pure Views, no SVG dependency). */
export function ScoreBadge({ score, size = 96, label }: { score: number; size?: number; label?: string }) {
  const color = scoreColor(score);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: size / 12, borderColor: color, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <Text style={{ fontSize: size / 3, fontWeight: '800', color }}>{score}</Text>
      {label && <Text style={{ fontSize: size / 9, color: C.sub, fontWeight: '600' }}>{label}</Text>}
    </View>
  );
}

export function Stat({ label, value, color = C.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color }}>{value}</Text>
      <Text style={styles.sub}>{label}</Text>
    </View>
  );
}

export function Empty({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ alignItems: 'center', padding: S.xl, gap: S.sm }}>
      <Icon name={icon} size={32} color={C.faint} />
      <Sub>{text}</Sub>
    </View>
  );
}

export const Row = ({ children, gap = S.sm, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.row, { gap }, style]}>{children}</View>
);

export const styles = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: R.lg, padding: S.lg, gap: S.sm, shadowColor: '#1B1F3B', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  h1: { fontSize: 28, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  h2: { fontSize: 18, fontWeight: '800', color: C.text },
  sub: { fontSize: 13, color: C.sub, lineHeight: 18 },
  label: { fontSize: 13, color: C.sub, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
  btn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: R.md, paddingHorizontal: 16 },
  chip: { flexDirection: 'row', gap: 4, alignItems: 'center', borderWidth: 1, borderColor: C.line, backgroundColor: '#fff', borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 7 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: R.md, padding: 12, fontSize: 15, color: C.text },
  switch: { width: 46, height: 28, borderRadius: 14, backgroundColor: C.line, padding: 3, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
});
