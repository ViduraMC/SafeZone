import type { ShelterSeries } from '@/modules/analytics/domain/ReportSections';
import { formatDate } from '../../lib/format';

/** Total sheltered population over time, combining every shelter's series. */
export function occupancyTimeline(shelters: readonly ShelterSeries[]): { at: Date; total: number }[] {
  const points = shelters
    .flatMap((s) => s.points.map((p) => ({ shelterId: s.shelterId, ...p })))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const current = new Map<string, number>();
  return points.map((p) => {
    current.set(p.shelterId, p.occupancy);
    return { at: p.at, total: [...current.values()].reduce((sum, v) => sum + v, 0) };
  });
}

export function OccupancyChart({ shelters, capacity }: { shelters: readonly ShelterSeries[]; capacity: number }) {
  const series = occupancyTimeline(shelters);
  if (series.length < 2) return <p className="muted small">Not enough data points to chart.</p>;
  const width = 340;
  const height = 150;
  const pad = 28;
  const t0 = series[0].at.getTime();
  const t1 = series[series.length - 1].at.getTime();
  const max = Math.max(capacity, ...series.map((p) => p.total), 1);
  const x = (t: number) => pad + ((t - t0) / Math.max(1, t1 - t0)) * (width - pad * 2);
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2);
  // Step line: occupancy holds until the next recorded change.
  const d = series.map((p, i) => `${i === 0 ? 'M' : `H${x(p.at.getTime()).toFixed(1)} V`}${i === 0 ? `${x(p.at.getTime()).toFixed(1)} ` : ''}${y(p.total).toFixed(1)}`).join(' ');

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Total shelter occupancy over time">
      <line x1={pad} y1={y(capacity)} x2={width - pad} y2={y(capacity)} className="chart__capacity" />
      <text x={width - pad} y={y(capacity) - 4} textAnchor="end" className="chart__label">
        capacity {capacity}
      </text>
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="chart__axis" />
      <path d={d} className="chart__line" />
      {series.map((p) => (
        <circle key={p.at.toISOString()} cx={x(p.at.getTime())} cy={y(p.total)} r={2.5} className="chart__dot" />
      ))}
      <text x={pad} y={height - 8} className="chart__label">
        {formatDate(series[0].at)}
      </text>
      <text x={width - pad} y={height - 8} textAnchor="end" className="chart__label">
        {formatDate(series[series.length - 1].at)}
      </text>
    </svg>
  );
}

export function BarList({ rows }: { rows: readonly { label: string; value: number; max?: number; caption?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.max ?? r.value));
  return (
    <div className="bars">
      {rows.map((row) => (
        <div key={row.label} className="bars__row">
          <span className="bars__label">{row.label}</span>
          <span className="bars__track">
            <span className="bars__fill" style={{ width: `${(row.value / (row.max ?? max)) * 100}%` }} />
          </span>
          <span className="bars__value">{row.caption ?? row.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
