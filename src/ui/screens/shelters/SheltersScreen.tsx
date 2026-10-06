import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Coordinates } from '@/core/geo/District';
import { ShelterStatus } from '@/modules/shelters/domain/Shelter';
import { useSafeZone } from '../../AppContext';
import { Badge, Card, ProgressBar } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { percent, titleCase } from '../../lib/format';

const STATUS_TONE = {
  [ShelterStatus.AVAILABLE]: 'success',
  [ShelterStatus.NEAR_CAPACITY]: 'warning',
  [ShelterStatus.FULL]: 'critical',
  [ShelterStatus.UNAVAILABLE]: 'neutral',
} as const;

export function ShelterStatusBadge({ status }: { status: ShelterStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{status === ShelterStatus.AVAILABLE ? 'OPEN' : titleCase(status).toUpperCase()}</Badge>;
}

function directionsUrl(point: Coordinates): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`;
}

/** Uses the device GPS, falling back to the home district centre when GPS is off. */
function useCurrentPosition(): Coordinates {
  const { app, user } = useSafeZone();
  const homeCentre = () => app.geo.getDistrict(user.homeDistrictId).centroid;
  const [position, setPosition] = useState<Coordinates>(homeCentre);
  useEffect(() => {
    const fallback = app.geo.getDistrict(user.homeDistrictId).centroid;
    app.gps.currentPosition().then(setPosition, () => setPosition(fallback));
  }, [app, user.homeDistrictId]);
  return position;
}

/** Citizen-facing "Nearest Shelter" view backed by UC03 occupancy data. */
export function SheltersScreen() {
  const { app } = useSafeZone();
  const position = useCurrentPosition();
  const nearby = app.shelters.nearest(position, 8);

  return (
    <Screen title="Nearest Shelters" subtitle="Live occupancy from district coordination">
      {nearby.map(({ shelter, distanceKm }, index) => (
        <Card key={shelter.id} tone={index === 0 ? 'info' : undefined}>
          <div className="list-card__top">
            <span className="muted small">{index === 0 ? 'Nearest shelter' : `${app.geo.districtName(shelter.districtId)} District`}</span>
            <span className="small strong">{distanceKm.toFixed(1)} km away</span>
          </div>
          <Link to={`/shelters/${shelter.id}`} className="list-card__title link-plain">{shelter.name}</Link>
          <p className="muted small">{shelter.address}</p>
          <div className="list-card__top">
            <span className="small">Occupancy ({shelter.occupancy}/{shelter.capacity})</span>
            <ShelterStatusBadge status={shelter.status} />
          </div>
          <ProgressBar ratio={shelter.occupancyRatio} />
          <a className="btn btn--primary btn--block" href={directionsUrl(shelter.location)} target="_blank" rel="noreferrer">
            Get Directions
          </a>
        </Card>
      ))}
    </Screen>
  );
}

export function ShelterDetailScreen() {
  const { shelterId = '' } = useParams();
  const { app } = useSafeZone();
  const shelter = app.shelters.getShelter(shelterId);
  const owner = app.organisations.get(shelter.ownerId);

  return (
    <Screen title={shelter.name} subtitle={shelter.address} back>
      <div className="detail-head">
        <ShelterStatusBadge status={shelter.status} />
      </div>
      <Card>
        <dl className="kv">
          <dt>Current Capacity</dt>
          <dd>
            {shelter.occupancy} / {shelter.capacity} occupied ({percent(shelter.occupancyRatio)})
          </dd>
          <dt>Emergency Desk Phone</dt>
          <dd>{shelter.contactPhone}</dd>
          <dt>Managed by</dt>
          <dd>{owner.name}</dd>
        </dl>
        <ProgressBar ratio={shelter.occupancyRatio} />
      </Card>
      {shelter.unavailableReason && <p className="notice notice--danger">Closed: {shelter.unavailableReason}</p>}
      <h3 className="caps">Available facilities</h3>
      <div className="chips">
        {shelter.facilities.map((f) => (
          <span key={f} className="chip chip--static">{f}</span>
        ))}
      </div>
      <a className="btn btn--primary btn--block" href={directionsUrl(shelter.location)} target="_blank" rel="noreferrer">
        Get Live Directions
      </a>
      <a className="btn btn--secondary btn--block" href={`tel:${shelter.contactPhone.replace(/\s/g, '')}`}>
        Call Shelter Desk
      </a>
    </Screen>
  );
}
