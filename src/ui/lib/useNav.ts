import { getStateFromPath, useLinkTo, useNavigation, useRoute, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import { linking } from '../paths';

/**
 * Path based navigation on top of React Navigation, so screens and
 * notifications can link with the same strings ("/review/GR-1").
 */
export function useNav() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const linkTo = useLinkTo();

  const resetTo = useCallback(
    (path: string) => {
      const state = getStateFromPath(path, linking.config);
      if (state) navigation.reset(state as Parameters<typeof navigation.reset>[0]);
    },
    [navigation],
  );

  return useMemo(
    () => ({
      /** Opens a screen on top of the current one. */
      go: (path: string) => linkTo(path),
      /** Goes back, or to the fallback screen when there is no history (deep link). */
      back: (fallback = '/') => (navigation.canGoBack() ? navigation.goBack() : resetTo(fallback)),
      /** Replaces the whole stack, used by the bottom tabs and the persona switch. */
      resetTo,
    }),
    [linkTo, navigation, resetTo],
  );
}

/** Reads a path or query parameter of the current screen. */
export function useParam(name: string): string {
  const route = useRoute();
  const value = (route.params as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' ? value : '';
}
