import * as React from 'react';

import { cmsEditorialAppRevisionsPath } from './cms-editorial-app-routes';
import type { CmsEditorialResultSummary } from './cms-editorial-result-handoff';

const HEADING: Readonly<Record<CmsEditorialResultSummary['kind'], string>> = {
  created: 'Entry created',
  resolved: 'Conflict resolved',
  restored: 'Revision restored',
};

const sentence = (summary: CmsEditorialResultSummary): string => {
  const saved = `revision ${summary.revisionNumber} (entry version ${summary.entryVersion})`;
  if (summary.kind === 'created') return `The first draft is ${saved}.`;
  if (summary.kind === 'resolved')
    return `Your choices were saved as ${saved}. Both competing revisions stay in the history.`;
  return `A new draft was created as ${saved}. The source revision is unchanged.`;
};

const NEXT: Readonly<Record<CmsEditorialResultSummary['kind'], string>> = {
  created: 'Fill in the fields below; changes save automatically.',
  resolved:
    'Review the resolved draft below and keep editing; changes save automatically.',
  restored:
    'Review the restored draft below and keep editing; changes save automatically.',
};

const PARENT_LABELS: Readonly<
  Record<'resolved' | 'restored', readonly string[]>
> = {
  resolved: ['Parent revision 1', 'Parent revision 2'],
  // CMS-03B-04: parentRevisionIds = [currentDraftRevisionId, sourceRevisionId].
  restored: ['Previous draft', 'Restored source'],
};

/**
 * The canonical result of the command that opened this page (FE03 Completion:
 * "expose exact next action"): what was committed, the lineage of the new
 * revision (its parent revisions and, for a restore, the migration chain it
 * crossed) and the next step. Identifiers only: never a value, an owner or a
 * capability.  It is a polite status and its heading takes focus (FE03 Completion: "Focus
 * result heading").
 */
export default function CmsEditorialResultPanel({
  summary,
}: {
  readonly summary: CmsEditorialResultSummary;
}): React.ReactElement {
  const heading = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    // FE03 Completion (:1219): focus the result heading. The route heading takes
    // focus on a command's initial load too (lib/route-heading-focus.ts), at
    // DOMContentLoaded, so the result heading takes it after that and after the
    // next frame: the more specific result wins.
    let frame = 0;
    const focus = (): void => {
      frame = requestAnimationFrame(() => heading.current?.focus());
    };
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', focus, { once: true });
    else focus();
    return () => {
      document.removeEventListener('DOMContentLoaded', focus);
      cancelAnimationFrame(frame);
    };
  }, []);
  const history = cmsEditorialAppRevisionsPath(summary.entryId);
  const labels = summary.kind === 'created' ? [] : PARENT_LABELS[summary.kind];
  return (
    <section
      data-cms-editorial-result=""
      role="status"
      aria-labelledby="cms-editorial-result-heading"
    >
      <h2 id="cms-editorial-result-heading" tabIndex={-1} ref={heading}>
        {HEADING[summary.kind]}
      </h2>
      <p>{sentence(summary)}</p>
      {summary.parentRevisionIds.length === 0 &&
      summary.migrationChainId === null ? null : (
        <ul>
          {summary.parentRevisionIds.length === 0 ? null : (
            <li data-fact="parent-revisions">
              Parent revisions:
              <ol>
                {summary.parentRevisionIds.map((id, index) => (
                  <li key={id}>
                    {labels[index] ?? 'Parent revision'}: <code>{id}</code>
                  </li>
                ))}
              </ol>
            </li>
          )}
          {summary.migrationChainId === null ? null : (
            <li data-fact="migration-chain">
              Migration chain: <code>{summary.migrationChainId}</code>
              {summary.edgeCount === null
                ? null
                : `, ${summary.edgeCount} ${summary.edgeCount === 1 ? 'edge' : 'edges'}`}
            </li>
          )}
        </ul>
      )}
      <p>
        {NEXT[summary.kind]}
        {history === null ? null : (
          <>
            {' '}
            <a href={history}>Compare in the revision history</a>
          </>
        )}
      </p>
    </section>
  );
}
