import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { OWNER_TYPE_LABELS } from '@/core/organisations/ResourceOwner';
import { ShelterCapacityError, type Shelter } from '@/modules/shelters/domain/Shelter';
import { useSafeZone } from '../../AppContext';
import { Button, Card, EmptyState, Field, Notice, ProgressBar, SectionTitle } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { percent } from '../../lib/format';
import { useAction } from '../../lib/useAction';
import { ShelterStatusBadge } from '../shelters/SheltersScreen';
import { ScopeSelector, useCoordinationScope } from '../common/CoordinationScope';

function ShelterRow({ shelter }: { shelter: Shelter }) {
  return (
    <Link to={`/coordination/shelters/${shelter.id}`} className="list-card">
      <div className="list-card__top">
        <span className="list-card__title">{shelter.name}</span>
        <ShelterStatusBadge status={shelter.status} />
      </div>
      <ProgressBar ratio={shelter.occupancyRatio} />
      <p className="muted small">
        {shelter.occupancy}/{shelter.capacity} occupied • {shelter.remainingCapacity} places left
      </p>
    </Link>
  );
}

export function ShelterListScreen() {
  const { app } = useSafeZone();
  const { districtId } = useCoordinationScope();
  const shelters = app.shelters.sheltersInDistrict(districtId);
  return (
    <Screen title="Shelters" subtitle="Allocate evacuees and track occupancy">
      <ScopeSelector />
      <Link to="/coordination/shelters/new" className="btn btn--secondary btn--block">
        + Register shelter
      </Link>
      {shelters.length === 0 && <EmptyState title="No shelters registered in this district" />}
      {shelters.map((shelter) => (
        <ShelterRow key={shelter.id} shelter={shelter} />
      ))}
    </Screen>
  );
}

/** UC03 steps 4-8 with A1 (near capacity), A3 (release), A4 (reopen), E1 (no places) and E2 (unavailable). */
export function ShelterManageScreen() {
  const { shelterId = '' } = useParams();
  const { app, user } = useSafeZone();
  const shelter = app.shelters.getShelter(shelterId);
  const [people, setPeople] = useState(10);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'warning'; text: string }>();
  const [alternatives, setAlternatives] = useState<Shelter[]>([]);
  const action = useAction();

  const allocate = async () => {
    setMessage(undefined);
    setAlternatives([]);
    const result = await action.run(() => {
      try {
        return app.shelters.allocate(shelter.id, people, user);
      } catch (error) {
        // A1: not enough places left, so suggest shelters that can take everyone.
        if (error instanceof ShelterCapacityError) setAlternatives(app.shelters.alternatives(shelter.id, people));
        throw error;
      }
    });
    if (!result) return;
    const offline = result.storedOffline ? ' (stored offline, will sync later)' : '';
    if (result.capacityWarning) {
      setMessage({ tone: 'warning', text: `Allocated ${people}. ${shelter.name} is approaching capacity: ${shelter.remainingCapacity} places remain${offline}.` });
      setAlternatives(app.shelters.alternatives(shelter.id, 1));
    } else {
      setMessage({ tone: 'success', text: `Allocated ${people} people${offline}.` });
    }
  };

  const markUnavailable = async () => {
    const alts = await action.run(() => app.shelters.markUnavailable(shelter.id, reason, user));
    if (alts) {
      setAlternatives(alts);
      setMessage({ tone: 'warning', text: `${shelter.name} marked unavailable. Move evacuees to an alternative shelter.` });
    }
  };

  const owner = app.organisations.get(shelter.ownerId);
  return (
    <Screen title={shelter.name} subtitle={shelter.address} back="/coordination/shelters">
      <Card>
        <div className="list-card__top">
          <span className="strong">
            {shelter.occupancy} / {shelter.capacity} occupied ({percent(shelter.occupancyRatio)})
          </span>
          <ShelterStatusBadge status={shelter.status} />
        </div>
        <ProgressBar ratio={shelter.occupancyRatio} />
        <p className="muted small">
          Managed by {owner.name} ({OWNER_TYPE_LABELS[owner.type]}) • {shelter.contactPhone}
        </p>
      </Card>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {action.error && <Notice tone="danger">{action.error}</Notice>}

      {shelter.isAvailable ? (
        <Card>
          <Field label="Allocate evacuees" htmlFor="people" hint={`${shelter.remainingCapacity} places remaining`}>
            <input id="people" type="number" min={1} value={people} onChange={(e) => setPeople(Number(e.target.value))} />
          </Field>
          <div className="button-row">
            <Button onClick={allocate} disabled={action.busy}>
              Confirm allocation
            </Button>
            <Button variant="secondary" onClick={() => action.run(() => app.shelters.release(shelter.id, people, user))}>
              Release
            </Button>
          </div>
        </Card>
      ) : (
        <Notice tone="danger">Unavailable: {shelter.unavailableReason}</Notice>
      )}

      {alternatives.length > 0 && (
        <>
          <SectionTitle>Alternative shelters</SectionTitle>
          {alternatives.slice(0, 4).map((alt) => (
            <ShelterRow key={alt.id} shelter={alt} />
          ))}
        </>
      )}

      {shelter.isAvailable ? (
        <Card>
          <Field label="Shelter no longer usable?" htmlFor="reason">
            <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Flood water entered the hall" />
          </Field>
          <Button variant="danger" onClick={markUnavailable}>
            Mark unavailable
          </Button>
        </Card>
      ) : (
        <Button variant="secondary" block onClick={() => action.run(() => app.shelters.reopen(shelter.id, user))}>
          Reopen shelter
        </Button>
      )}
    </Screen>
  );
}

export function RegisterShelterScreen() {
  const { app, user } = useSafeZone();
  const { districtId } = useCoordinationScope();
  const navigate = useNavigate();
  const ownerOptions = app.organisations.list();
  const [form, setForm] = useState({ name: '', address: '', capacity: 100, ownerId: user.organisationId ?? '', contactPhone: '', facilities: 'Clean Water, First Aid Desk' });
  const action = useAction();
  const errors = action.fieldErrors;
  const edit = (patch: Partial<typeof form>) => {
    setForm({ ...form, ...patch });
    action.clearFields(...Object.keys(patch));
  };

  const submit = async () => {
    const shelter = await action.run(() =>
      app.shelters.registerShelter({ ...form, districtId, facilities: form.facilities.split(',').map((f) => f.trim()).filter(Boolean) }, user),
    );
    if (shelter) navigate(`/coordination/shelters/${shelter.id}`);
  };

  return (
    <Screen title="Register Shelter" subtitle={`${app.geo.districtName(districtId)} District`} back="/coordination/shelters">
      <Field label="Shelter name" error={errors.name} htmlFor="name">
        <input id="name" value={form.name} onChange={(e) => edit({ name: e.target.value })} />
      </Field>
      <Field label="Address" error={errors.address} htmlFor="address">
        <input id="address" value={form.address} onChange={(e) => edit({ address: e.target.value })} />
      </Field>
      <Field label="Capacity (people)" error={errors.capacity} htmlFor="capacity">
        <input id="capacity" type="number" value={form.capacity} onChange={(e) => edit({ capacity: Number(e.target.value) })} />
      </Field>
      <Field label="Managing organisation" error={errors.ownerId} htmlFor="owner">
        <select id="owner" value={form.ownerId} onChange={(e) => edit({ ownerId: e.target.value })}>
          <option value="">Select organisation</option>
          {ownerOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Emergency desk phone" htmlFor="phone">
        <input id="phone" value={form.contactPhone} onChange={(e) => edit({ contactPhone: e.target.value })} placeholder="+94 ..." />
      </Field>
      <Field label="Facilities (comma separated)" htmlFor="facilities">
        <input id="facilities" value={form.facilities} onChange={(e) => edit({ facilities: e.target.value })} />
      </Field>
      {action.error && <Notice tone="danger">{action.error}</Notice>}
      <Button block onClick={submit}>
        Register shelter
      </Button>
    </Screen>
  );
}
