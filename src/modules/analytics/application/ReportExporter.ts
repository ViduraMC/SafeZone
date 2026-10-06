import { REPORT_CATEGORY_LABELS, ReportCategory } from '../domain/ReportCriteria';
import type { DisasterResponseReport, ReportSection } from '../domain/ReportSections';

export interface NameLookup {
  districtName(id: string): string;
}

/**
 * Export format strategy. Separates file formatting from statistics (the
 * original AnalysisReport.exportStatisticalReport(): File mixed both).
 */
export interface ReportExporter {
  readonly label: string;
  readonly mimeType: string;
  readonly fileExtension: string;
  export(report: DisasterResponseReport, names: NameLookup): string;
}

export class CsvReportExporter implements ReportExporter {
  readonly label = 'CSV';
  readonly mimeType = 'text/csv';
  readonly fileExtension = 'csv';

  export(report: DisasterResponseReport, names: NameLookup): string {
    const lines: string[][] = [
      ['Report', report.id],
      ['Event', report.eventName],
      ['Districts', report.districtIds.map((id) => names.districtName(id)).join('; ')],
      ['Period', `${report.periodFrom.toISOString()} to ${report.periodTo.toISOString()}`],
      ['Generated', report.generatedAt.toISOString()],
      [],
      ['Section', 'Metric', 'Value'],
    ];
    report.sections.forEach((section) => lines.push(...sectionRows(section, names)));
    report.notices.forEach((notice) => lines.push(['Notice', notice]));
    return lines.map((cells) => cells.map(escapeCsv).join(',')).join('\n');
  }
}

export class JsonReportExporter implements ReportExporter {
  readonly label = 'JSON';
  readonly mimeType = 'application/json';
  readonly fileExtension = 'json';

  export(report: DisasterResponseReport): string {
    return JSON.stringify(report, null, 2);
  }
}

function sectionRows(section: ReportSection, names: NameLookup): string[][] {
  const label = REPORT_CATEGORY_LABELS[section.category];
  const row = (metric: string, value: string | number) => [label, metric, String(value)];
  switch (section.category) {
    case ReportCategory.ALERT_TIMELINE:
      return section.entries.map((e) =>
        row(`${e.at.toISOString()} ${e.action}`, `${e.alertId} ${e.severity} - ${e.title}`),
      );
    case ReportCategory.CITIZENS_REACHED:
      return [
        row('Citizens targeted', section.targeted),
        row('Citizens reached', section.reached),
        row('Reach rate', `${Math.round(section.reachRate * 100)}%`),
        ...section.byDistrict.map((d) => row(`Reached in ${names.districtName(d.districtId)}`, `${d.reached}/${d.targeted}`)),
      ];
    case ReportCategory.SHELTER_OCCUPANCY:
      return [
        row('Total capacity', section.totalCapacity),
        row('Peak occupancy', section.peakTotalOccupancy),
        ...section.shelters.map((s) => row(`Peak at ${s.shelterName}`, `${s.peakOccupancy}/${s.capacity}`)),
      ];
    case ReportCategory.RESOURCE_DISTRIBUTION:
      return section.rows.map((r) =>
        row(`${names.districtName(r.districtId)} - ${r.itemName} (${r.ownerName})`, `${r.quantity} ${r.unit}`),
      );
    case ReportCategory.RESCUE_OPERATIONS:
      return [
        row('Missions completed', section.missions),
        row('People rescued', section.peopleRescued),
        row('Average response (minutes)', section.averageResponseMinutes ?? 'n/a'),
        ...section.byTeam.map((t) => row(`${t.teamName} (${t.ownerName})`, `${t.missions} missions, ${t.peopleRescued} rescued`)),
      ];
  }
}

function escapeCsv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
