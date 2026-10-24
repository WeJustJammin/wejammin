import * as React from 'react';
import CmsWorkflowCommandFrame from '/home/rob/.codex/worktrees/phase2-slice12/WeJammin/apps/web/src/components/cms-editorial-workflow/CmsWorkflowCommandFrame';
import { WorkflowTextArea } from '/home/rob/.codex/worktrees/phase2-slice12/WeJammin/apps/web/src/components/cms-editorial-workflow/CmsWorkflowFields';

declare global { interface Window { __submitted?: Array<string>; __hydrated?: boolean } }

const idle = {
  phase: 'idle', idempotencyKey: 'key-0000000001', committed: null, refusal: null, stepUpIssue: null,
  signInHref: null, requestId: null, reconciled: false, restoredValues: null, conflict: null,
} as const;
const controller = { retry: async () => undefined, reconcile: async () => undefined, dismiss: () => undefined, acknowledgeConflict: () => undefined };

export default function GateForm({ region }: { region: string }): React.ReactElement {
  const [reason, setReason] = React.useState('');
  React.useEffect(() => { window.__hydrated = true; }, []);
  return (
    <CmsWorkflowCommandFrame headingId={region + '-title'} title="Demo form" state={idle as never}
      controller={controller as never} pendingLabel="…" committedLabel={() => 'ok'} fieldIds={{}} lazyRegion={region}>
      <form onSubmit={(event) => { event.preventDefault(); (window.__submitted ??= []).push(reason); }}>
        <WorkflowTextArea id={region + '-reason'} label="Reason" value={reason} onChange={setReason} />
        <button type="submit">Send</button>
      </form>
    </CmsWorkflowCommandFrame>
  );
}
