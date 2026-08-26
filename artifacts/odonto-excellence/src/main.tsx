import { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import ManagementEntry from './ManagementEntry';
import applicationStyles from './index.css?inline';
import managementControlStyles from './managementControl.css?inline';
import managementArchiveStyles from './managementArchive.css?inline';
import realtimePresenceStyles from './realtimePresence.css?inline';
import privateBrandingStyles from './privateBranding.css?inline';
import accessIsolationStyles from './accessIsolation.css?inline';
import { installStabilityEnhancements } from './stabilityEnhancements';
import { installContactStatusEnhancements } from './contactStatusEnhancements';
import {
  installPrivateAccessNetworkEnhancements,
  prewarmPrivateSession,
} from './privateAccessNetwork';

const PRIVATE_API_HEALTH = 'https://odonto-excellence-api.onrender.com/api/healthz';
let privateAppPromise: Promise<typeof import('./App')> | null = null;

function preloadPrivateApp() {
  privateAppPromise ??= import('./App');
  return privateAppPromise;
}

const PrivateApp = lazy(preloadPrivateApp);

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
installInlineStyle('controle-gestao-realtime-styles', realtimePresenceStyles);
installInlineStyle('controle-gestao-private-branding', privateBrandingStyles);
installInlineStyle('controle-gestao-access-isolation', accessIsolationStyles);

// Fetch/session stability must exist before the private application starts its
// auth and state effects. The access wrapper is installed after it so it can
// cache the final stabilized auth response instead of bypassing the safeguards.
installStabilityEnhancements();
installPrivateAccessNetworkEnhancements();
installContactStatusEnhancements();

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

function navigateSpa(path: string) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
}

function installPrivateAccessNavigation() {
  const marker = window as typeof window & { __controlePrivateNavigation?: boolean };
  if (marker.__controlePrivateNavigation) return;
  marker.__controlePrivateNavigation = true;

  const eligibleAnchor = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return null;
    const anchor = target.closest('a[href="/acesso"]');
    return anchor instanceof HTMLAnchorElement ? anchor : null;
  };

  document.addEventListener('pointerover', (event) => {
    if (eligibleAnchor(event.target)) {
      void preloadPrivateApp();
      void prewarmPrivateSession();
    }
  }, { passive: true });

  document.addEventListener('focusin', (event) => {
    if (eligibleAnchor(event.target)) {
      void preloadPrivateApp();
      void prewarmPrivateSession();
    }
  });

  document.addEventListener('click', (event) => {
    const anchor = eligibleAnchor(event.target);
    if (!anchor) return;
    if (
      event instanceof MouseEvent &&
      (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    ) return;
    event.preventDefault();
    void preloadPrivateApp();
    void prewarmPrivateSession();
    navigateSpa('/acesso');
  });
}

function warmPrivateApi() {
  void fetch(PRIVATE_API_HEALTH, {
    method: 'GET',
    cache: 'no-store',
    mode: 'cors',
  }).catch(() => undefined);
  void prewarmPrivateSession();
}

installHistorySignal();
installPrivateAccessNavigation();

function PrivateLoading() {
  return (
    <div className="private-entry-loader" aria-live="polite" aria-busy="true">
      <div className="private-entry-loader-card">
        <span className="private-entry-spinner" />
        <div>
          <b>Abrindo ambiente privado</b>
          <small>Preparando acesso seguro</small>
        </div>
      </div>
    </div>
  );
}

function PrivateExperience({ path }: { path: string }) {
  const isAccess = path === '/acesso';

  useEffect(() => {
    void installPrivateEnhancements(path);
  }, [path]);

  useEffect(() => {
    document.documentElement.classList.toggle('controle-access-route', isAccess);
    return () => document.documentElement.classList.remove('controle-access-route');
  }, [isAccess]);

  useEffect(() => {
    const title = document.querySelector('title');
    if (!title) return;
    const enforce = () => {
      const next = isAccess
        ? 'Acesso · Controle de Gestão'
        : 'Ambiente Privado · Controle de Gestão';
      if (document.title !== next) document.title = next;
    };
    enforce();
    const observer = new MutationObserver(enforce);
    observer.observe(title, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [isAccess]);

  return (
    <div className={isAccess ? 'private-access-route' : 'private-app-route'}>
      <Suspense fallback={<PrivateLoading />}>
        <PrivateApp />
      </Suspense>
    </div>
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
    if (path !== '/') return;
    document.title = 'Controle de Gestão · Ações e Conversões';

    warmPrivateApi();
    const warmTimer = window.setInterval(warmPrivateApi, 4 * 60_000);

    const browser = window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId: number | null = null;
    let fallbackId: number | null = null;
    if (browser.requestIdleCallback) {
      idleId = browser.requestIdleCallback(() => void preloadPrivateApp(), { timeout: 1200 });
    } else {
      fallbackId = window.setTimeout(() => void preloadPrivateApp(), 650);
    }

    return () => {
      window.clearInterval(warmTimer);
      if (idleId !== null) browser.cancelIdleCallback?.(idleId);
      if (fallbackId !== null) window.clearTimeout(fallbackId);
    };
  }, [path]);

  return path === '/'
    ? <ManagementEntry />
    : <PrivateExperience path={path} />;
}

createRoot(document.getElementById('root')!).render(<RootExperience />);
