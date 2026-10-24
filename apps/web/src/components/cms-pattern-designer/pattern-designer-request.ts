import type { PatternVersionRequest } from '@wejammin/contracts';
import { isCmsVersion } from '@wejammin/contracts/client';

import {
  PATTERN_ISSUE_COPY,
  type DesignerIssueCode,
} from './pattern-designer-copy';
import {
  patternKeyIssue,
  validatePatternTree,
  type PatternTreeMember,
} from './pattern-tree-rules';
import {
  nodeAt,
  toWireTree,
  type EditableNode,
  type EditableTree,
} from './pattern-tree-state';

/** The members of the protected selector context the designer reads (a subset of `TemplateDesignerContext`). */
export interface PatternDesignerContext {
  readonly contentTypes: ReadonlyArray<{
    readonly id: string;
    readonly typeKey: string;
  }>;
  readonly registeredBlocks: ReadonlyArray<{
    readonly blockKey: string;
    readonly blockVersion: number;
  }>;
}

export interface PatternDesignerFields {
  readonly patternKey: string;
  readonly compatibleTypeIds: readonly string[];
  readonly tree: EditableTree;
  /** `null` for a first version; the read version for a successor. */
  readonly expectedVersion: string | null;
}

export type IssueField = 'patternKey' | 'compatibleTypeIds' | 'tree' | 'form';
export type NodeMember = 'key' | 'blockRef' | 'props' | 'children' | null;
export type IssueTarget =
  | { readonly kind: 'field'; readonly field: IssueField }
  | {
      readonly kind: 'node';
      readonly uiId: string;
      readonly member: NodeMember;
    };

export interface DesignerIssue {
  readonly code: DesignerIssueCode;
  readonly message: string;
  readonly target: IssueTarget;
}

export type PatternBuildResult =
  | {
      readonly ok: true;
      readonly value: PatternVersionRequest;
      /** The serialized request: the identity of a logical attempt. */
      readonly body: string;
    }
  | { readonly ok: false; readonly issues: DesignerIssue[] };

const MAX_BODY_BYTES = 262_144;
const MAX_COMPATIBLE_TYPES = 64;

const issue = (
  code: DesignerIssueCode,
  target: IssueTarget,
): DesignerIssue => ({
  code,
  message: PATTERN_ISSUE_COPY[code],
  target,
});
const field = (name: IssueField): IssueTarget => ({
  kind: 'field',
  field: name,
});

const memberOf = (member: PatternTreeMember): NodeMember =>
  member === 'blockKey' || member === 'blockVersion'
    ? 'blockRef'
    : member === 'patternId' || member === 'patternVersion'
      ? null
      : member;

/**
 * The content types a version names that the selector context no longer offers
 * (FE03 :1216: a stale choice must stay visible so it can be removed). First-seen
 * order, no duplicates.
 */
export const unavailableTypeIds = (
  named: readonly string[],
  context: PatternDesignerContext,
): string[] => {
  const available = new Set(context.contentTypes.map((type) => type.id));
  return [...new Set(named)].filter((id) => !available.has(id));
};

const documentOrder = (tree: EditableTree): string[] =>
  tree.flatMap((node: EditableNode) => [
    node.uiId,
    ...documentOrder(node.children),
  ]);

const fieldIssues = (
  fields: PatternDesignerFields,
  context: PatternDesignerContext,
): DesignerIssue[] => {
  const issues: DesignerIssue[] = [];
  const keyIssue = patternKeyIssue(fields.patternKey.trim());
  if (keyIssue !== null) issues.push(issue(keyIssue, field('patternKey')));
  const available = new Set(context.contentTypes.map((type) => type.id));
  if (
    fields.compatibleTypeIds.length === 0 ||
    fields.compatibleTypeIds.length > MAX_COMPATIBLE_TYPES
  )
    issues.push(issue('compatible_required', field('compatibleTypeIds')));
  else if (fields.compatibleTypeIds.some((id) => !available.has(id)))
    issues.push(issue('compatible_unavailable', field('compatibleTypeIds')));
  if (fields.expectedVersion !== null && !isCmsVersion(fields.expectedVersion))
    issues.push(issue('version_invalid', field('form')));
  return issues;
};

/** A node issue per node whose block is not chosen or no longer registered. */
const blockIssues = (
  tree: EditableTree,
  registered: ReadonlySet<string>,
): DesignerIssue[] =>
  tree.flatMap((node) => [
    ...(node.kind === 'block' &&
    node.blockRef !== '' &&
    !registered.has(node.blockRef)
      ? [
          issue('block_unavailable', {
            kind: 'node',
            uiId: node.uiId,
            member: 'blockRef',
          }),
        ]
      : []),
    ...blockIssues(node.children, registered),
  ]);

const bySource =
  (order: readonly string[]) => (a: DesignerIssue, b: DesignerIssue) => {
    const rank = (entry: DesignerIssue): number =>
      entry.target.kind === 'node' ? order.indexOf(entry.target.uiId) : -1;
    return rank(a) - rank(b);
  };

/**
 * Client-side preparation of a `PatternVersionRequest` from the form (FE03 :883). It
 * only lets the form name what is wrong before a send: the proxy, the Worker and the
 * database recheck every rule and own capability, ownership, nested-pattern state,
 * cycles and the block registry digest (which is server-computed and never sent).
 */
export const buildPatternVersionRequest = (
  fields: PatternDesignerFields,
  context: PatternDesignerContext,
): PatternBuildResult => {
  const issues = fieldIssues(fields, context);
  const registered = new Set(
    context.registeredBlocks.map(
      (block) => `${block.blockKey}@${block.blockVersion}`,
    ),
  );
  const order = documentOrder(fields.tree);
  const wire = toWireTree(fields.tree);
  if (!wire.ok) {
    const reported = wire.issues.map((entry) =>
      issue(entry.code, {
        kind: 'node',
        uiId: entry.uiId,
        member: entry.member,
      }),
    );
    issues.push(
      ...[...reported, ...blockIssues(fields.tree, registered)].sort(
        bySource(order),
      ),
    );
    return { ok: false, issues };
  }
  const nodeIssues = blockIssues(fields.tree, registered);
  for (const entry of validatePatternTree(wire.nodes)) {
    const located = nodeAt(fields.tree, entry.nodePath);
    issues.push(
      located === null
        ? issue(entry.code, field('tree'))
        : issue(entry.code, {
            kind: 'node',
            uiId: located.uiId,
            member: memberOf(entry.member),
          }),
    );
  }
  issues.push(...nodeIssues);
  if (issues.length > 0)
    return { ok: false, issues: issues.sort(bySource(order)) };
  const value: PatternVersionRequest = {
    patternKey: fields.patternKey.trim(),
    compatibleTypeIds: [...fields.compatibleTypeIds],
    blockTree: wire.nodes,
    expectedVersion: fields.expectedVersion,
  };
  const body = JSON.stringify(value);
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES)
    return { ok: false, issues: [issue('request_too_large', field('form'))] };
  return { ok: true, value, body };
};
