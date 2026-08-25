import { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import ManagementControl from './ManagementControl';
import applicationStyles from './index.css?inline';
import managementControlStyles from './managementControl.css?inline';
import managementArchiveStyles from './managementArchive.css?inline';
import privateBrandingStyles from './privateBranding.css?inline';
import { installStabilityEnhancements } from './stabilityEnhancements';

const PrivateApp = lazy(() => import('./App'));

function installInlineStyle(id: string, css: string) {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.append(style);
}

installInlineStyle('controle-gestao-core-styles', applicationStyles);
installInlineStyle('controle-gestao-public-styles', managementControlStyles);
installInlineStyle('controle-gestao-archive-styles', managementArchiveStyles);
installInlineStyle('controle-gestao-private-branding', privateBrandingStyles);

// Fetch/session stability must exist before the private application starts its
// auth and state effects. It also warms the private API while the public control
// is being used, reducing the first authenticated navigation delay.
installStabilityEnhancements();

let runtimeInstalled = false;
let trainingInstalled = false;
let hierarchyInstalled = false;
let adminRoleInstalled = false;
let adminStructureInstalled = false;

async function installPrivateEnhancements(path: string) {
  if (path.includes('/treinamento')) {
    if (!trainingInstalled) {
      const module = await import('./trainingProgressEnhancements');
      module.installTrainingProgressEnhancements();
      trainingInstalled = true;
    }
    if (!runtimeInstalled) {
      const module = await import('./runtimeEnhancements');
      module.installRuntimeEnhancements();
      runtimeInstalled = true;
    }
  }

  if (path.includes('/admin')) {
    if (!runtimeInstalled) {
      const module = await import('./runtimeEnhancements');
      module.installRuntimeEnhancements();
      runtimeInstalled = true;
    }
    if (!hierarchyInstalled) {
      const module = await import('./hierarchyEnhancements');
      module.installHierarchyEnhancements();
      hierarchyInstalled = true;
    }
    if (!adminRoleInstalled) {
      const module = await import('./adminRoleEnhancements');
      module.installAdminRoleEnhancements();
      adminRoleInstalled = true;
    }
    if (!adminStructureInstalled) {
      const module = await import('./adminStructureIntegration');
      module.installAdminStructureIntegration();
      adminStructureInstalled = true;
    }
  }
}

function installHistorySignal() {
  const marker = window as typeof window & { __controleHistorySignal?: boolean };
  if (marker.__controleHistorySignal) return;
  marker.__controleHistorySignal = true;
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method];
    window.history[method] = function (...args: Parameters<History[typeof method]>) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event('controle-location-change'));
      return result;
    } as History[typeof method];
  }
}

installHistorySignal();

function PrivateLoading() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f6f7f8' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#66717a', fontSize: 12 }}>
        <span style={{ width: 18, height: 18, border: '2px solid #d8dee2', borderTopColor: '#245c6e', borderRadius: '50%', animation: 'controle-spin .7s linear infinite' }} />
        Abrindo ambiente privado
        <style>{'@keyframes controle-spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    </div>
  );
}

function PrivateExperience({ path }: { path: string }) {
  useEffect(() => {
    void installPrivateEnhancements(path);
  }, [path]);

  useEffect(() => {
    const title = document.querySelector('title');
    if (!title) return;
    const enforce = () => {
      if (document.title !== 'Ambiente Privado · Controle de Gestão') {
        document.title = 'Ambiente Privado · Controle de Gestão';
      }
    };
    enforce();
    const observer = new MutationObserver(enforce);
    observer.observe(title, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return (
    <Suspense fallback={<PrivateLoading />}>
      <PrivateApp />
    </Suspense>
  );
}

function RootExperience() {
  const [path, setPath] = useState(() => window.location.pathname || '/');

  useEffect(() => {
    const syncPath = () => setPath(window.location.pathname || '/');
    window.addEventListener('popstate', syncPath);
    window.addEventListener('controle-location-change', syncPath);
    return () => {
      window.removeEventListener('popstate', syncPath);
      window.removeEventListener('controle-location-change', syncPath);
    };
  }, []);

  useEffect(() => {
    if (path === '/') document.title = 'Controle de Gestão · Ações e Conversões';
  }, [path]);

  return path === '/'
    ? <ManagementControl />
    : <PrivateExperience path={path} />;
}

createRoot(document.getElementById('root')!).render(<RootExperience />);
