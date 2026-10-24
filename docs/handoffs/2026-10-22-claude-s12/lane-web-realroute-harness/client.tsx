import * as React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { loadViewOnIntent } from '/home/rob/.codex/worktrees/phase2-slice12/WeJammin/apps/web/src/components/cms-editorial-workflow/cms-lazy-view';

const Below = await loadViewOnIntent<{ region: string }>('below', () => import('./GateForm'));
const Top = await loadViewOnIntent<{ region: string }>('top', () => import('./GateForm'));
hydrateRoot(document.getElementById('root')!, <App />);
function App(): React.ReactElement {
  return (<>
    <section><React.Suspense fallback={null}><Top region="top" /></React.Suspense></section>
    <div style={{ height: 3000 }}>spacer</div>
    <section><React.Suspense fallback={null}><Below region="below" /></React.Suspense></section>
  </>);
}
export { App };
