import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createSafeZone } from './app/container';
import { PERSONA_IDS } from './app/demo/personas';
import { seedDemoData } from './app/demo/seed';
import { App } from './ui/App';
import { AppProvider } from './ui/AppContext';
import './ui/styles.css';

async function bootstrap(): Promise<void> {
  const app = createSafeZone();
  await seedDemoData(app);
  const params = new URLSearchParams(window.location.search);
  const persona = params.get('persona');
  if (persona) {
    try {
      window.localStorage.setItem('safezone.persona', persona);
    } catch {
      /* storage unavailable: the initial persona still applies */
    }
  }

  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <AppProvider app={app} initialUserId={persona ?? PERSONA_IDS.citizen}>
        <App />
      </AppProvider>
    </StrictMode>,
  );
}

void bootstrap();
