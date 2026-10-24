import * as React from 'react';
import { renderToString } from 'react-dom/server';
import GateForm from './GateForm';
export const html = (): string => renderToString(<>
  <section><React.Suspense fallback={null}><GateForm region="top" /></React.Suspense></section>
  <div style={{ height: 3000 }}>spacer</div>
  <section><React.Suspense fallback={null}><GateForm region="below" /></React.Suspense></section>
</>);
