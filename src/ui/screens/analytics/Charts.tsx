import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { ShelterSeries } from '@/modules/analytics/domain/ReportSections';
import { Txt } from '../../components/Primitives';
import { formatDate } from '../../lib/format';
import { colors } from '../../theme';

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

const WIDTH = 340;
const HEIGHT = 150;
const PAD = 28;

export function OccupancyChart({ shelters, capacity }: { shelters: readonly ShelterSeries[]; capacity: number }) {
  const series = occupancyTimeline(shelters);
  if (series.length < 2) return <Txt small muted>Not enough data points to chart.</Txt>;
  const t0 = series[0].at.getTime();
  const t1 = series[series.length - 1].at.getTime();
  const max = Math.max(capacity, ...series.map((p) => p.total), 1);
  const x = (t: number) => PAD + ((t - t0) / Math.max(1, t1 - t0)) * (WIDTH - PAD * 2);
  const y = (v: number) => HEIGHT - PAD - (v / max) * (HEIGHT - PAD * 2);
  // Step line: occupancy holds until the next recorded change.
  const d = series.map((p, i) => (i === 0 ? `M${x(p.at.getTime()).toFixed(1)} ${y(p.total).toFixed(1)}` : `H${x(p.at.getTime()).toFixed(1)} V${y(p.total).toFixed(1)}`)).join(' ');

  return (
    <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} accessibilityLabel="Total shelter occupancy over time">
      <Line x1={PAD} y1={y(capacity)} x2={WIDTH - PAD} y2={y(capacity)} stroke={colors.critical} strokeDasharray="4 4" />
      <SvgText x={WIDTH - PAD} y={y(capacity) - 4} textAnchor="end" fontSize={10} fill={colors.muted}>
        {`capacity ${capacity}`}
      </SvgText>
      <Line x1={PAD} y1={HEIGHT - PAD} x2={WIDTH - PAD} y2={HEIGHT - PAD} stroke={colors.border} />
      <Path d={d} stroke={colors.info} strokeWidth={2.5} fill="none" />
      {series.map((p) => (
        <Circle key={p.at.toISOString()} cx={x(p.at.getTime())} cy={y(p.total)} r={2.5} fill={colors.info} />
      ))}
      <SvgText x={PAD} y={HEIGHT - 8} fontSize={10} fill={colors.muted}>
        {formatDate(series[0].at)}
      </SvgText>
      <SvgText x={WIDTH - PAD} y={HEIGHT - 8} textAnchor="end" fontSize={10} fill={colors.muted}>
        {formatDate(series[series.length - 1].at)}
      </SvgText>
    </Svg>
  );
}

export function BarList({ rows }: { rows: readonly { label: string; value: number; max?: number; caption?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.max ?? r.value));
  return (
    <View style={styles.bars}>
      {rows.map((row) => (
        <View key={row.label} style={styles.bar}>
          <Txt small style={styles.label} numberOfLines={2}>
            {row.label}
          </Txt>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, (row.value / (row.max ?? max)) * 100)}%` }]} />
          </View>
          <Txt small strong style={styles.value}>
            {row.caption ?? row.value.toLocaleString()}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { gap: 8, marginBottom: 12 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 110 },
  track: { flex: 1, height: 10, backgroundColor: '#ece8e1', borderRadius: 999, overflow: 'hidden' },
  fill: { height: 10, backgroundColor: colors.navy2, borderRadius: 999 },
  value: { minWidth: 56, textAlign: 'right' },
});
