import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import PublicControl from './PublicControl';
import applicationStyles from './index.css?inline';
import publicControlStyles from './publicControl.css?inline';
import { installStabilityEnhancements } from './stabilityEnhancements';
import { installTrainingProgressEnhancements } from './trainingProgressEnhancements';
import { installRuntimeEnhancements } from './runtimeEnhancements';
import { installHierarchyEnhancements } from './hierarchyEnhancements';
import { installAdminRoleEnhancements } from './adminRoleEnhancements';
import { installAdminStructureIntegration } from './adminStructureIntegration';

function installInlineStyle(id: string, css: string) {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.append(style);
}

// Keep the application shell self-contained for static hosts. The second sheet
// contains the new public control and the neutral/personal visual identity.
installInlineStyle('controle-pessoal-core-styles', applicationStyles);
installInlineStyle('controle-pessoal-public-styles', publicControlStyles);

function neutralCopy(value: string) {
  return value
    .replace(/ODONTO EXCELLENCE/g, 'CONTROLE PESSOAL')
    .replace(/Odonto Excellence/g, 'Controle Pessoal')
    .replace(/Portal do Colaborador/gi, 'Ambiente Privado')
    .replace(/REDE NACIONAL/g, 'AMBIENTE PRIVADO');
}

function neutralizeTextNode(node: Text) {
  const tag = node.parentElement?.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'NOSCRIPT') return;
  const current = node.nodeValue ?? '';
  const next = neutralCopy(current);
  if (next !== current) node.nodeValue = next;
}

function neutralizeSubtree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    neutralizeTextNode(root as Text);
    return;
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    neutralizeTextNode(current as Text);
    current = walker.nextNode();
  }
}

function installNeutralBranding() {
  const fixTitle = () => {
    const next = neutralCopy(document.title);
    if (next !== document.title) document.title = next;
  };
  neutralizeSubtree(document.body);
  fixTitle();
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') neutralizeTextNode(record.target as Text);
      for (const node of record.addedNodes) neutralizeSubtree(node);
    }
    fixTitle();
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
  });
}

installNeutralBranding();

// Session/fetch/timer stability must be installed before React effects issue
// the first auth and synchronization requests.
installStabilityEnhancements();
installTrainingProgressEnhancements();
installRuntimeEnhancements();
installHierarchyEnhancements();
installAdminRoleEnhancements();
installAdminStructureIntegration();

// Wouter changes history without a full reload. Mirror those changes so this
// outer boundary can swap the public, loginless control for the authenticated
// application whenever the path changes.
for (const method of ['pushState', 'replaceState'] as const) {
  const original = window.history[method];
  window.history[method] = function (...args: Parameters<History[typeof method]>) {
    const result = original.apply(this, args);
    window.dispatchEvent(new Event('controle-location-change'));
    return result;
  } as History[typeof method];
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
    document.title = path === '/'
      ? 'Controle Pessoal · Ações e Conversões'
      : 'Controle Pessoal · Área Administrativa';
  }, [path]);

  return path === '/' ? <PublicControl /> : <App />;
}

createRoot(document.getElementById('root')!).render(<RootExperience />);
