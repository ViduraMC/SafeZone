import { useMemo, useState } from 'react';
import { hasRole, Role } from '@/core/users/UserAccount';
import { DONOR_CATEGORIES } from '@/modules/analytics/application/ReportAccessPolicy';
import type { ReportExporter } from '@/modules/analytics/application/ReportExporter';
import { REPORT_CATEGORY_LABELS, ReportCategory } from '@/modules/analytics/domain/ReportCriteria';
import type { DisasterResponseReport, ReportSection } from '@/modules/analytics/domain/ReportSections';
import { OWNER_TYPE_LABELS, type OwnerType } from '@/core/organisations/ResourceOwner';
import { useSafeZone } from '../../AppContext';
import { Button, Card, ChipGroup, Field, Notice, SectionTitle, SeverityBadge, StatTile } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { formatDate, formatDateTime, percent, titleCase, toDateInputValue } from '../../lib/format';
import { useAction } from '../../lib/useAction';
import { BarList, OccupancyChart } from './Charts';

const ALL_CATEGORIES = Object.values(ReportCategory);

function download(exporter: ReportExporter, report: DisasterResponseReport, content: string) {
  const blob = new Blob([content], { type: exporter.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${report.id}-${report.eventName.replace(/\W+/g, '-')}.${exporter.fileExtension}`;
  link.click();
  URL.revokeObjectURL(url);
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
      app.reportGenerator.generate(
        { eventId, categories, districtIds, from: new Date(`${from}T00:00:00`), to: new Date(`${to}T23:59:59`) },
        user,
      ),
    );
    if (result) setReport(result);
  };

  if (report) return <ReportView report={report} onBack={() => setReport(undefined)} onRegenerate={generate} />;

  const errors = action.fieldErrors;
  return (
    <Screen title="Disaster Response Reports" subtitle={isDonor ? 'Contribution report for your organisation' : 'Post-event statistical analysis'}>
      <Field label="Disaster event" htmlFor="event">
        <select id="event" value={eventId} onChange={(e) => selectEvent(e.target.value)}>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} {e.endedAt ? '(ended)' : '(ongoing)'}
            </option>
          ))}
        </select>
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
      <Field label="Districts" error={errors.districtIds} hint="None selected = all districts affected by the event">
        <ChipGroup
          label="Districts"
          options={(event?.districtIds ?? []).map((id) => ({ value: id, label: app.geo.districtName(id) }))}
          selected={districtIds}
          onToggle={(id) => setDistrictIds(districtIds.includes(id) ? districtIds.filter((x) => x !== id) : [...districtIds, id])}
        />
      </Field>
      <Field label="Reporting period" error={errors.period}>
        <div className="date-range">
          <input type="date" aria-label="From" value={from} onChange={(e) => {
              setFrom(e.target.value);
              action.clearFields('period');
            }} />
          <span>to</span>
          <input type="date" aria-label="To" value={to} onChange={(e) => {
              setTo(e.target.value);
              action.clearFields('period');
            }} />
        </div>
      </Field>
      {action.error && <Notice tone="danger">{action.error}</Notice>}
      <Button block onClick={generate} disabled={action.busy}>
        Generate report
      </Button>
    </Screen>
  );
}

function ReportView({ report, onBack, onRegenerate }: { report: DisasterResponseReport; onBack(): void; onRegenerate(): void }) {
  const { app } = useSafeZone();
  const names = useMemo(() => ({ districtName: (id: string) => app.geo.districtName(id) }), [app]);
  return (
    <Screen title="Report generated" subtitle={report.eventName}>
      <Card>
        <p className="small">
          {report.id} • {report.districtIds.map(names.districtName).join(', ')}
          <br />
          {formatDate(report.periodFrom)} - {formatDate(report.periodTo)} • generated {formatDateTime(report.generatedAt)}
        </p>
      </Card>
      {report.notices.map((notice) => (
        <Notice key={notice} tone="warning">
          {notice} The report may be incomplete.
        </Notice>
      ))}
      {report.sections.map((section) => (
        <SectionView key={section.category} section={section} />
      ))}
      <div className="button-row no-print">
        {app.exporters.map((exporter) => (
          <Button key={exporter.label} variant="secondary" onClick={() => download(exporter, report, exporter.export(report, names))}>
            Export {exporter.label}
          </Button>
        ))}
        <Button variant="secondary" onClick={() => window.print()}>
          Print / PDF
        </Button>
      </div>
      <div className="button-row no-print">
        <Button variant="ghost" onClick={onBack}>
          Change criteria
        </Button>
        <Button variant="ghost" onClick={onRegenerate}>
          Regenerate
        </Button>
      </div>
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
          <div className="stats">
            <StatTile label="Issued" value={section.totals.issued} />
            <StatTile label="Escalated" value={section.totals.escalated} />
            <StatTile label="Resolved" value={section.totals.resolved} />
          </div>
          <ol className="timeline">
            {section.entries.map((entry) => (
              <li key={`${entry.alertId}-${entry.action}-${entry.at.toISOString()}`}>
                <span className="muted small">{formatDateTime(entry.at)}</span>
                <span>
                  <SeverityBadge severity={entry.severity} /> <strong>{titleCase(entry.action)}</strong> {entry.title}
                </span>
                {entry.note && <span className="muted small">{entry.note}</span>}
              </li>
            ))}
          </ol>
        </>
      );
    case ReportCategory.CITIZENS_REACHED:
      return (
        <>
          <SectionTitle>Citizens reached</SectionTitle>
          <div className="stats">
            <StatTile label="Targeted" value={section.targeted} />
            <StatTile label="Reached" value={section.reached} />
            <StatTile label="Delivery rate" value={percent(section.reachRate)} />
          </div>
          <BarList rows={section.byDistrict.map((d) => ({ label: name(d.districtId), value: d.reached, max: Math.max(1, d.targeted), caption: `${d.reached}/${d.targeted}` }))} />
          <p className="muted small">
            Deliveries: {Object.entries(section.deliveriesByChannel).map(([channel, n]) => `${channel} ${n}`).join(' • ') || 'none'}
          </p>
        </>
      );
    case ReportCategory.SHELTER_OCCUPANCY:
      return (
        <>
          <SectionTitle>Shelter occupancy over time</SectionTitle>
          <div className="stats">
            <StatTile label="Peak sheltered" value={section.peakTotalOccupancy} />
            <StatTile label="Capacity" value={section.totalCapacity} />
            <StatTile label="Peak use" value={percent(section.peakUtilisation)} />
          </div>
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
          {section.restrictedToOwnerId && <Notice tone="info">Showing only resources contributed by {app.organisations.get(section.restrictedToOwnerId).name}.</Notice>}
          <BarList rows={Object.entries(section.totalsByDistrict).map(([id, qty]) => ({ label: name(id), value: qty }))} />
          <p className="caps small muted">By contributor</p>
          <BarList rows={section.byOwner.map((o) => ({ label: `${o.ownerName} (${OWNER_TYPE_LABELS[o.ownerType as OwnerType] ?? o.ownerType})`, value: o.quantity }))} />
          <table className="table">
            <thead>
              <tr>
                <th>District</th>
                <th>Item</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row) => (
                <tr key={`${row.districtId}-${row.itemName}-${row.ownerName}`}>
                  <td>{name(row.districtId)}</td>
                  <td>
                    {row.itemName}
                    <br />
                    <span className="muted small">{row.ownerName}</span>
                  </td>
                  <td>
                    {row.quantity.toLocaleString()} {row.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    case ReportCategory.RESCUE_OPERATIONS:
      return (
        <>
          <SectionTitle>Rescue operations</SectionTitle>
          <div className="stats">
            <StatTile label="Missions" value={section.missions} />
            <StatTile label="People rescued" value={section.peopleRescued} />
            <StatTile label="Avg. response" value={section.averageResponseMinutes === undefined ? 'n/a' : `${section.averageResponseMinutes} min`} />
          </div>
          <BarList rows={section.byTeam.map((t) => ({ label: t.teamName, value: t.peopleRescued, caption: `${t.peopleRescued} (${t.missions})` }))} />
          <p className="muted small">{section.crossOrganisationMissions} mission(s) used a team borrowed from another district or organisation.</p>
        </>
      );
  }
}
