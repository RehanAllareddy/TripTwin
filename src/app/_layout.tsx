import { router, Stack } from 'expo-router';
import { Platform, Pressable, Text } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { C } from '@/constants/theme';
import { StoreProvider, useStore } from '@/lib/store';

SplashScreen.preventAutoHideAsync().catch(() => {});

const modal = (title: string) => ({
  presentation: 'modal' as const,
  title,
  headerLeft: () => (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" style={{ paddingRight: 12, paddingLeft: Platform.OS === 'web' ? 16 : 0 }}>
      <Text style={{ color: C.primary, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
    </Pressable>
  ),
});

function Root() {
  const { ready } = useStore();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerShadowVisible: false,
        headerTintColor: C.primary,
        headerTitleStyle: { color: C.text, fontWeight: '700' },
        contentStyle: { backgroundColor: C.bg },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="new-trip" options={modal('New trip')} />
      <Stack.Screen name="join" options={modal('Join a trip')} />
      <Stack.Screen name="profile" options={modal('Who are you?')} />
      <Stack.Screen name="item" options={modal('Plan item')} />
      <Stack.Screen name="expense" options={modal('Add expense')} />
    </Stack>
  );
}

export default function Layout() {
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <Root />
    </StoreProvider>
  );
}
