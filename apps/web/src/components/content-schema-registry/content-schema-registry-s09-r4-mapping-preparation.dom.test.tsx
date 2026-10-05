// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { ContentSchemaRegistryDetailSchema } from '@wejammin/contracts';

import { pollableJobId } from './content-schema-registry-dry-run-polling';
import {
  altFor,
  getPath,
  hash,
  leafPaths,
  renderDetailMarkup,
  sentinelDetail,
  uuid,
  withPaths,
} from './content-schema-registry-s09-r4-mapping.test-support';

/**
 * FE03 "activationPreparation data mapping" (CMS-03A-07): every member of the
 * preparation reaches the rendered version page, for a sealed completed dry
 * run, a failed dry run and the template compatibility projection.
 */

const withPreparation = (preparation: unknown) =>
  ContentSchemaRegistryDetailSchema.parse({
    ...sentinelDetail(),
    activationPreparation: preparation,
  });

const COMPLETED = withPreparation({
  dryRunRef: {
    id: uuid(100),
    state: 'completed',
    result: 'passed',
    jobId: uuid(101),
    failureCode: null,
    sourceCount: 12,
    targetCount: 13,
    rowErrorCount: 0,
    sourceHash: hash(102),
    targetHash: hash(103),
    reportHash: hash(104),
  },
  jobRef: { id: uuid(105), state: 'succeeded' },
  reviewRef: { id: uuid(106), state: 'approved' },
  templateCompatibility: {
    templateVersionId: uuid(107),
    templateKey: 'sentinel.template',
    templateVersionNo: '108',
    state: 'approved',
    compatible: true,
    withdrawn: false,
    templateDigest: hash(109),
    contentTypeId: uuid(5),
    contentTypeVersionId: uuid(1),
  },
  permittedNextActions: ['submit_review'],
});

const FAILED = withPreparation({
  dryRunRef: {
    id: uuid(110),
    state: 'failed',
    result: null,
    jobId: uuid(111),
    failureCode: 'SOURCE_SCAN_FAILED',
  },
  jobRef: { id: uuid(111), state: 'failed' },
  reviewRef: null,
  permittedNextActions: ['start_dry_run'],
});

const CHANGES: Readonly<Record<string, Record<string, unknown>>> = {
  'activationPreparation.dryRunRef.state': {
    'activationPreparation.dryRunRef.state': 'running',
    'activationPreparation.dryRunRef.result': null,
    'activationPreparation.dryRunRef.sourceCount': null,
    'activationPreparation.dryRunRef.targetCount': null,
    'activationPreparation.dryRunRef.rowErrorCount': null,
    'activationPreparation.dryRunRef.sourceHash': null,
    'activationPreparation.dryRunRef.targetHash': null,
    'activationPreparation.dryRunRef.reportHash': null,
  },
  'activationPreparation.dryRunRef.result': {
    'activationPreparation.dryRunRef.result': 'failed',
    'activationPreparation.dryRunRef.rowErrorCount': 3,
  },
  'activationPreparation.dryRunRef.rowErrorCount': {
    'activationPreparation.dryRunRef.result': 'failed',
    'activationPreparation.dryRunRef.rowErrorCount': 4,
  },
  'activationPreparation.permittedNextActions': {
    'activationPreparation.permittedNextActions': ['create_successor'],
  },
  'activationPreparation.jobRef.state': {
    'activationPreparation.jobRef.state': 'running',
  },
  'activationPreparation.reviewRef.state': {
    'activationPreparation.reviewRef.state': 'open',
  },
  'activationPreparation.templateCompatibility.state': {
    'activationPreparation.templateCompatibility.state': 'active',
  },
  'activationPreparation.dryRunRef.failureCode': {
    'activationPreparation.dryRunRef.failureCode': 'TARGET_COMPILE_FAILED',
  },
};

/**
 * Constant members of the projection (a typed invariant) are asserted by text.
 * The job identifiers are consumed by the poller, not by markup, and are
 * proved by the polling-selection tests below.
 */
const CONSTANTS: Readonly<Record<string, string>> = {
  'activationPreparation.templateCompatibility.compatible':
    'Compatible with this version</dt><dd>yes',
  'activationPreparation.templateCompatibility.withdrawn': 'withdrawn',
  'activationPreparation.dryRunRef.jobId': 'polled job',
  'activationPreparation.jobRef.id': 'polled job',
};

const mapped = (
  base: ReturnType<typeof withPreparation>,
  path: string,
  index: number,
  overrides: Readonly<Record<string, Record<string, unknown>>> = CHANGES,
): boolean => {
  const changes = overrides[path] ?? {
    [path]: altFor(path, getPath(base, path), index),
  };
  return (
    renderDetailMarkup(base as never) !==
    renderDetailMarkup(
      ContentSchemaRegistryDetailSchema.parse(
        withPaths(base, changes),
      ) as never,
    )
  );
};

const preparationLeaves = (base: ReturnType<typeof withPreparation>) =>
  leafPaths(base).filter((path) => path.startsWith('activationPreparation.'));

describe('sealed completed dry run, job, review and template compatibility', () => {
  const leaves = preparationLeaves(COMPLETED).filter(
    (path) =>
      !(path in CONSTANTS) &&
      // A failure code exists only on an unsealed failed run (see below).
      path !== 'activationPreparation.dryRunRef.failureCode',
  );

  it.each(leaves)(
    '[P2-S09-AC-259] [P2-S09-AC-264] %s changes the rendered page',
    (path) => {
      expect(mapped(COMPLETED, path, leaves.indexOf(path) + 1), path).toBe(
        true,
      );
    },
  );

  it('[P2-S09-AC-259] the constant projection members are rendered by name and the fixture covers every member', () => {
    const markup = renderDetailMarkup(COMPLETED as never);
    expect(markup).toContain('Compatible with this version</dt><dd>yes');
    expect(preparationLeaves(COMPLETED).sort()).toStrictEqual(
      [
        'activationPreparation.dryRunRef.id',
        'activationPreparation.dryRunRef.state',
        'activationPreparation.dryRunRef.result',
        'activationPreparation.dryRunRef.jobId',
        'activationPreparation.dryRunRef.failureCode',
        'activationPreparation.dryRunRef.sourceCount',
        'activationPreparation.dryRunRef.targetCount',
        'activationPreparation.dryRunRef.rowErrorCount',
        'activationPreparation.dryRunRef.sourceHash',
        'activationPreparation.dryRunRef.targetHash',
        'activationPreparation.dryRunRef.reportHash',
        'activationPreparation.jobRef.id',
        'activationPreparation.jobRef.state',
        'activationPreparation.reviewRef.id',
        'activationPreparation.reviewRef.state',
        'activationPreparation.templateCompatibility.templateVersionId',
        'activationPreparation.templateCompatibility.templateKey',
        'activationPreparation.templateCompatibility.templateVersionNo',
        'activationPreparation.templateCompatibility.state',
        'activationPreparation.templateCompatibility.compatible',
        'activationPreparation.templateCompatibility.withdrawn',
        'activationPreparation.templateCompatibility.templateDigest',
        'activationPreparation.templateCompatibility.contentTypeId',
        'activationPreparation.templateCompatibility.contentTypeVersionId',
        'activationPreparation.permittedNextActions',
      ].sort(),
    );
  });
});

describe('failed dry run', () => {
  const FAILED_CHANGES: Readonly<Record<string, Record<string, unknown>>> = {
    'activationPreparation.dryRunRef.state': {
      'activationPreparation.dryRunRef.state': 'queued',
      'activationPreparation.dryRunRef.failureCode': null,
    },
    'activationPreparation.dryRunRef.failureCode': {
      'activationPreparation.dryRunRef.failureCode': 'TARGET_COMPILE_FAILED',
    },
  };

  it.each(Object.keys(FAILED_CHANGES))(
    '[P2-S09-AC-259] [P2-S09-AC-264] %s changes the rendered page',
    (path) => {
      expect(mapped(FAILED, path, 1, FAILED_CHANGES), path).toBe(true);
    },
  );

  it('[P2-S09-AC-259] the safe failure code is named in the status sentence', () => {
    expect(renderDetailMarkup(FAILED as never)).toContain(
      'failure code SOURCE_SCAN_FAILED',
    );
  });
});

describe('job identifiers are consumed by the dry-run poller', () => {
  const queued = (jobRefId: string | null, dryRunJobId: string | null) =>
    withPreparation({
      dryRunRef: {
        id: uuid(120),
        state: 'queued',
        result: null,
        jobId: dryRunJobId,
      },
      jobRef: jobRefId === null ? null : { id: jobRefId, state: 'queued' },
      reviewRef: null,
      permittedNextActions: [],
    }).activationPreparation;

  it('[P2-S09-AC-259] [P2-S09-AC-264] jobRef.id is the polled job when a non-terminal job is referenced', () => {
    expect(pollableJobId(queued(uuid(121), uuid(122)))).toBe(uuid(121));
  });

  it('[P2-S09-AC-259] [P2-S09-AC-264] dryRunRef.jobId is the polled job when no job is referenced', () => {
    expect(pollableJobId(queued(null, uuid(122)))).toBe(uuid(122));
  });

  it('[P2-S09-AC-259] [P2-S09-AC-264] a sealed or terminal dry run polls nothing', () => {
    expect(pollableJobId(COMPLETED.activationPreparation)).toBeNull();
    expect(pollableJobId(FAILED.activationPreparation)).toBeNull();
  });
});
