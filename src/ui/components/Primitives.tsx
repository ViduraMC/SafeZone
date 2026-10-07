import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { SeverityLevel } from '@/core/hazard/SeverityLevel';
import { SEVERITY_LABELS } from '../lib/format';

export function Card({ children, className = '', tone }: { children: ReactNode; className?: string; tone?: 'danger' | 'warning' | 'info' | 'success' }) {
  return <section className={`card ${tone ? `card--${tone}` : ''} ${className}`}>{children}</section>;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  variant = 'primary',
  block,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; block?: boolean }) {
  return (
    <button type="button" className={`btn btn--${variant} ${block ? 'btn--block' : ''} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export type BadgeTone = 'critical' | 'warning' | 'watch' | 'advisory' | 'neutral' | 'success' | 'info';

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

const SEVERITY_TONE: Readonly<Record<SeverityLevel, BadgeTone>> = {
  [SeverityLevel.ADVISORY]: 'advisory',
  [SeverityLevel.WARNING]: 'warning',
  [SeverityLevel.EMERGENCY]: 'critical',
};

export function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  return (
    <Badge tone={SEVERITY_TONE[severity]}>
      <span className="dot" /> {SEVERITY_LABELS[severity].toUpperCase()}
    </Badge>
  );
}

export function severityTone(severity: SeverityLevel): BadgeTone {
  return SEVERITY_TONE[severity];
}

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className={`field ${error ? 'field--invalid' : ''}`}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="field__hint">{hint}</p>}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'danger' | 'warning' | 'success'; children: ReactNode }) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function ProgressBar({ ratio, tone }: { ratio: number; tone?: 'danger' | 'warning' | 'success' }) {
  const width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
  const resolved = tone ?? (ratio >= 1 ? 'danger' : ratio >= 0.8 ? 'warning' : 'success');
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress__bar progress__bar--${resolved}`} style={{ width }} />
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: readonly { value: T; label: string }[]; value: T; onChange(value: T): void; label: string }) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={`segmented__item ${option.value === value ? 'is-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ChipGroup<T extends string>({ options, selected, onToggle, label }: { options: readonly { value: T; label: string }[]; selected: readonly T[]; onToggle(value: T): void; label: string }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <button key={option.value} type="button" aria-pressed={active} className={`chip ${active ? 'is-active' : ''}`} onClick={() => onToggle(option.value)}>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
      {sub && <span className="stat__sub">{sub}</span>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {children && <p className="empty__body">{children}</p>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-title">
      <h3>{children}</h3>
      {action}
    </div>
  );
}
