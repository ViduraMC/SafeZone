import { useState } from 'react';
import { OWNER_TYPE_LABELS } from '@/core/organisations/ResourceOwner';
import { ShelterCapacityError, type Shelter } from '@/modules/shelters/domain/Shelter';
import { useSafeZone } from '../../AppContext';
import { Button, ButtonRow, Card, EmptyState, Field, ListCard, Notice, NumberField, ProgressBar, Row, SectionTitle, SelectField, TextField, Txt } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { percent } from '../../lib/format';
import { useAction } from '../../lib/useAction';
import { useNav, useParam } from '../../lib/useNav';
import { ScopeSelector, useCoordinationScope } from '../common/CoordinationScope';
import { ShelterStatusBadge } from './SheltersScreen';

function ShelterRow({ shelter }: { shelter: Shelter }) {
  const nav = useNav();
  return (
    <ListCard label={shelter.name} onPress={() => nav.go(`/coordination/shelters/${shelter.id}`)}>
      <Row>
        <Txt strong>{shelter.name}</Txt>
        <ShelterStatusBadge status={shelter.status} />
      </Row>
      <ProgressBar ratio={shelter.occupancyRatio} />
      <Txt small muted>
        {shelter.occupancy}/{shelter.capacity} occupied • {shelter.remainingCapacity} places left
      </Txt>
    </ListCard>
  );
}

export function ShelterListScreen() {
  const { app } = useSafeZone();
  const nav = useNav();
  const { districtId } = useCoordinationScope();
  const shelters = app.shelters.sheltersInDistrict(districtId);
  return (
    <Screen title="Shelters" subtitle="Allocate evacuees and track occupancy">
      <ScopeSelector />
      <Button block variant="secondary" icon="plus" onPress={() => nav.go('/coordination/shelters/new')}>Register shelter</Button>
      {shelters.length === 0 && <EmptyState title="No shelters registered in this district" />}
      {shelters.map((shelter) => (
        <ShelterRow key={shelter.id} shelter={shelter} />
      ))}
    </Screen>
  );
}

/** UC03 steps 4-8 with A1 (near capacity), A3 (release), A4 (reopen), E1 (no places) and E2 (unavailable). */
export function ShelterManageScreen() {
  const shelterId = useParam('shelterId');
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
        // E1: not enough places left, so suggest shelters that can take everyone.
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
        <Row>
          <Txt strong>
            {shelter.occupancy} / {shelter.capacity} occupied ({percent(shelter.occupancyRatio)})
          </Txt>
          <ShelterStatusBadge status={shelter.status} />
        </Row>
        <ProgressBar ratio={shelter.occupancyRatio} />
        <Txt small muted>
          Managed by {owner.name} ({OWNER_TYPE_LABELS[owner.type]}) • {shelter.contactPhone}
        </Txt>
      </Card>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {action.error && <Notice tone="danger">{action.error}</Notice>}

      {shelter.isAvailable ? (
        <Card>
          <Field label="Allocate evacuees" hint={`${shelter.remainingCapacity} places remaining`}>
            <NumberField label="Allocate evacuees" value={people} onChange={setPeople} />
          </Field>
          <ButtonRow>
            <Button onPress={() => void allocate()} disabled={action.busy}>Confirm allocation</Button>
            <Button variant="secondary" onPress={() => void action.run(() => app.shelters.release(shelter.id, people, user))}>Release</Button>
          </ButtonRow>
        </Card>
      ) : (
        <Notice tone="danger">{`Unavailable: ${shelter.unavailableReason}`}</Notice>
      )}

      {alternatives.length > 0 && <SectionTitle>Alternative shelters</SectionTitle>}
      {alternatives.slice(0, 4).map((alt) => (
        <ShelterRow key={alt.id} shelter={alt} />
      ))}

      {shelter.isAvailable ? (
        <Card>
          <Field label="Shelter no longer usable?">
            <TextField label="Reason the shelter is unavailable" value={reason} onChangeText={setReason} placeholder="e.g. Flood water entered the hall" />
          </Field>
          <Button variant="danger" onPress={() => void markUnavailable()}>Mark unavailable</Button>
        </Card>
      ) : (
        <Button block variant="secondary" onPress={() => void action.run(() => app.shelters.reopen(shelter.id, user))}>Reopen shelter</Button>
      )}
    </Screen>
  );
}

export function RegisterShelterScreen() {
  const { app, user } = useSafeZone();
  const nav = useNav();
  const { districtId } = useCoordinationScope();
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
    if (shelter) nav.go(`/coordination/shelters/${shelter.id}`);
  };

  return (
    <Screen title="Register Shelter" subtitle={`${app.geo.districtName(districtId)} District`} back="/coordination/shelters">
      <Field label="Shelter name" error={errors.name}>
        <TextField label="Shelter name" value={form.name} invalid={!!errors.name} onChangeText={(name) => edit({ name })} />
      </Field>
      <Field label="Address" error={errors.address}>
        <TextField label="Address" value={form.address} invalid={!!errors.address} onChangeText={(address) => edit({ address })} />
      </Field>
      <Field label="Capacity (people)" error={errors.capacity}>
        <NumberField label="Capacity (people)" value={form.capacity} invalid={!!errors.capacity} onChange={(capacity) => edit({ capacity })} />
      </Field>
      <Field label="Managing organisation" error={errors.ownerId}>
        <SelectField
          label="Managing organisation"
          placeholder="Select organisation"
          value={form.ownerId}
          invalid={!!errors.ownerId}
          onChange={(ownerId) => edit({ ownerId })}
          options={app.organisations.list().map((o) => ({ value: o.id, label: o.name }))}
        />
      </Field>
      <Field label="Emergency desk phone">
        <TextField label="Emergency desk phone" value={form.contactPhone} onChangeText={(contactPhone) => edit({ contactPhone })} placeholder="+94 ..." />
      </Field>
      <Field label="Facilities (comma separated)">
        <TextField label="Facilities (comma separated)" value={form.facilities} onChangeText={(facilities) => edit({ facilities })} />
      </Field>
      {action.error && <Notice tone="danger">{action.error}</Notice>}
      <Button block onPress={() => void submit()}>Register shelter</Button>
    </Screen>
  );
}
