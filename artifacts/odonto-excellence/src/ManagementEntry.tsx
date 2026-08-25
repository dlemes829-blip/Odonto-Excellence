import { lazy, Suspense, useEffect, useState } from 'react';

const DesktopManagementControl = lazy(() => import('./ManagementControl'));
const StreetMobileControl = lazy(() => import('./StreetMobileControl'));

const MOBILE_QUERY = '(max-width: 760px)';

function mobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;
}

function LoadingControl() {
  return (
    <div className="mg-entry-loading" aria-live="polite" aria-busy="true">
      <span />
      Carregando controle
    </div>
  );
}

export default function ManagementEntry() {
  const [mobile, setMobile] = useState(mobileViewport);
  const forceDesktop = new URLSearchParams(window.location.search).get('view') === 'desktop';

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return (
    <Suspense fallback={<LoadingControl />}>
      {mobile && !forceDesktop ? <StreetMobileControl /> : <DesktopManagementControl />}
    </Suspense>
  );
}
