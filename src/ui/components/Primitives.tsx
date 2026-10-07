import { useState, type ReactNode } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SeverityLevel } from '@/core/hazard/SeverityLevel';
import { SEVERITY_LABELS } from '../lib/format';
import { colors, radius, space, toneColors, type Tone } from '../theme';
import { Icon, type IconName } from './Icon';

/* ------------------------------------------------------------------ text */

interface TxtProps {
  readonly children?: ReactNode;
  readonly small?: boolean;
  readonly muted?: boolean;
  readonly strong?: boolean;
  readonly lead?: boolean;
  readonly caps?: boolean;
  readonly color?: string;
  readonly style?: StyleProp<TextStyle>;
  readonly numberOfLines?: number;
}

/** One text component with the few variants the wireframes use. */
export function Txt({ children, small, muted, strong, lead, caps, color, style, numberOfLines }: TxtProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        styles.text,
        small && styles.small,
        lead && styles.lead,
        caps && styles.caps,
        strong && styles.strong,
        muted && styles.muted,
        color ? { color } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

/* ---------------------------------------------------------------- layout */

export function Card({ children, tone, style }: { children: ReactNode; tone?: 'danger' | 'warning' | 'info' | 'success'; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, tone && { backgroundColor: toneColors[tone].bg, borderColor: toneColors[tone].fg }, style]}>{children}</View>;
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

/** Tappable list card; the coloured left edge shows severity. */
export function ListCard({ children, onPress, accent, label }: { children: ReactNode; onPress(): void; accent?: Tone; label?: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.card, accent && { borderLeftWidth: 5, borderLeftColor: toneColors[accent].fg }, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: { label: string; onPress(): void } }) {
  return (
    <Row style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{children}</Text>
      {action && <LinkText onPress={action.onPress}>{action.label}</LinkText>}
    </Row>
  );
}

export function LinkText({ children, onPress }: { children: ReactNode; onPress(): void }) {
  return (
    <Text accessibilityRole="link" style={styles.link} onPress={onPress}>
      {children}
    </Text>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Txt strong>{title}</Txt>
      {children ? <Txt small muted style={styles.center}>{children}</Txt> : null}
    </View>
  );
}

/* -------------------------------------------------------------- controls */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'light';

const BUTTON_COLORS: Readonly<Record<ButtonVariant, { bg: string; fg: string; border: string }>> = {
  primary: { bg: colors.navy, fg: colors.white, border: colors.navy },
  secondary: { bg: colors.surface, fg: colors.navy, border: colors.navy },
  danger: { bg: colors.critical, fg: colors.white, border: colors.critical },
  ghost: { bg: 'transparent', fg: colors.info, border: 'transparent' },
  light: { bg: colors.white, fg: colors.critical, border: colors.white },
};

export function Button({
  children,
  onPress,
  variant = 'primary',
  disabled,
  icon,
  block,
  label,
}: {
  children: string;
  onPress(): void;
  /** Accessible name when the visible text alone is ambiguous. */
  label?: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  icon?: IconName;
  block?: boolean;
}) {
  const c = BUTTON_COLORS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? children}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: c.bg, borderColor: c.border },
        block && styles.block,
        variant === 'ghost' && styles.ghost,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      {icon && <Icon name={icon} size={18} color={c.fg} />}
      <Text style={[styles.buttonText, { color: c.fg }]}>{children}</Text>
    </Pressable>
  );
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <View style={styles.buttonRow}>{children}</View>;
}

export type BadgeTone = Tone;

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <View style={[styles.badge, { backgroundColor: toneColors[tone].bg }]}>
      <Text style={[styles.badgeText, { color: toneColors[tone].fg }]}>{children}</Text>
    </View>
  );
}

const SEVERITY_TONE: Readonly<Record<SeverityLevel, BadgeTone>> = {
  [SeverityLevel.ADVISORY]: 'advisory',
  [SeverityLevel.WARNING]: 'warning',
  [SeverityLevel.EMERGENCY]: 'critical',
};

export function severityTone(severity: SeverityLevel): BadgeTone {
  return SEVERITY_TONE[severity];
}

export function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  return <Badge tone={SEVERITY_TONE[severity]}>{`● ${SEVERITY_LABELS[severity].toUpperCase()}`}</Badge>;
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{children}</Text>
    </View>
  );
}

export function Field({ label, error, hint, children }: { label: string; error?: string | null; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint && !error ? <Txt small muted>{hint}</Txt> : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  invalid,
}: {
  label: string;
  value: string;
  onChangeText(text: string): void;
  placeholder?: string;
  multiline?: boolean;
  invalid?: boolean;
}) {
  return (
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      multiline={multiline}
      style={[styles.input, multiline && styles.textarea, invalid && styles.inputInvalid]}
    />
  );
}

/** Numeric input that keeps the value as a number. */
export function NumberField({ label, value, onChange, invalid }: { label: string; value: number; onChange(value: number): void; invalid?: boolean }) {
  return (
    <TextInput
      accessibilityLabel={label}
      keyboardType="number-pad"
      value={Number.isFinite(value) ? String(value) : ''}
      onChangeText={(text) => onChange(text.trim() === '' ? Number.NaN : Number(text))}
      style={[styles.input, invalid && styles.inputInvalid]}
    />
  );
}

export interface Option<T extends string> {
  readonly value: T;
  readonly label: string;
}

/** Drop-down replacement: a field that opens a list of options in a modal sheet. */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select',
  invalid,
}: {
  label: string;
  value: T | '';
  options: readonly Option<T>[];
  onChange(value: T): void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={[styles.input, styles.select, invalid && styles.inputInvalid]}>
        <Text style={[styles.text, !current && styles.muted]} numberOfLines={1}>
          {current?.label ?? placeholder}
        </Text>
        <Icon name="down" size={18} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <Row style={styles.sheetHeader}>
            <Txt strong>{label}</Txt>
            <Pressable accessibilityLabel="Close" onPress={() => setOpen(false)}>
              <Icon name="close" size={22} color={colors.text} />
            </Pressable>
          </Row>
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={[styles.option, item.value === value && styles.optionActive]}
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
              >
                <Text style={[styles.text, item.value === value && styles.strong]}>{item.label}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: readonly Option<T>[]; value: T; onChange(value: T): void; label: string }) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ChipGroup<T extends string>({ options, selected, onToggle, label }: { options: readonly Option<T>[]; selected: readonly T[]; onToggle(value: T): void; label: string }) {
  return (
    <View accessibilityLabel={label} style={styles.chips}>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <Pressable
            key={option.value}
            accessibilityRole="checkbox"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: active }}
            onPress={() => onToggle(option.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ label, description, on, onChange }: { label: string; description: string; on: boolean; onChange(on: boolean): void }) {
  return (
    <Row style={styles.toggle}>
      <View style={styles.flex}>
        <Txt strong>{label}</Txt>
        <Txt small muted>{description}</Txt>
      </View>
      <Switch accessibilityLabel={label} value={on} onValueChange={onChange} trackColor={{ true: colors.advisory, false: colors.border }} />
    </Row>
  );
}

/* -------------------------------------------------------------- feedback */

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'danger' | 'warning' | 'success'; children: ReactNode }) {
  const c = toneColors[tone];
  return (
    <View accessibilityRole={tone === 'danger' ? 'alert' : 'summary'} style={[styles.notice, { backgroundColor: c.bg, borderColor: c.fg }]}>
      {typeof children === 'string' ? <Txt small>{children}</Txt> : children}
    </View>
  );
}

export function ProgressBar({ ratio, tone }: { ratio: number; tone?: 'danger' | 'warning' | 'success' }) {
  const resolved = tone ?? (ratio >= 1 ? 'danger' : ratio >= 0.8 ? 'warning' : 'success');
  const width = `${Math.min(100, Math.max(0, ratio * 100))}%` as const;
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }} style={styles.progress}>
      <View style={[styles.progressBar, { width, backgroundColor: toneColors[resolved].fg }]} />
    </View>
  );
}

export function Stats({ children }: { children: ReactNode }) {
  return <View style={styles.stats}>{children}</View>;
}

export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Txt small muted>{sub}</Txt> : null}
    </View>
  );
}

/** Label and value pairs (definition list). */
export function KeyValue({ rows }: { rows: readonly [string, ReactNode][] }) {
  return (
    <View style={styles.kv}>
      {rows.map(([key, value]) => (
        <View key={key} style={styles.kvRow}>
          <Txt small muted>{key}</Txt>
          {typeof value === 'string' || typeof value === 'number' ? <Txt>{value}</Txt> : value}
        </View>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  text: { color: colors.text, fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  lead: { fontSize: 17, fontWeight: '600', lineHeight: 23 },
  caps: { textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 12 },
  strong: { fontWeight: '700' },
  muted: { color: colors.muted },
  center: { textAlign: 'center' },
  flex: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: space,
    gap: 6,
  },
  pressed: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { marginTop: 10, marginBottom: 8 },
  sectionTitleText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.navy },
  link: { color: colors.info, fontWeight: '600', fontSize: 14 },
  empty: { alignItems: 'center', padding: 24, gap: 6 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  ghost: { paddingVertical: 6, paddingHorizontal: 0, alignSelf: 'flex-start', marginBottom: 2 },
  block: { alignSelf: 'stretch' },
  buttonText: { fontSize: 15, fontWeight: '700' },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  field: { marginBottom: 14, gap: 6 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  fieldError: { color: colors.critical, fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  inputInvalid: { borderColor: colors.critical, borderWidth: 1.5 },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: colors.surface, maxHeight: '70%', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingBottom: 24 },
  sheetHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  option: { paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#f0ede8' },
  optionActive: { backgroundColor: colors.infoBg },
  segmented: { flexDirection: 'row', backgroundColor: '#e9e5de', borderRadius: 12, padding: 3, marginBottom: space },
  segment: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  segmentTextActive: { color: colors.navy, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 13, color: colors.text },
  chipTextActive: { color: colors.white, fontWeight: '700' },
  toggle: { paddingVertical: 8 },
  notice: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: space, gap: 4 },
  progress: { height: 8, borderRadius: 999, backgroundColor: '#ece8e1', overflow: 'hidden', marginVertical: 4 },
  progressBar: { height: 8, borderRadius: 999 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: space },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 10, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.navy },
  statLabel: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  kv: { gap: 10 },
  kvRow: { gap: 2 },
});
