import { useState } from 'react';
import { InsufficientStockError } from '@/modules/dispatch/domain/Relief';
import { OWNER_TYPE_LABELS, OwnerType } from '@/core/organisations/ResourceOwner';
import { useSafeZone } from '../../AppContext';
import { Button, Card, ChipGroup, Field, Notice, SectionTitle } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { timeAgo, titleCase } from '../../lib/format';
import { useAction } from '../../lib/useAction';
import { ScopeSelector, useCoordinationScope } from '../common/CoordinationScope';

/** UC04 steps 9-12 with A2 (filter by owner) and E1 (insufficient supplies). */
export function ReliefScreen() {
  const { app, user } = useSafeZone();
  const { districtId, eventId } = useCoordinationScope();
  const [ownerTypes, setOwnerTypes] = useState<OwnerType[]>([]);
  const [stockId, setStockId] = useState('');
  const [quantity, setQuantity] = useState(50);
  const [shelterId, setShelterId] = useState('');
  const [shortage, setShortage] = useState<string>();
  const [done, setDone] = useState<string>();
  const action = useAction();
  const stock = app.relief.availableStock(ownerTypes.length > 0 ? ownerTypes : undefined);
  const shelters = app.shelters.sheltersInDistrict(districtId);
  const recent = app.relief.distributionsTo(districtId).slice(0, 5);
  const selected = stock.find((v) => v.stock.id === stockId);

  const distribute = async () => {
    setShortage(undefined);
    setDone(undefined);
    const result = await action.run(() => {
      try {
        return app.relief.distribute({ stockId, quantity, districtId, shelterId: shelterId || undefined, eventId }, user);
      } catch (error) {
        if (error instanceof InsufficientStockError) {
          setShortage(`Only ${error.available} available. Reduce the quantity or choose stock from another organisation.`);
        }
        throw error;
      }
    });
    if (result) setDone(`Recorded ${result.quantity} ${result.unit} of ${result.itemName} to ${app.geo.districtName(districtId)}.`);
  };

  return (
    <Screen title="Relief Supplies" subtitle="Pooled across government, armed forces, NGOs and donors">
      <ScopeSelector />
      <ChipGroup<OwnerType>
        label="Filter by owner"
        options={Object.values(OwnerType).map((t) => ({ value: t, label: OWNER_TYPE_LABELS[t] }))}
        selected={ownerTypes}
        onToggle={(t) => setOwnerTypes(ownerTypes.includes(t) ? ownerTypes.filter((x) => x !== t) : [...ownerTypes, t])}
      />
      <div className="stock-list">
        {stock.map(({ stock: s, owner }) => (
          <button key={s.id} type="button" className={`stock ${stockId === s.id ? 'is-active' : ''}`} onClick={() => setStockId(s.id)}>
            <span className="stock__name">{s.itemName}</span>
            <span className="muted small">
              {owner.name} • {titleCase(s.category)}
            </span>
            <span className="stock__qty">
              {s.available.toLocaleString()} {s.unit}
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <Card tone="info">
          <p className="strong">
            Distribute {selected.stock.itemName} ({selected.owner.name})
          </p>
          <Field label={`Quantity (${selected.stock.unit})`} htmlFor="qty" hint={`${selected.stock.available} available`}>
            <input id="qty" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          </Field>
          <Field label="Destination shelter (optional)" htmlFor="dest">
            <select id="dest" value={shelterId} onChange={(e) => setShelterId(e.target.value)}>
              <option value="">{app.geo.districtName(districtId)} District (general)</option>
              {shelters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          {shortage && <Notice tone="warning">{shortage}</Notice>}
          {action.error && !shortage && <Notice tone="danger">{action.error}</Notice>}
          <Button block onClick={distribute} disabled={action.busy}>
            Confirm allocation
          </Button>
        </Card>
      )}
      {done && <Notice tone="success">{done}</Notice>}

      <SectionTitle>Recent distributions</SectionTitle>
      {recent.length === 0 && <p className="muted small">Nothing distributed to this district yet.</p>}
      {recent.map((d) => (
        <p key={d.id} className="small">
          <strong>
            {d.quantity} {d.unit}
          </strong>{' '}
          {d.itemName} • {app.organisations.get(d.ownerId).name} • {timeAgo(d.distributedAt, app.clock.now())}
        </p>
      ))}
    </Screen>
  );
}
