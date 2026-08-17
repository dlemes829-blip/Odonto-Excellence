import { createRoot } from 'react-dom/client';

import App from './App';
import applicationStyles from './index.css?inline';
import { installRuntimeEnhancements } from './runtimeEnhancements';

// Keep the application shell self-contained for static hosts. Some providers
// can publish the JavaScript bundle while dropping a separately emitted CSS asset.
const styleId = 'odonto-excellence-styles';
if (!document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = applicationStyles;
  document.head.append(style);
}

installRuntimeEnhancements();
createRoot(document.getElementById('root')!).render(<App />);
