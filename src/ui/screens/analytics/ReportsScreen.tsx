import { useMemo, useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { hasRole, Role } from '@/core/users/UserAccount';
import { DONOR_CATEGORIES } from '@/modules/analytics/application/ReportAccessPolicy';
import type { ReportExporter } from '@/modules/analytics/application/ReportExporter';
import { REPORT_CATEGORY_LABELS, ReportCategory } from '@/modules/analytics/domain/ReportCriteria';
import type { DisasterResponseReport, ReportSection } from '@/modules/analytics/domain/ReportSections';
import { OWNER_TYPE_LABELS, type OwnerType } from '@/core/organisations/ResourceOwner';
import { useSafeZone } from '../../AppContext';
import { Button, ButtonRow, Card, ChipGroup, Field, Notice, Row, SectionTitle, SelectField, SeverityBadge, StatTile, Stats, TextField, Txt } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { formatDate, formatDateTime, percent, titleCase, toDateInputValue } from '../../lib/format';
import { useAction } from '../../lib/useAction';
import { colors } from '../../theme';
import { BarList, OccupancyChart } from './Charts';

const ALL_CATEGORIES = Object.values(ReportCategory);

/** Hands the exported file to the phone's share sheet (or downloads it on the web build). */
async function shareExport(exporter: ReportExporter, report: DisasterResponseReport, content: string): Promise<void> {
  const fileName = `${report.id}-${report.eventName.replace(/\W+/g, '-')}.${exporter.fileExtension}`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: exporter.mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: fileName, message: content });
}

/** UC05 main flow steps 1-17 with A1-A4 and E1-E4. */
export function ReportsScreen() {
  const { app, user } = useSafeZone();
  const isDonor = hasRole(user, Role.DONOR_REPRESENTATIVE);
  const events = app.reportGenerator.availableEvents();
  const [eventId, setEventId] = useState(events[0]?.id ?? '');
  const event = events.find((e) => e.id === eventId);
  const [categories, setCategories] = useState<ReportCategory[]>(isDonor ? [...DONOR_CATEGORIES] : ALL_CATEGORIES);
  const [districtIds, setDistrictIds] = useState<string[]>([]);
  const [from, setFrom] = useState(event ? toDateInputValue(event.startedAt) : '');
  const [to, setTo] = useState(toDateInputValue(event?.endedAt ?? app.clock.now()));
  const [report, setReport] = useState<DisasterResponseReport>();
  const action = useAction();

  const selectEvent = (id: string) => {
    const next = events.find((e) => e.id === id);
    setEventId(id);
    setDistrictIds([]);
    if (next) {
      setFrom(toDateInputValue(next.startedAt));
      setTo(toDateInputValue(next.endedAt ?? app.clock.now()));
    }
  };

  const generate = async () => {
    const result = await action.run(() =>
      app.reportGenerator.generate({ eventId, categories, districtIds, from: new Date(`${from}T00:00:00`), to: new Date(`${to}T23:59:59`) }, user),
    );
    if (result) setReport(result);
  };

  if (report) return <ReportView report={report} onBack={() => setReport(undefined)} onRegenerate={() => void generate()} />;

  const errors = action.fieldErrors;
  return (
    <Screen title="Disaster Response Reports" subtitle={isDonor ? 'Contribution report for your organisation' : 'Post-event statistical analysis'}>
      <Field label="Disaster event">
        <SelectField label="Disaster event" value={eventId} onChange={selectEvent} options={events.map((e) => ({ value: e.id, label: `${e.name} ${e.endedAt ? '(ended)' : '(ongoing)'}` }))} />
      </Field>
      <Field label="Report information" error={errors.categories} hint={isDonor ? 'Donor organisations can view the distribution of their own contributions.' : undefined}>
        <ChipGroup<ReportCategory>
          label="Report categories"
          options={ALL_CATEGORIES.map((c) => ({ value: c, label: REPORT_CATEGORY_LABELS[c] }))}
          selected={categories}
          onToggle={(c) => {
            setCategories(categories.includes(c) ? categories.filter((x) => x !== c) : [...categories, c]);
            action.clearFields('categories');
          }}
        />
      </Field>
      <Field label="Districts" error={errors.districtIds} hint="None selected means all districts affected by the event">
        <ChipGroup
          label="Districts"
          options={(event?.districtIds ?? []).map((id) => ({ value: id, label: app.geo.districtName(id) }))}
          selected={districtIds}
          onToggle={(id) => setDistrictIds(districtIds.includes(id) ? districtIds.filter((x) => x !== id) : [...districtIds, id])}
        />
      </Field>
      <Field label="Reporting period (YYYY-MM-DD)" error={errors.period}>
        <View style={styles.dateRange}>
          <View style={styles.flex}>
            <TextField
              label="From"
              value={from}
              invalid={!!errors.period}
              onChangeText={(text) => {
                setFrom(text);
                action.clearFields('period');
              }}
            />
          </View>
          <Txt muted>to</Txt>
          <View style={styles.flex}>
            <TextField
              label="To"
              value={to}
              invalid={!!errors.period}
              onChangeText={(text) => {
                setTo(text);
                action.clearFields('period');
              }}
            />
          </View>
        </View>
      </Field>
      {action.error && <Notice tone="danger">{action.error}</Notice>}
      <Button block onPress={() => void generate()} disabled={action.busy}>Generate report</Button>
    </Screen>
  );
}

function ReportView({ report, onBack, onRegenerate }: { report: DisasterResponseReport; onBack(): void; onRegenerate(): void }) {
  const { app } = useSafeZone();
  const names = useMemo(() => ({ districtName: (id: string) => app.geo.districtName(id) }), [app]);
  return (
    <Screen title="Report generated" subtitle={report.eventName}>
      <Card>
        <Txt small>
          {report.id} • {report.districtIds.map(names.districtName).join(', ')}
        </Txt>
        <Txt small muted>
          {formatDate(report.periodFrom)} to {formatDate(report.periodTo)} • generated {formatDateTime(report.generatedAt)}
        </Txt>
      </Card>
      {report.notices.map((notice) => (
        <Notice key={notice} tone="warning">{`${notice} The report may be incomplete.`}</Notice>
      ))}
      {report.sections.map((section) => (
        <SectionView key={section.category} section={section} />
      ))}
      <ButtonRow>
        {app.exporters.map((exporter) => (
          <Button key={exporter.label} variant="secondary" onPress={() => void shareExport(exporter, report, exporter.export(report, names))}>
            {`Export ${exporter.label}`}
          </Button>
        ))}
      </ButtonRow>
      <ButtonRow>
        <Button variant="ghost" onPress={onBack}>Change criteria</Button>
        <Button variant="ghost" onPress={onRegenerate}>Regenerate</Button>
      </ButtonRow>
    </Screen>
  );
}

function SectionView({ section }: { section: ReportSection }) {
  const { app } = useSafeZone();
  const name = (id: string) => app.geo.districtName(id);
  switch (section.category) {
    case ReportCategory.ALERT_TIMELINE:
      return (
        <>
          <SectionTitle>Alert timeline</SectionTitle>
          <Stats>
            <StatTile label="Issued" value={section.totals.issued} />
            <StatTile label="Escalated" value={section.totals.escalated} />
            <StatTile label="Resolved" value={section.totals.resolved} />
          </Stats>
          {section.entries.map((entry) => (
            <View key={`${entry.alertId}-${entry.action}-${entry.at.toISOString()}`} style={styles.timelineItem}>
              <Txt small muted>{formatDateTime(entry.at)}</Txt>
              <Row style={styles.start}>
                <SeverityBadge severity={entry.severity} />
                <Txt small strong>{titleCase(entry.action)}</Txt>
              </Row>
              <Txt small>{entry.title}</Txt>
              {entry.note ? <Txt small muted>{entry.note}</Txt> : null}
            </View>
          ))}
        </>
      );
    case ReportCategory.CITIZENS_REACHED:
      return (
        <>
          <SectionTitle>Citizens reached</SectionTitle>
          <Stats>
            <StatTile label="Targeted" value={section.targeted} />
            <StatTile label="Reached" value={section.reached} />
            <StatTile label="Delivery rate" value={percent(section.reachRate)} />
          </Stats>
          <BarList rows={section.byDistrict.map((d) => ({ label: name(d.districtId), value: d.reached, max: Math.max(1, d.targeted), caption: `${d.reached}/${d.targeted}` }))} />
          <Txt small muted>
            Deliveries: {Object.entries(section.deliveriesByChannel).map(([channel, n]) => `${channel} ${n}`).join(' • ') || 'none'}
          </Txt>
        </>
      );
    case ReportCategory.SHELTER_OCCUPANCY:
      return (
        <>
          <SectionTitle>Shelter occupancy over time</SectionTitle>
          <Stats>
            <StatTile label="Peak sheltered" value={section.peakTotalOccupancy} />
            <StatTile label="Capacity" value={section.totalCapacity} />
            <StatTile label="Peak use" value={percent(section.peakUtilisation)} />
          </Stats>
          <Card>
            <OccupancyChart shelters={section.shelters} capacity={section.totalCapacity} />
          </Card>
          <BarList rows={section.shelters.map((s) => ({ label: s.shelterName, value: s.peakOccupancy, max: s.capacity, caption: `${s.peakOccupancy}/${s.capacity}` }))} />
        </>
      );
    case ReportCategory.RESOURCE_DISTRIBUTION:
      return (
        <>
          <SectionTitle>Resource distribution by district</SectionTitle>
          {section.restrictedToOwnerId && <Notice tone="info">{`Showing only resources contributed by ${app.organisations.get(section.restrictedToOwnerId).name}.`}</Notice>}
          <BarList rows={Object.entries(section.totalsByDistrict).map(([id, qty]) => ({ label: name(id), value: qty }))} />
          <Txt caps small muted>By contributor</Txt>
          <BarList rows={section.byOwner.map((o) => ({ label: `${o.ownerName} (${OWNER_TYPE_LABELS[o.ownerType as OwnerType] ?? o.ownerType})`, value: o.quantity }))} />
          <Card>
            {section.rows.map((row) => (
              <Row key={`${row.districtId}-${row.itemName}-${row.ownerName}`} style={styles.tableRow}>
                <View style={styles.flex}>
                  <Txt small strong>{row.itemName}</Txt>
                  <Txt small muted>
                    {name(row.districtId)} • {row.ownerName}
                  </Txt>
                </View>
                <Txt small strong>
                  {row.quantity.toLocaleString()} {row.unit}
                </Txt>
              </Row>
            ))}
          </Card>
        </>
      );
    case ReportCategory.RESCUE_OPERATIONS:
      return (
        <>
          <SectionTitle>Rescue operations</SectionTitle>
          <Stats>
            <StatTile label="Missions" value={section.missions} />
            <StatTile label="People rescued" value={section.peopleRescued} />
            <StatTile label="Avg. response" value={section.averageResponseMinutes === undefined ? 'n/a' : `${section.averageResponseMinutes} min`} />
          </Stats>
          <BarList rows={section.byTeam.map((t) => ({ label: t.teamName, value: t.peopleRescued, caption: `${t.peopleRescued} (${t.missions})` }))} />
          <Txt small muted>{section.crossOrganisationMissions} mission(s) used a team borrowed from another district or organisation.</Txt>
        </>
      );
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  start: { justifyContent: 'flex-start' },
  dateRange: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timelineItem: { borderLeftWidth: 3, borderLeftColor: colors.border, paddingLeft: 10, marginBottom: 10, gap: 2 },
  tableRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0ede8' },
});
