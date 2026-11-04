import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { C } from '@/constants/theme';
import { StoreProvider, useStore } from '@/lib/store';

SplashScreen.preventAutoHideAsync().catch(() => {});

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
      <Stack.Screen name="new-trip" options={{ presentation: 'modal', title: 'New trip' }} />
      <Stack.Screen name="join" options={{ presentation: 'modal', title: 'Join a trip' }} />
      <Stack.Screen name="profile" options={{ presentation: 'modal', title: 'Who are you?' }} />
      <Stack.Screen name="item" options={{ presentation: 'modal', title: 'Plan item' }} />
      <Stack.Screen name="expense" options={{ presentation: 'modal', title: 'Add expense' }} />
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
