import { router, useLocalSearchParams } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Pressable, useWindowDimensions } from 'react-native';

import { Icon, type IconName } from '@/components/ui';
import { C } from '@/constants/theme';
import { useStore } from '@/lib/store';
import { TripIdContext } from '@/lib/trip-id';

const tab = (title: string, icon: IconName) => ({
  title,
  tabBarIcon: ({ color, focused }: { color: unknown; focused: boolean }) => (
    <Icon name={(focused ? icon : `${icon}-outline`) as IconName} color={String(color)} size={22} />
  ),
});

export default function TripTabs() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trip } = useStore();
  const t = trip(id);
  // Desktop / tablet: tabs become a left sidebar instead of a phone-style bottom bar.
  const wide = useWindowDimensions().width >= 900;
  return (
    <TripIdContext.Provider value={id}>
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', color: C.text },
        headerTitle: t?.name ?? 'Trip',
        headerLeft: () => (
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ paddingHorizontal: 14 }} accessibilityLabel="All trips">
            <Icon name="chevron-back" color={C.primary} size={24} />
          </Pressable>
        ),
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.faint,
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarVariant: wide ? 'material' : 'uikit',
        tabBarLabelPosition: wide ? 'beside-icon' : 'below-icon',
        tabBarStyle: wide ? { borderRightColor: C.line, backgroundColor: '#fff', minWidth: 200, paddingTop: 12 } : { borderTopColor: C.line },
        tabBarItemStyle: wide ? { justifyContent: 'flex-start', paddingHorizontal: 12, borderRadius: 12, marginHorizontal: 8 } : undefined,
        tabBarActiveBackgroundColor: wide ? C.primarySoft : undefined,
        sceneStyle: { backgroundColor: C.bg },
      }}>
      <Tabs.Screen name="index" options={tab('Overview', 'home')} />
      <Tabs.Screen name="plan" options={tab('Plan', 'calendar')} />
      <Tabs.Screen name="twin" options={{ ...tab('Twin', 'git-compare'), tabBarActiveTintColor: C.twin }} />
      <Tabs.Screen name="budget" options={tab('Budget', 'wallet')} />
      <Tabs.Screen name="group" options={tab('Group', 'chatbubbles')} />
    </Tabs>
    </TripIdContext.Provider>
  );
}
