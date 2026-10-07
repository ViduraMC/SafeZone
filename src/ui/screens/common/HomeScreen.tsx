import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SeverityLevel } from '@/core/hazard/SeverityLevel';
import { isAlertRecipient } from '@/core/users/UserAccount';
import { REPORT_STATUS_LABELS } from '@/modules/reports/domain/ReportStatus';
import { useSafeZone } from '../../AppContext';
import { Icon } from '../../components/Icon';
import { Badge, Button, ButtonRow, Card, ListCard, Row, SectionTitle, SeverityBadge, Txt } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { timeAgo } from '../../lib/format';
import { useNav } from '../../lib/useNav';
import { homeRouteFor } from '../../navigation';
import { colors } from '../../theme';

/** Full screen takeover for a critical alert, from the UC01 hi-fi wireframe. */
function CriticalTakeover({ title, description, onDismiss }: { title: string; description: string; onDismiss(): void }) {
  const nav = useNav();
  return (
    <SafeAreaView accessibilityRole="alert" style={styles.takeover}>
      <View style={styles.takeoverIcon}>
        <Icon name="alert" size={56} color={colors.white} />
      </View>
      <Text accessibilityRole="header" style={styles.takeoverTitle}>
        CRITICAL ALERT
      </Text>
      <Text style={styles.takeoverHeadline}>{title}</Text>
      <Text style={styles.takeoverBody}>{description}</Text>
      <View style={styles.takeoverActions}>
        <Button variant="light" icon="pin" block onPress={() => nav.go('/shelters')}>
          Find Nearest Shelter
        </Button>
        <Button variant="danger" icon="phone" block onPress={() => void Linking.openURL('tel:119')}>
          Call Emergency: 119
        </Button>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss Alert" onPress={onDismiss}>
          <Text style={styles.dismiss}>Dismiss Alert</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** Citizen home: the critical alert takeover, or a calm summary of warnings and reports. */
export function HomeScreen() {
  const { app, user } = useSafeZone();
  const nav = useNav();
  const [dismissed, setDismissed] = useState<readonly string[]>([]);
  const recipient = isAlertRecipient(user);

  useEffect(() => {
    // Officers have their own home screen (deep link to "/" on the web build).
    if (!recipient) nav.resetTo(homeRouteFor(user));
  }, [recipient, nav, user]);
  if (!recipient) return null;

  const { active } = app.alerts.listForDistrict(user.homeDistrictId);
  const critical = active.find((alert) => alert.severity === SeverityLevel.EMERGENCY && !dismissed.includes(alert.id));
  if (critical) {
    return <CriticalTakeover title={critical.title} description={critical.description} onDismiss={() => setDismissed([...dismissed, critical.id])} />;
  }

  const myReports = app.reportSubmission.myReports(user.id).slice(0, 3);
  return (
    <Screen title={`Hello, ${user.name.split(' ')[0]}`} subtitle={`${app.geo.districtName(user.homeDistrictId)} District`}>
      <Card tone={active.length > 0 ? 'warning' : 'success'}>
        <Txt lead>{active.length > 0 ? `${active.length} active warning${active.length > 1 ? 's' : ''} for your area` : 'No active warnings for your area'}</Txt>
        {active.slice(0, 2).map((alert) => (
          <Pressable key={alert.id} accessibilityRole="link" onPress={() => nav.go(`/alerts/${alert.id}`)} style={styles.alertRow}>
            <SeverityBadge severity={alert.severity} />
            <Txt small style={styles.flex}>{alert.title}</Txt>
          </Pressable>
        ))}
      </Card>

      <ButtonRow>
        <View style={styles.flex}>
          <Button icon="alert" onPress={() => nav.go('/report')}>Report a hazard</Button>
        </View>
        <View style={styles.flex}>
          <Button variant="secondary" icon="shelter" onPress={() => nav.go('/shelters')}>Find shelter</Button>
        </View>
      </ButtonRow>

      <SectionTitle action={{ label: 'See all', onPress: () => nav.go('/my-reports') }}>My reports</SectionTitle>
      {myReports.length === 0 && <Txt muted>You have not submitted any hazard reports.</Txt>}
      {myReports.map((report) => (
        <ListCard key={report.id} onPress={() => nav.go(`/my-reports/${report.id}`)}>
          <Row>
            <Badge tone="neutral">{REPORT_STATUS_LABELS[report.status]}</Badge>
            <Txt small muted>{timeAgo(report.submittedAt, app.clock.now())}</Txt>
          </Row>
          <Txt strong>
            {app.hazardTypes.get(report.hazardTypeCode).name} - {report.location.label}
          </Txt>
        </ListCard>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  takeover: { flex: 1, backgroundColor: colors.critical, padding: 24, justifyContent: 'center', gap: 14 },
  takeoverIcon: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 60, padding: 18 },
  takeoverTitle: { color: colors.white, fontSize: 30, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  takeoverHeadline: { color: colors.white, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  takeoverBody: { color: '#ffe3e3', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  takeoverActions: { marginTop: 16 },
  dismiss: { color: colors.white, textAlign: 'center', textDecorationLine: 'underline', fontWeight: '600', padding: 8 },
});
