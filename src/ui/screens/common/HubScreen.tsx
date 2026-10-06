import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PERSONAS, ROLE_LABELS } from '@/app/demo/personas';
import { useRefresh, useSafeZone } from '../../AppContext';
import { Badge, Button, Card, SectionTitle } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { timeAgo } from '../../lib/format';
import { homeRouteFor } from '../../navigation';

function Toggle({ label, description, on, onChange }: { label: string; description: string; on: boolean; onChange(on: boolean): void }) {
  return (
    <label className="toggle">
      <span>
        <span className="strong">{label}</span>
        <span className="muted small block">{description}</span>
      </span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/**
 * Persona switcher, notifications and simulation controls. Login is out of
 * scope (assignment brief), and IoT/network/SMS/GPS behaviour may be simulated.
 */
export function HubScreen() {
  const { app, user, switchUser } = useSafeZone();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [syncMessage, setSyncMessage] = useState<string>();
  const inbox = app.inbox.forUser(user.id).slice(0, 8);
  const pending = app.sync.pending();

  const choosePersona = (id: string) => {
    switchUser(id);
    navigate(homeRouteFor(app.users.get(id)));
  };

  const syncNow = async () => {
    const summary = await app.sync.flush();
    setSyncMessage(
      app.connectivity.isOnline()
        ? `${summary.synced} synchronised, ${summary.failed} failed, ${summary.remaining} remaining.`
        : 'Still offline - updates remain stored on this device.',
    );
  };

  return (
    <Screen title="Hub" subtitle={`${user.name} • ${user.roles.map((r) => ROLE_LABELS[r]).join(', ')}`}>
      <SectionTitle>Notifications</SectionTitle>
      {inbox.length === 0 && <p className="muted small">No notifications.</p>}
      {inbox.map((message) => (
        <button
          key={message.id}
          type="button"
          className={`inbox-item ${message.read ? '' : 'is-unread'}`}
          onClick={() => {
            app.inbox.markRead(message.id);
            refresh();
            if (message.link) navigate(message.link);
          }}
        >
          <span className="strong">{message.title}</span>
          <span className="small">{message.body}</span>
          <span className="muted small">
            {timeAgo(message.createdAt, app.clock.now())}
            {message.audibleOverride && ' • audible emergency alert'}
          </span>
        </button>
      ))}

      <SectionTitle>Demo persona</SectionTitle>
      <Card>
        <p className="muted small">Login is out of scope; switch between the actors of the four use cases.</p>
        <div className="persona-list">
          {PERSONAS.map((persona) => (
            <button key={persona.id} type="button" className={`persona ${persona.id === user.id ? 'is-active' : ''}`} onClick={() => choosePersona(persona.id)}>
              <span className="strong">{persona.name}</span>
              <span className="muted small">{persona.roles.map((r) => ROLE_LABELS[r]).join(' + ')}</span>
            </button>
          ))}
        </div>
      </Card>

      <SectionTitle>Offline sync</SectionTitle>
      <Card>
        {pending.length === 0 ? (
          <p className="muted small">Everything is synchronised.</p>
        ) : (
          <ul className="plain-list">
            {pending.map((item) => (
              <li key={item.id} className="small">
                <Badge tone="watch">PENDING</Badge> {item.description}
                {item.lastError && <span className="muted"> - last error: {item.lastError}</span>}
              </li>
            ))}
          </ul>
        )}
        <Button variant="secondary" onClick={syncNow}>
          Sync now
        </Button>
        {syncMessage && <p className="small">{syncMessage}</p>}
      </Card>

      <SectionTitle>Simulation controls</SectionTitle>
      <Card>
        <Toggle label="Data network" description="Push notifications and sync need data connectivity" on={app.connectivity.isOnline()} onChange={(on) => app.connectivity.setOnline(on)} />
        <Toggle
          label="SMS gateway"
          description="Bulk SMS provider availability"
          on={app.smsGateway.isAvailable()}
          onChange={(on) => {
            app.smsGateway.setAvailable(on);
            refresh();
          }}
        />
        <Toggle
          label="Device GPS"
          description="Turn off to demo manual location entry"
          on={app.gps.isAvailable()}
          onChange={(on) => {
            app.gps.setAvailable(on);
            refresh();
          }}
        />
        <Button variant="ghost" onClick={() => app.remoteServer.failNext(1)}>
          Make the next sync fail (server error)
        </Button>
      </Card>
    </Screen>
  );
}
