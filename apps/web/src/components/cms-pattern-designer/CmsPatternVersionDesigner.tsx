import * as React from 'react';

import CmsPatternCommitButton from './CmsPatternCommitButton';
import CmsPatternConflictPanel from './CmsPatternConflictPanel';
import CmsPatternFields from './CmsPatternFields';
import CmsPatternNestedPicker from './CmsPatternNestedPicker';
import CmsPatternStatus from './CmsPatternStatus';
import CmsPatternTree from './CmsPatternTree';
import CmsPatternVersionFacts from './CmsPatternVersionFacts';
import { groupItems } from './pattern-designer-issues';
import {
  PATTERN_FORM_ID,
  PATTERN_TREE_ID,
  targetDomId,
} from './pattern-designer-ids';
import type { PatternDesignerContext } from './pattern-designer-request';
import type { PatternLatestDetail } from './pattern-latest-read';
import { PATTERN_LIMITS } from './pattern-tree-rules';
import { countEditableNodes } from './pattern-tree-state';
import {
  usePatternDesigner,
  type PatternDesignerOptions,
} from './use-pattern-designer';
import type { ReadNestable } from './use-nestable-patterns';

export interface CmsPatternVersionDesignerProps {
  readonly context: PatternDesignerContext;
  /** The owner's latest version for an edit; null for a new pattern. */
  readonly latest: PatternLatestDetail | null;
  readonly csrfToken: string;
  /** Seam for a test. */
  readonly submit?: PatternDesignerOptions['submit'] | undefined;
  readonly readLatest?: PatternDesignerOptions['readLatest'] | undefined;
  readonly readNestable?: ReadNestable | undefined;
}

/**
 * The pattern designer (FE03 :883): a native form over an ordered tree of registered
 * blocks. Every edit has an explicit add, remove, move earlier and move later control;
 * nothing is drag-only. The server owns the digest, cycle and expansion rules and the
 * form shows what it refuses. A saved version is always a private draft.
 */
export default function CmsPatternVersionDesigner(
  props: CmsPatternVersionDesignerProps,
): React.ReactElement {
  const { context, latest, csrfToken } = props;
  const designer = usePatternDesigner(props);
  const { editor, status } = designer;
  const editing = latest !== null;
  const submitted =
    status.kind === 'invalid' || status.kind === 'result' ? status.items : [];
  // Errors of visited controls (blur) join the submit summary; a problem shown twice is shown once.
  const grouped = groupItems([
    ...submitted,
    ...designer.blurItems.filter(
      (blurred) =>
        !submitted.some(
          (entry) =>
            entry.message === blurred.message &&
            targetDomId(entry.target) === targetDomId(blurred.target),
        ),
    ),
  ]);
  const returnTo = editing
    ? `/app/cms-content-modeling/patterns/${latest.patternKey}`
    : '/app/cms-content-modeling/patterns/new';
  return (
    <section
      className="cms-pattern-designer"
      aria-labelledby="cms-pattern-designer-title"
    >
      <h2 id="cms-pattern-designer-title">
        {editing ? `Edit ${latest.patternKey}` : 'Define a pattern'}
      </h2>
      <p>
        {editing
          ? `Editing from version ${designer.baseVersion}. Saving creates the next version as a private draft; it does not change the version you read.`
          : 'A pattern is a reusable tree of registered blocks. Saving creates a private draft that must be reviewed before it can be used.'}
      </p>
      {designer.baseFacts === null ? null : (
        <CmsPatternVersionFacts {...designer.baseFacts} />
      )}
      {context.contentTypes.length === 0 ? (
        <p role="status">
          No active content types are available to this designer.
        </p>
      ) : null}
      {csrfToken.length === 0 ? (
        <p role="status">Reload to restore the protected form session.</p>
      ) : null}
      <CmsPatternStatus
        status={status}
        tree={editor.tree}
        summaryRef={designer.summaryRef}
        returnTo={returnTo}
      />
      {designer.showConflict ? (
        <CmsPatternConflictPanel
          state={designer.conflict.state}
          baseVersion={designer.baseVersion}
          newer={designer.conflict.newer}
          waiting={designer.conflict.waiting}
          draftTree={editor.tree}
          draftTypeIds={designer.compatibleTypeIds}
          context={context}
          onCheck={() => void designer.conflict.check()}
          onRebase={designer.conflict.rebase}
          onDiscard={designer.conflict.discard}
        />
      ) : null}
      <form
        id={PATTERN_FORM_ID}
        noValidate
        onBlur={designer.onBlur}
        onSubmit={(event) => {
          event.preventDefault();
          void designer.onSubmit();
        }}
      >
        <fieldset disabled={designer.done}>
          <legend>Pattern definition</legend>
          <CmsPatternFields
            patternKey={designer.patternKey}
            onKeyChange={designer.setPatternKey}
            keyReadOnly={editing || designer.baseVersion !== null}
            context={context}
            compatibleTypeIds={designer.compatibleTypeIds}
            unavailableTypeIds={designer.unavailableTypeIds}
            onToggleType={designer.toggleType}
            keyIssues={grouped.byField.patternKey}
            typeIssues={grouped.byField.compatibleTypeIds}
          />
          <section
            id={PATTERN_TREE_ID}
            tabIndex={-1}
            aria-labelledby="cms-pattern-tree-title"
          >
            <h3 id="cms-pattern-tree-title">Block tree</h3>
            <p>
              {countEditableNodes(editor.tree)} of {PATTERN_LIMITS.nodes} nodes.
              Up to {PATTERN_LIMITS.roots} top-level nodes,{' '}
              {PATTERN_LIMITS.children} children per node and{' '}
              {PATTERN_LIMITS.depth} levels.
            </p>
            {grouped.byField.tree.length > 0 ? (
              <ul className="cms-field-errors">
                {grouped.byField.tree.map((item) => (
                  <li key={item.message}>{item.message}</li>
                ))}
              </ul>
            ) : null}
            {editor.tree.length === 0 ? (
              <p>This pattern has no nodes yet. Add a top-level block.</p>
            ) : (
              <CmsPatternTree
                nodes={editor.tree}
                registeredBlocks={context.registeredBlocks}
                issuesByNode={grouped.byNode}
                ops={editor.ops}
              />
            )}
            <button
              type="button"
              disabled={!editor.canAddRoot}
              onClick={editor.addRoot}
            >
              Add a top-level block
            </button>
            <CmsPatternNestedPicker
              typeIds={designer.compatibleTypeIds}
              canAdd={editor.canAddRoot}
              onAdd={editor.addNestedPattern}
              read={props.readNestable}
            />
            <div className="visually-hidden" role="status" aria-live="polite">
              {editor.announcement}
            </div>
          </section>
          {grouped.byField.form.length > 0 ? (
            <ul className="cms-field-errors">
              {grouped.byField.form.map((item) => (
                <li key={item.message}>{item.message}</li>
              ))}
            </ul>
          ) : null}
          <p>
            A saved version is a private draft, not publication or activation.
          </p>
          <CmsPatternCommitButton
            editing={editing}
            blocked={designer.blocked}
            pending={designer.pending}
          />
        </fieldset>
      </form>
    </section>
  );
}
