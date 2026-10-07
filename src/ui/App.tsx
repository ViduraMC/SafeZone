import type { ComponentType } from 'react';
import { getStateFromPath, NavigationContainer, type InitialState } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useSafeZone } from './AppContext';
import { homeRouteFor } from './navigation';
import { linking, routeNameForPath, type RouteName } from './paths';
import { CoordinationScopeProvider } from './screens/common/CoordinationScope';
import { commonScreens } from './screens/common';
import { warningScreens } from './screens/warnings';
import { reportScreens } from './screens/reports';

/** Screens of the five use cases, each module registers its own. */
const SCREENS: Partial<Record<RouteName, ComponentType>> = {
  ...commonScreens,
  ...warningScreens, // UC01
  ...reportScreens, // UC02
};

const Stack = createNativeStackNavigator();

/**
 * Root navigator. It is keyed by the signed-in persona, so switching persona
 * starts again on that role's home screen.
 */
export function App({ initialPath }: { initialPath?: string }) {
  const { user } = useSafeZone();
  const initialState = initialPath ? (getStateFromPath(initialPath, linking.config) as InitialState | undefined) : undefined;
  return (
    <NavigationContainer linking={linking} initialState={initialState} documentTitle={{ formatter: () => 'SafeZone' }}>
      <StatusBar style="light" />
      <CoordinationScopeProvider key={user.id}>
        <Stack.Navigator initialRouteName={routeNameForPath(homeRouteFor(user)) ?? 'Hub'} screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          {(Object.keys(SCREENS) as RouteName[]).map((name) => (
            <Stack.Screen key={name} name={name} component={SCREENS[name] as ComponentType} />
          ))}
        </Stack.Navigator>
      </CoordinationScopeProvider>
    </NavigationContainer>
  );
}
