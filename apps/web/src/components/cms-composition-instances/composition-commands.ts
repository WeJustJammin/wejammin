import { isCmsVersion } from '@wejammin/contracts/client';

import {
  insertIssues,
  parseOverrides,
  type InsertIssue,
  type PlacementFields,
} from './composition-insert-fields';
import { sendJson, type MutationAnswer } from './composition-transport';
import type { UpdateBody } from './composition-update-request';
import type {
  CompositionEntryFacts,
  InstanceRow,
  UpdateDiff,
} from './composition-types';

export type { PlacementFields } from './composition-insert-fields';

/*
 * CMS-03C-02 (place) and CMS-03C-15 (accept or detach) from the browser (FE03 1114, 1115; DEC-175, DEC-193). The
 * same-origin proxy has already parsed the strict resource and bound it to the request, so the browser repeats the
 * binding structurally: a 2xx that is not the answer to THIS request is an unknown outcome, never a guessed success.
 */
export interface PlacementRequest {
  readonly revisionId: string;
  readonly patternId: string;
  readonly patternVersion: number;
  readonly linkMode: 'linked' | 'detached';
  readonly slotPath: string;
  readonly overrides: Readonly<Record<string, unknown>>;
  readonly roots?: readonly string[];
  readonly blockRegistryDigest?: string;
  readonly expectedVersion: string;
}

export const PLACEMENT_PATH = '/api/v1/cms/compositions/pattern-instances';
export const UPDATE_PATH = '/api/v1/cms/compositions/pattern-updates';

export type PlacementBuild =
  | { readonly ok: true; readonly request: PlacementRequest }
  | { readonly ok: false; readonly issues: readonly InsertIssue[] };

/** The insert form as the request; the entry `version` is the `If-Match` operand. */
export const placementRequest = (
  fields: PlacementFields,
  entry: CompositionEntryFacts,
): PlacementBuild => {
  const issues = insertIssues(fields);
  const overrides = parseOverrides(fields.overridesText);
  if (
    issues.length > 0 ||
    fields.item === null ||
    fields.linkMode === null ||
    !overrides.ok
  )
    return { ok: false, issues };
  return {
    ok: true,
    request: {
      revisionId: entry.revisionId,
      patternId: fields.item.patternId,
      patternVersion: fields.item.patternVersion,
      linkMode: fields.linkMode,
      slotPath: fields.slotPath,
      overrides: overrides.value,
      blockRegistryDigest: fields.item.blockRegistryDigest,
      expectedVersion: entry.version,
    },
  };
};

/**
 * DEC-193: _Place_ for the blocks a newer pattern version adds. It carries the instance's revision, pattern and link
 * mode, the diff's target version and slot, the chosen roots, empty overrides and the entry `version`.
 */
export const newRootsRequest = (
  diff: UpdateDiff,
  instance: InstanceRow,
  roots: readonly string[],
  entry: CompositionEntryFacts,
): PlacementRequest | null =>
  roots.length === 0 || instance.patternId === null
    ? null
    : {
        revisionId: instance.revisionId,
        patternId: instance.patternId,
        patternVersion: diff.targetPatternVersion,
        linkMode: instance.linkMode,
        slotPath: diff.slotPath,
        overrides: {},
        roots: [...roots],
        expectedVersion: entry.version,
      };

export interface CommandContext {
  readonly csrfToken: string;
  readonly idempotencyKey: string;
  readonly fetcher?: typeof fetch;
}

type Refusal = Exclude<MutationAnswer, { kind: 'ok' }>;
type Row = InstanceRow;
const isRow = (value: unknown): value is Row =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Row).path === 'string' &&
  typeof (value as Row).version === 'string' &&
  typeof (value as Row).revisionId === 'string';
const rowsOf = (body: unknown): Row[] | null => {
  const items = (body as { items?: unknown } | null)?.items;
  return Array.isArray(items) && items.every(isRow) ? items : null;
};

const answersPlacement = (rows: readonly Row[], request: PlacementRequest) => {
  const prefix = request.slotPath === '/' ? '' : request.slotPath;
  const named = request.roots?.map((root) => prefix + root);
  if (rows.length < 1 || rows.length > 512) return false;
  if (named !== undefined && rows.length !== named.length) return false;
  return rows.every(
    (row) =>
      row.revisionId === request.revisionId &&
      row.patternId === request.patternId &&
      row.patternVersion === request.patternVersion &&
      row.linkMode === request.linkMode &&
      row.path.startsWith(`${prefix}/`) &&
      (named === undefined || named.includes(row.path)),
  );
};

export type PlacementAnswer =
  | {
      readonly kind: 'placed';
      readonly rows: readonly Row[];
      readonly version: string;
    }
  | Refusal;

/** Place a pattern (201). The committed entry version is the strong ETag and is above the one named. */
export const submitPlacement = async (
  request: PlacementRequest,
  context: CommandContext,
): Promise<PlacementAnswer> => {
  const answer = await sendJson(PLACEMENT_PATH, request, {
    csrfToken: context.csrfToken,
    idempotencyKey: context.idempotencyKey,
    ifMatch: request.expectedVersion,
    okStatus: 201,
    ...(context.fetcher === undefined ? {} : { fetcher: context.fetcher }),
  });
  if (answer.kind !== 'ok') return answer;
  const rows = rowsOf(answer.body);
  const version = answer.etag?.match(/^"([1-9]\d{0,18})"$/u)?.[1];
  if (
    rows === null ||
    version === undefined ||
    !isCmsVersion(version) ||
    BigInt(version) <= BigInt(request.expectedVersion) ||
    !answersPlacement(rows, request)
  )
    return { kind: 'uncertain' };
  return { kind: 'placed', rows, version };
};

export interface UpdateOutcome {
  readonly instanceId: string;
  readonly text: string;
}

/** DEC-193: the accept result names each instance's outcome. */
const outcomeOf = (row: Row): string =>
  row.state === 'retired'
    ? 'Removed from the entry'
    : row.linkMode === 'detached'
      ? 'Local copy'
      : `Now on pattern version ${row.patternVersion ?? 'unknown'}`;

export type UpdateAnswer =
  | {
      readonly kind: 'updated';
      readonly rows: readonly Row[];
      readonly version: string;
      readonly outcomes: readonly UpdateOutcome[];
    }
  | Refusal;

/** Accept or detach (200): one appended row per instance, in order, under the entry version plus one. */
export const submitUpdate = async (
  body: UpdateBody,
  context: CommandContext,
): Promise<UpdateAnswer> => {
  const answer = await sendJson(UPDATE_PATH, body, {
    csrfToken: context.csrfToken,
    idempotencyKey: context.idempotencyKey,
    ifMatch: body.expectedVersion,
    okStatus: 200,
    ...(context.fetcher === undefined ? {} : { fetcher: context.fetcher }),
  });
  if (answer.kind !== 'ok') return answer;
  const rows = rowsOf(answer.body);
  const next = String(BigInt(body.expectedVersion) + 1n);
  if (
    rows === null ||
    answer.etag !== `"${next}"` ||
    rows.length !== body.instances.length ||
    rows.some(
      (row, index) =>
        row.version !==
        String(BigInt(body.instances[index]?.expectedVersion ?? '0') + 1n),
    )
  )
    return { kind: 'uncertain' };
  return {
    kind: 'updated',
    rows,
    version: next,
    outcomes: rows.map((row, index) => ({
      instanceId: body.instances[index]?.instanceId ?? '',
      text: outcomeOf(row),
    })),
  };
};
