import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { severityRank } from '@/core/hazard/SeverityLevel';
import { isAlertRecipient } from '@/core/users/UserAccount';
import { useSafeZone } from '../AppContext';
import { SEVERITY_LABELS } from '../lib/format';
import { useNav } from '../lib/useNav';
import { tabsFor } from '../navigation';
import { ROUTE_PATHS, type RouteName } from '../paths';
import { colors, toneColors } from '../theme';
import { Icon } from './Icon';
import { severityTone } from './Primitives';

/** Top banner with the most severe active warning, as in the hi-fi wireframes. */
function StatusBanner() {
  const { app, user } = useSafeZone();
  const nav = useNav();
  const alerts = isAlertRecipient(user) ? app.alerts.listForDistrict(user.homeDistrictId).active : app.alerts.listActive();
  const top = [...alerts].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
  if (!top) {
    return (
      <View style={[styles.banner, { backgroundColor: colors.advisory }]}>
        <Text style={styles.bannerTag}>CLEAR</Text>
        <Text style={styles.bannerText}>No active warnings for your area</Text>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${SEVERITY_LABELS[top.severity]} warning: ${top.title}`}
      onPress={() => nav.go(`/alerts/${top.id}`)}
      style={[styles.banner, { backgroundColor: toneColors[severityTone(top.severity)].fg }]}
    >
      <Text style={styles.bannerTag}>{SEVERITY_LABELS[top.severity].toUpperCase()}</Text>
      <Text style={styles.bannerText} numberOfLines={1}>
        {top.title}
      </Text>
      <Icon name="chevron" size={16} color={colors.white} />
    </Pressable>
  );
}

/** Online or offline pill; tapping it simulates losing the data network. */
function ConnectivityPill() {
  const { app } = useSafeZone();
  const online = app.connectivity.isOnline();
  const pending = app.sync.pending().length;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Simulate network connectivity"
      accessibilityState={{ checked: online }}
      onPress={() => app.connectivity.setOnline(!online)}
      style={[styles.pill, { backgroundColor: online ? colors.advisory : colors.watch }]}
    >
      <Icon name={online ? 'wifi' : 'wifiOff'} size={14} color={colors.white} />
      <Text style={styles.pillText}>{online ? 'Online' : 'Offline'}</Text>
      {pending > 0 && <Text style={styles.pillCount}>{pending}</Text>}
    </Pressable>
  );
}

function BottomNav() {
  const { user } = useSafeZone();
  const nav = useNav();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const currentPath = ROUTE_PATHS[route.name as RouteName];
  return (
    <View accessibilityRole="tabbar" style={[styles.tabbar, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {tabsFor(user).map((tab) => {
        const active = tab.to === currentPath;
        const color = active ? colors.navy : colors.muted;
        return (
          <Pressable
            key={tab.to}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
            onPress={() => nav.resetTo(tab.to)}
            style={styles.tab}
          >
            <Icon name={tab.icon} size={22} color={color} />
            <Text style={[styles.tabText, { color }, active && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Frame shared by every screen: warning banner, navy header with optional back
 * button, scrollable body and the role-based bottom tabs.
 */
export function Screen({ title, subtitle, back, children }: { title: string; subtitle?: string; back?: boolean | string; children: ReactNode }) {
  const nav = useNav();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top, backgroundColor: colors.navy }}>
        <StatusBanner />
        <View style={styles.header}>
          <View style={styles.headerRow}>
            {back ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => nav.back(typeof back === 'string' ? back : '/')} style={styles.backButton}>
                <Icon name="back" size={24} color={colors.white} />
              </Pressable>
            ) : null}
            <Text accessibilityRole="header" style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            <ConnectivityPill />
          </View>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <ScrollView testID="screen-scroll" style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  bannerTag: { color: colors.white, fontWeight: '900', fontSize: 11, letterSpacing: 0.8, backgroundColor: 'rgba(0,0,0,0.18)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  bannerText: { color: colors.white, fontWeight: '600', fontSize: 13, flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { marginLeft: -6, padding: 2 },
  title: { color: colors.white, fontSize: 21, fontWeight: '800', flex: 1 },
  subtitle: { color: '#c9d4e8', fontSize: 13 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  pillText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  pillCount: { color: colors.watch, backgroundColor: colors.white, fontSize: 11, fontWeight: '800', borderRadius: 8, paddingHorizontal: 5, overflow: 'hidden' },
  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 32 },
  tabbar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 },
  tabText: { fontSize: 11, fontWeight: '600' },
  tabTextActive: { fontWeight: '800' },
});
