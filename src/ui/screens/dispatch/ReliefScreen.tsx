import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { InsufficientStockError } from '@/modules/dispatch/domain/Relief';
import { OWNER_TYPE_LABELS, OwnerType } from '@/core/organisations/ResourceOwner';
import { useSafeZone } from '../../AppContext';
import { Button, Card, ChipGroup, Field, Notice, NumberField, Row, SectionTitle, SelectField, Txt } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { timeAgo, titleCase } from '../../lib/format';
import { useAction } from '../../lib/useAction';
import { colors } from '../../theme';
import { ScopeSelector, useCoordinationScope } from '../common/CoordinationScope';

const GENERAL = 'GENERAL';

/** UC04 steps 9-12 with A2 (filter by owner) and E1 (insufficient supplies). */
export function ReliefScreen() {
  const { app, user } = useSafeZone();
  const { districtId, eventId } = useCoordinationScope();
  const [ownerTypes, setOwnerTypes] = useState<OwnerType[]>([]);
  const [stockId, setStockId] = useState('');
  const [quantity, setQuantity] = useState(50);
  const [shelterId, setShelterId] = useState(GENERAL);
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
        return app.relief.distribute({ stockId, quantity, districtId, shelterId: shelterId === GENERAL ? undefined : shelterId, eventId }, user);
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
      <SectionTitle>Available stock</SectionTitle>
      {stock.map(({ stock: s, owner }) => (
        <Pressable
          key={s.id}
          accessibilityRole="button"
          accessibilityLabel={`${s.itemName}, ${owner.name}`}
          accessibilityState={{ selected: stockId === s.id }}
          onPress={() => setStockId(s.id)}
          style={[styles.stock, stockId === s.id && styles.stockActive]}
        >
          <Row>
            <Txt strong>{s.itemName}</Txt>
            <Txt strong color={colors.navy}>
              {s.available.toLocaleString()} {s.unit}
            </Txt>
          </Row>
          <Txt small muted>
            {owner.name} • {titleCase(s.category)}
          </Txt>
        </Pressable>
      ))}

      {selected && (
        <Card tone="info">
          <Txt strong>
            Distribute {selected.stock.itemName} ({selected.owner.name})
          </Txt>
          <Field label={`Quantity (${selected.stock.unit})`} hint={`${selected.stock.available} available`}>
            <NumberField label="Quantity" value={quantity} onChange={setQuantity} />
          </Field>
          <Field label="Destination shelter (optional)">
            <SelectField
              label="Destination shelter"
              value={shelterId}
              onChange={setShelterId}
              options={[{ value: GENERAL, label: `${app.geo.districtName(districtId)} District (general)` }, ...shelters.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </Field>
          {shortage && <Notice tone="warning">{shortage}</Notice>}
          {action.error && !shortage && <Notice tone="danger">{action.error}</Notice>}
          <Button block onPress={() => void distribute()} disabled={action.busy}>Confirm allocation</Button>
        </Card>
      )}
      {done && <Notice tone="success">{done}</Notice>}

      <SectionTitle>Recent distributions</SectionTitle>
      {recent.length === 0 && <Txt small muted>Nothing distributed to this district yet.</Txt>}
      {recent.map((d) => (
        <Txt key={d.id} small>
          <Txt small strong>
            {d.quantity} {d.unit}
          </Txt>{' '}
          {d.itemName} • {app.organisations.get(d.ownerId).name} • {timeAgo(d.distributedAt, app.clock.now())}
        </Txt>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stock: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 8, gap: 2 },
  stockActive: { borderColor: colors.navy, borderWidth: 2, backgroundColor: colors.infoBg },
});
