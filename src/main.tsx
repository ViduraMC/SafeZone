import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createSafeZone, type SafeZoneApp } from './app/container';
import { PERSONA_IDS } from './app/demo/personas';
import { seedDemoData } from './app/demo/seed';
import { App } from './ui/App';
import { AppProvider } from './ui/AppContext';
import { colors } from './ui/theme';

/** The web build accepts ?persona=USR-DMC so a demo can open as any actor. */
function initialPersona(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).get('persona') ?? PERSONA_IDS.citizen;
  }
  return PERSONA_IDS.citizen;
}

/** Builds the object graph, seeds the demo data through the real services, then shows the app. */
export function Root() {
  const [app, setApp] = useState<SafeZoneApp>();

  useEffect(() => {
    const instance = createSafeZone();
    let cancelled = false;
    void seedDemoData(instance).then(() => {
      if (!cancelled) setApp(instance);
    });
    return () => {
      cancelled = true;
      instance.dispose();
    };
  }, []);

  if (!app) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>SafeZone</Text>
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppProvider app={app} initialUserId={initialPersona()}>
        <App />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: colors.navy },
  splashTitle: { color: colors.white, fontSize: 30, fontWeight: '900' },
});
