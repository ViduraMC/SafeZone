import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { severityRank } from '@/core/hazard/SeverityLevel';
import { isAlertRecipient } from '@/core/users/UserAccount';
import { useSafeZone } from '../AppContext';
import { tabsFor } from '../navigation';
import { SEVERITY_LABELS } from '../lib/format';
import { Icon } from './Icon';
import { severityTone } from './Primitives';

/** Top banner with the most severe active warning, as in the hi-fi wireframes. */
function StatusBanner() {
  const { app, user } = useSafeZone();
  const navigate = useNavigate();
  const alerts = isAlertRecipient(user) ? app.alerts.listForDistrict(user.homeDistrictId).active : app.alerts.listActive();
  const top = [...alerts].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
  if (!top) {
    return (
      <div className="banner banner--advisory">
        <span className="banner__tag">CLEAR</span>
        <span className="banner__text">No active warnings for your area</span>
      </div>
    );
  }
  return (
    <button type="button" className={`banner banner--${severityTone(top.severity)}`} onClick={() => navigate(`/alerts/${top.id}`)}>
      <span className="banner__tag">{SEVERITY_LABELS[top.severity].toUpperCase()}</span>
      <span className="banner__text">{top.title}</span>
      <span aria-hidden="true">›</span>
    </button>
  );
}

function ConnectivityPill() {
  const { app } = useSafeZone();
  const online = app.connectivity.isOnline();
  const pending = app.sync.pending().length;
  return (
    <button
      type="button"
      className={`pill ${online ? 'pill--online' : 'pill--offline'}`}
      onClick={() => app.connectivity.setOnline(!online)}
      title="Simulate network connectivity"
    >
      <Icon name={online ? 'wifi' : 'wifiOff'} size={14} />
      {online ? 'Online' : 'Offline'}
      {pending > 0 && <span className="pill__count">{pending}</span>}
    </button>
  );
}

function BottomNav() {
  const { user } = useSafeZone();
  return (
    <nav className="tabbar" aria-label="Main">
      {tabsFor(user).map((tab) => (
        <NavLink key={tab.to} to={tab.to} end className={({ isActive }) => `tabbar__item ${isActive ? 'is-active' : ''}`}>
          <Icon name={tab.icon} size={22} />
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function Screen({ title, subtitle, back, actions, children }: { title: string; subtitle?: string; back?: boolean | string; actions?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="phone">
      <StatusBanner />
      <header className="screen-header">
        <div className="screen-header__row">
          {back && (
            <button type="button" className="icon-btn" aria-label="Back" onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}>
              <Icon name="back" />
            </button>
          )}
          <h1 className="screen-header__title">{title}</h1>
          <ConnectivityPill />
        </div>
        {subtitle && <p className="screen-header__subtitle">{subtitle}</p>}
        {actions}
      </header>
      <main className="screen-body">{children}</main>
      <BottomNav />
    </div>
  );
}
