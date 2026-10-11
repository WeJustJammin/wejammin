import {
  EntryWorkflowResourceSchema,
  type EntryWorkflowResource,
} from '@wejammin/contracts';
import { describe, it } from 'vitest';

import {
  at,
  breachRows,
  expectRefused,
  expectServed,
  uuid,
  type Breach,
  type BreachSchema,
} from './workflow-read-breach.test-support';
import {
  dependencyManifest,
  entryId,
  hash,
  hash2,
  instant,
  publicationVersionId,
  reviewDetailResource,
  revisionId,
  scheduleId,
  schemaId,
  templateId,
  versionSet,
  workflowResource,
} from './workflow-fixtures.test-support';

/*
 * CMS-03B-15 response bounds (BE03b "response bounds"; AC-050, AC-053): the
 * preparation exists only for a submittable current draft, the preflight report
 * has exactly 17 results, at most 16 schedules and 64 publications, and the
 * dependencyManifest and versionSet satisfy the Slice 10 locked contracts. Any
 * other answer is refused and never served; the inclusive bound is served.
 */

const schema = EntryWorkflowResourceSchema as BreachSchema;
const path = `/api/v1/cms/entries/${entryId}/workflow`;
const base: EntryWorkflowResource = workflowResource;
const preparation = base.preparation!;
const results = preparation.preflight.results;

const withPreparation = (patch: Record<string, unknown>) => ({
  ...base,
  preparation: { ...preparation, ...patch },
});
const withResults = (list: readonly unknown[]) =>
  withPreparation({ preflight: { ...preparation.preflight, results: list } });
const withManifest = (patch: Record<string, unknown>) =>
  withPreparation({ dependencyManifest: { ...dependencyManifest, ...patch } });
const withVersionSet = (patch: Record<string, unknown>) =>
  withPreparation({ versionSet: { ...versionSet, ...patch } });

const schedule = (index: number) => ({
  id: uuid(index),
  version: '1',
  state: 'pending',
  action: 'publish',
  audience: 'members',
  resolvedUtc: '2026-11-01T14:30:00Z',
  reasonCode: null,
});
const publication = (index: number) => ({
  publicationId: scheduleId,
  publicationVersionId,
  version: String(index + 1),
  state: 'superseded',
  action: 'publish',
  revisionId,
  locale: 'en-US',
  audience: 'members',
  publicationHash: hash2,
  projectionState: 'pending',
  createdAt: instant,
});
const many = <T>(count: number, make: (index: number) => T): T[] =>
  Array.from({ length: count }, (_, index) => make(index));

const reviewOf = (patch: Record<string, unknown>) => ({
  id: reviewDetailResource.id,
  version: reviewDetailResource.version,
  createdAt: reviewDetailResource.createdAt,
  updatedAt: reviewDetailResource.updatedAt,
  state: reviewDetailResource.state,
  entryId: reviewDetailResource.entryId,
  revisionId: reviewDetailResource.revisionId,
  riskClass: reviewDetailResource.riskClass,
  workflowPolicy: reviewDetailResource.workflowPolicy,
  activationEvidence: reviewDetailResource.activationEvidence,
  frozenHash: reviewDetailResource.frozenHash,
  requiredDecisionCount: reviewDetailResource.requiredDecisionCount,
  recordedDecisionCount: reviewDetailResource.recordedDecisionCount,
  dependencyHash: reviewDetailResource.dependencyHash,
  invalidatedReason: reviewDetailResource.invalidatedReason,
  submittedAt: reviewDetailResource.submittedAt,
  decidedAt: reviewDetailResource.decidedAt,
  frozen: reviewDetailResource.frozen,
  ...patch,
});

const breaches: readonly Breach[] = [
  [
    'a preparation for a revision that is not a draft',
    { ...base, revision: { ...base.revision, state: 'submitted' } },
    at('preparation'),
  ],
  [
    'a preparation for a draft that is not the current draft',
    { ...base, revision: { ...base.revision, isCurrentDraft: false } },
    at('preparation'),
  ],
  [
    'a preparation whose frozen hash is not the revision content hash',
    withPreparation({ frozenHash: hash2 }),
    at('preparation.frozenHash'),
  ],
  [
    'a preparation whose risk class is not the workflow policy class',
    withPreparation({ riskClass: 'protected' }),
    at('preparation.riskClass'),
  ],
  [
    '18 preflight results',
    withResults([...results, results[0]]),
    at('preparation.preflight.results'),
  ],
  [
    '16 preflight results',
    withResults(results.slice(0, 16)),
    at('preparation.preflight.results'),
  ],
  [
    '17 preflight results in another order than the registry',
    withResults([results[1], results[0], ...results.slice(2)]),
    at('preparation.preflight.results'),
  ],
  ['17 schedules', { ...base, schedules: many(17, schedule) }, at('schedules')],
  [
    '65 publications',
    { ...base, publications: many(65, publication) },
    at('publications'),
  ],
  [
    '7 permitted next actions',
    { ...base, permittedNextActions: many(7, () => 'schedule') },
    at('permittedNextActions'),
  ],
  [
    'a dependencyManifest whose blocks are out of canonical order',
    withPreparation({
      dependencyManifest: {
        ...dependencyManifest,
        blocks: [
          { id: templateId, hash },
          { id: schemaId, hash },
        ],
      },
      versionSet: { ...versionSet, blockVersionIds: [schemaId, templateId] },
    }),
    at('preparation.dependencyManifest'),
  ],
  [
    'a dependencyManifest whose schema artifact binds another schema version',
    withManifest({
      schema: {
        ...dependencyManifest.schema,
        schemaArtifact: {
          ...dependencyManifest.schema.schemaArtifact,
          contentTypeVersionId: templateId,
        },
      },
    }),
    at('preparation.dependencyManifest', 'preparation.versionSet'),
  ],
  [
    'a dependencyManifest with a member the contract does not name',
    withManifest({ extra: 'x' }),
    at('preparation.dependencyManifest'),
  ],
  [
    'a dependencyManifest with 129 blocks',
    withManifest({ blocks: many(129, (index) => ({ id: uuid(index), hash })) }),
    at('preparation.dependencyManifest', 'preparation.versionSet'),
  ],
  [
    'a versionSet that is not the projection of the dependencyManifest',
    withVersionSet({ settingsVersion: '9' }),
    at('preparation.versionSet'),
  ],
  [
    'a versionSet with a member the contract does not name',
    withVersionSet({ extra: 'x' }),
    at('preparation.versionSet'),
  ],
  [
    'a versionSet whose block ids are out of canonical order',
    withVersionSet({ blockVersionIds: [templateId, schemaId] }),
    at('preparation.versionSet'),
  ],
  [
    'a latest review of another revision',
    { ...base, review: reviewOf({ revisionId: schemaId }) },
    at('review'),
  ],
];

describe('CMS-03B-15 response bounds are refused, never served [P2-S11-AC-050] [P2-S11-AC-053]', () => {
  it.each(breachRows(breaches))('refuses %s', async (_name, breach) => {
    await expectRefused('getEntryWorkflow', schema, path, breach);
  });

  it('serves 16 schedules and 64 publications, one fewer than a refused list', async () => {
    await expectServed('getEntryWorkflow', schema, path, {
      ...base,
      schedules: many(16, schedule),
      publications: many(64, publication),
    });
  });

  it('serves a revision that is not a draft with no preparation and its own latest review', async () => {
    await expectServed('getEntryWorkflow', schema, path, {
      ...base,
      revision: { ...base.revision, state: 'submitted' },
      preparation: null,
      review: reviewOf({}),
      permittedNextActions: [],
    });
  });
});
