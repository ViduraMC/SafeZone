import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import type { Coordinates } from '@/core/geo/District';
import { ShelterStatus } from '@/modules/shelters/domain/Shelter';
import { useSafeZone } from '../../AppContext';
import { Badge, Button, Card, Chip, KeyValue, LinkText, Notice, ProgressBar, Row, SectionTitle, Txt } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { percent, titleCase } from '../../lib/format';
import { useNav, useParam } from '../../lib/useNav';

const STATUS_TONE = {
  [ShelterStatus.AVAILABLE]: 'success',
  [ShelterStatus.NEAR_CAPACITY]: 'warning',
  [ShelterStatus.FULL]: 'critical',
  [ShelterStatus.UNAVAILABLE]: 'neutral',
} as const;

export function ShelterStatusBadge({ status }: { status: ShelterStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{status === ShelterStatus.AVAILABLE ? 'OPEN' : titleCase(status).toUpperCase()}</Badge>;
}

function openDirections(point: Coordinates): void {
  void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`);
}

/** Uses the device GPS, falling back to the home district centre when GPS is off. */
function useCurrentPosition(): Coordinates {
  const { app, user } = useSafeZone();
  const [position, setPosition] = useState<Coordinates>(() => app.geo.getDistrict(user.homeDistrictId).centroid);
  useEffect(() => {
    const fallback = app.geo.getDistrict(user.homeDistrictId).centroid;
    app.gps.currentPosition().then(setPosition, () => setPosition(fallback));
  }, [app, user.homeDistrictId]);
  return position;
}

/** Citizen-facing "Nearest Shelter" view backed by UC03 occupancy data. */
export function SheltersScreen() {
  const { app } = useSafeZone();
  const nav = useNav();
  const position = useCurrentPosition();
  const nearby = app.shelters.nearest(position, 8);

  return (
    <Screen title="Nearest Shelters" subtitle="Live occupancy from district coordination">
      {nearby.map(({ shelter, distanceKm }, index) => (
        <Card key={shelter.id} tone={index === 0 ? 'info' : undefined}>
          <Row>
            <Txt small muted>{index === 0 ? 'Nearest shelter' : `${app.geo.districtName(shelter.districtId)} District`}</Txt>
            <Txt small strong>{distanceKm.toFixed(1)} km away</Txt>
          </Row>
          <LinkText onPress={() => nav.go(`/shelters/${shelter.id}`)}>{shelter.name}</LinkText>
          <Txt small muted>{shelter.address}</Txt>
          <Row>
            <Txt small>
              Occupancy ({shelter.occupancy}/{shelter.capacity})
            </Txt>
            <ShelterStatusBadge status={shelter.status} />
          </Row>
          <ProgressBar ratio={shelter.occupancyRatio} />
          <Button block onPress={() => openDirections(shelter.location)}>Get Directions</Button>
        </Card>
      ))}
    </Screen>
  );
}

export function ShelterDetailScreen() {
  const shelterId = useParam('shelterId');
  const { app } = useSafeZone();
  const shelter = app.shelters.getShelter(shelterId);
  const owner = app.organisations.get(shelter.ownerId);

  return (
    <Screen title={shelter.name} subtitle={shelter.address} back="/shelters">
      <ShelterStatusBadge status={shelter.status} />
      <Card style={styles.gap}>
        <KeyValue
          rows={[
            ['Current Capacity', `${shelter.occupancy} / ${shelter.capacity} occupied (${percent(shelter.occupancyRatio)})`],
            ['Emergency Desk Phone', shelter.contactPhone],
            ['Managed by', owner.name],
          ]}
        />
        <ProgressBar ratio={shelter.occupancyRatio} />
      </Card>
      {shelter.unavailableReason ? <Notice tone="danger">{`Closed: ${shelter.unavailableReason}`}</Notice> : null}
      <SectionTitle>Available facilities</SectionTitle>
      <View style={styles.chips}>
        {shelter.facilities.map((f) => (
          <Chip key={f}>{f}</Chip>
        ))}
      </View>
      <Button block onPress={() => openDirections(shelter.location)}>Get Live Directions</Button>
      <Button block variant="secondary" icon="phone" onPress={() => void Linking.openURL(`tel:${shelter.contactPhone.replace(/\s/g, '')}`)}>
        Call Shelter Desk
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
});
