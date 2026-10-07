import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { PERSONAS, ROLE_LABELS } from '@/app/demo/personas';
import { useRefresh, useSafeZone } from '../../AppContext';
import { Badge, Button, Card, SectionTitle, Toggle, Txt } from '../../components/Primitives';
import { Screen } from '../../components/Shell';
import { timeAgo } from '../../lib/format';
import { useNav } from '../../lib/useNav';
import { colors } from '../../theme';

/**
 * Notifications, persona switcher and simulation controls. Login is out of
 * scope (assignment brief), and network, SMS and GPS behaviour may be simulated.
 */
export function HubScreen() {
  const { app, user, switchUser } = useSafeZone();
  const refresh = useRefresh();
  const nav = useNav();
  const [syncMessage, setSyncMessage] = useState<string>();
  const inbox = app.inbox.forUser(user.id).slice(0, 8);
  const pending = app.sync.pending();

  const syncNow = async () => {
    const summary = await app.sync.flush();
    setSyncMessage(
      app.connectivity.isOnline()
        ? `${summary.synced} synchronised, ${summary.failed} failed, ${summary.remaining} remaining.`
        : 'Still offline. Updates remain stored on this device.',
    );
  };

  return (
    <Screen title="Hub" subtitle={`${user.name} • ${user.roles.map((r) => ROLE_LABELS[r]).join(', ')}`}>
      <SectionTitle>Notifications</SectionTitle>
      {inbox.length === 0 && <Txt small muted>No notifications.</Txt>}
      {inbox.map((message) => (
        <Pressable
          key={message.id}
          accessibilityRole="button"
          onPress={() => {
            app.inbox.markRead(message.id);
            refresh();
            if (message.link) nav.go(message.link);
          }}
          style={[styles.inboxItem, !message.read && styles.unread]}
        >
          <Txt strong>{message.title}</Txt>
          <Txt small>{message.body}</Txt>
          <Txt small muted>
            {timeAgo(message.createdAt, app.clock.now())}
            {message.audibleOverride ? ' • audible emergency alert' : ''}
          </Txt>
        </Pressable>
      ))}

      <SectionTitle>Demo persona</SectionTitle>
      <Card>
        <Txt small muted>Login is out of scope. Switch between the actors of the five use cases.</Txt>
        {PERSONAS.map((persona) => (
          <Pressable
            key={persona.id}
            accessibilityRole="button"
            accessibilityLabel={persona.name}
            onPress={() => switchUser(persona.id)}
            style={[styles.persona, persona.id === user.id && styles.personaActive]}
          >
            <Txt strong>{persona.name}</Txt>
            <Txt small muted>{persona.roles.map((r) => ROLE_LABELS[r]).join(' + ')}</Txt>
          </Pressable>
        ))}
      </Card>

      <SectionTitle>Offline sync</SectionTitle>
      <Card>
        {pending.length === 0 ? (
          <Txt small muted>Everything is synchronised.</Txt>
        ) : (
          pending.map((item) => (
            <View key={item.id} style={styles.pending}>
              <Badge tone="watch">PENDING</Badge>
              <Txt small>
                {item.description}
                {item.lastError ? ` (last error: ${item.lastError})` : ''}
              </Txt>
            </View>
          ))
        )}
        <Button variant="secondary" onPress={() => void syncNow()}>Sync now</Button>
        {syncMessage ? <Txt small>{syncMessage}</Txt> : null}
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
        <Button variant="ghost" onPress={() => app.remoteServer.failNext(1)}>Make the next sync fail (server error)</Button>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inboxItem: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 8, gap: 2 },
  unread: { borderLeftWidth: 4, borderLeftColor: colors.info },
  persona: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginTop: 6 },
  personaActive: { borderColor: colors.navy, backgroundColor: colors.infoBg },
  pending: { gap: 4, marginBottom: 8 },
});
