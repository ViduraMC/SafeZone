import { Share, StyleSheet, View } from 'react-native';
import { useSafeZone } from '../../AppContext';
import { Badge, Button, ButtonRow, Card, Chip, Row, SectionTitle, SeverityBadge, Title, Txt } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { formatDateTime, SEVERITY_LABELS, timeUntil } from '../../lib/format';
import { useNav, useParam } from '../../lib/useNav';

/** Citizen view of one warning, with the share sheet and a link to the nearest shelters. */
export function AlertDetailScreen() {
  const alertId = useParam('alertId');
  const { app } = useSafeZone();
  const nav = useNav();
  const alert = app.alerts.getAlert(alertId);
  const now = app.clock.now();
  const active = alert.isActiveAt(now);
  const districts = alert.target.resolveDistrictIds(app.geo);

  const share = () => void Share.share({ title: 'SafeZone alert', message: `${alert.title} - ${alert.target.describe(app.geo)}. ${alert.description}` });

  return (
    <Screen title="Warning details" back>
      <Row>
        <SeverityBadge severity={alert.severity} />
        <Txt small muted>{active ? `Active • Expires in ${timeUntil(alert.validUntil, now)}` : `Ended • ${alert.status}`}</Txt>
      </Row>
      <View style={styles.heading}>
        <Title>{alert.title}</Title>
        <Txt small muted>
          Issued by Disaster Management Centre • {alert.issuedAt ? formatDateTime(alert.issuedAt) : '-'} • {app.hazardTypes.get(alert.hazardTypeCode).name}
        </Txt>
      </View>

      <SectionTitle>Affected regions</SectionTitle>
      <View style={styles.regions}>
        {alert.target.scope === 'RIVER_BASIN' && <Badge tone="info">{alert.target.describe(app.geo)}</Badge>}
        {districts.map((id) => (
          <Chip key={id}>{app.geo.districtName(id)} District</Chip>
        ))}
      </View>

      <Card>
        <Txt>{alert.description}</Txt>
      </Card>

      {alert.escalations.length > 0 && <SectionTitle>Updates</SectionTitle>}
      {alert.escalations.map((e) => (
        <Card key={e.at.toISOString()} tone="warning">
          <Txt small strong>
            {formatDateTime(e.at)}: raised from {SEVERITY_LABELS[e.from]} to {SEVERITY_LABELS[e.to]}
          </Txt>
          <Txt small>{e.reason}</Txt>
        </Card>
      ))}

      <ButtonRow>
        <Button icon="pin" onPress={() => nav.go('/shelters')}>Find Nearest Shelter</Button>
        <Button variant="secondary" onPress={share}>Share Alert</Button>
      </ButtonRow>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { marginVertical: 10 },
  regions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
});
