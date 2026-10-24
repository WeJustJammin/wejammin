import { describe, expect, it } from 'vitest';

import {
  CMS_LINKED_SCAN_BATCH_MAX,
  CMS_LINKED_SCAN_JOB_TYPE,
  LinkedScanEventResolutionSchema,
  LinkedScanMessageSchema,
  LinkedScanRunRequestSchema,
  LinkedScanRunResultSchema,
} from './contract';
import {
  CURSOR,
  IDS,
  NEXT_CURSOR,
  PATTERN,
  scanJobBody,
  scanRunResult,
  VERSION,
} from './linked-scan.test-support';
import { isLinkedScanJobMessage } from './message';

describe('[P2-S12-AC-212] the typed cms.pattern.linked_update_scan message', () => {
  it('names the job and the 500-instance bound of BE03c Linked update', () => {
    expect(CMS_LINKED_SCAN_JOB_TYPE).toBe('cms.pattern.linked_update_scan');
    expect(CMS_LINKED_SCAN_BATCH_MAX).toBe(500);
  });

  it('accepts the strict message with a null or an opaque continuation cursor', () => {
    expect(LinkedScanMessageSchema.safeParse(scanJobBody()).success).toBe(true);
    expect(
      LinkedScanMessageSchema.safeParse(scanJobBody({ cursor: CURSOR }))
        .success,
    ).toBe(true);
  });

  it.each([
    [
      'another job type',
      { ...scanJobBody(), jobType: 'cms.governed_review.recheck' },
    ],
    [
      'a caller-named instance',
      {
        ...scanJobBody(),
        payload: { ...scanJobBody().payload, instanceId: IDS.person },
      },
    ],
    [
      'an entry member',
      {
        ...scanJobBody(),
        payload: { ...scanJobBody().payload, entryId: IDS.person },
      },
    ],
    [
      'a payload member that is not a uuid',
      {
        ...scanJobBody(),
        payload: { ...scanJobBody().payload, patternId: 'p' },
      },
    ],
    [
      'a missing patternVersionId',
      { ...scanJobBody(), payload: { patternId: PATTERN } },
    ],
    ['schema version 2', { ...scanJobBody(), schemaVersion: 2 }],
    ['no cursor member', { ...scanJobBody(), cursor: undefined }],
    [
      'a cursor that is not entry id and hex path',
      { ...scanJobBody(), cursor: 'next' },
    ],
    [
      'a cursor with an odd hex path',
      { ...scanJobBody(), cursor: `${IDS.aggregate}.2f6` },
    ],
    [
      'a cursor with an upper-case hex path',
      { ...scanJobBody(), cursor: `${IDS.aggregate}.2F68` },
    ],
    [
      'a cursor with no path',
      { ...scanJobBody(), cursor: `${IDS.aggregate}.` },
    ],
    ['a stray top-level member', { ...scanJobBody(), content: 'x' }],
  ])('rejects %s', (_name, body) => {
    expect(LinkedScanMessageSchema.safeParse(body).success).toBe(false);
  });

  it('bounds the hex path of a cursor at the 512 octets of a composition path', () => {
    const path = (octets: number): string =>
      `${IDS.aggregate}.${'2f'.repeat(octets)}`;
    expect(
      LinkedScanMessageSchema.safeParse(scanJobBody({ cursor: path(512) }))
        .success,
    ).toBe(true);
    expect(
      LinkedScanMessageSchema.safeParse(scanJobBody({ cursor: path(513) }))
        .success,
    ).toBe(false);
  });

  it('recognises exactly its own job message for the queue entrypoint', () => {
    expect(isLinkedScanJobMessage(scanJobBody())).toBe(true);
    expect(
      isLinkedScanJobMessage({ jobType: 'cms.governed_review.recheck' }),
    ).toBe(false);
    expect(
      isLinkedScanJobMessage({ eventType: 'cms.pattern.activated.v1' }),
    ).toBe(false);
    expect(isLinkedScanJobMessage(null)).toBe(false);
    expect(isLinkedScanJobMessage('cms.pattern.linked_update_scan')).toBe(
      false,
    );
    expect(isLinkedScanJobMessage([scanJobBody()])).toBe(false);
  });
});

describe('[P2-S12-AC-213] the run request and result', () => {
  it('is the strict job payload plus its cursor and the correlation of the message', () => {
    const request = {
      patternId: PATTERN,
      patternVersionId: VERSION,
      cursor: null,
      correlationId: IDS.correlation,
    };
    expect(LinkedScanRunRequestSchema.safeParse(request).success).toBe(true);
    expect(
      LinkedScanRunRequestSchema.safeParse({ ...request, cursor: CURSOR })
        .success,
    ).toBe(true);
    expect(
      LinkedScanRunRequestSchema.safeParse({ ...request, batch: 5 }).success,
    ).toBe(false);
    expect(
      LinkedScanRunRequestSchema.safeParse({ ...request, entryId: IDS.person })
        .success,
    ).toBe(false);
  });

  it('accepts a consistent result and a continuation only after a full run of 500', () => {
    expect(LinkedScanRunResultSchema.safeParse(scanRunResult()).success).toBe(
      true,
    );
    expect(
      LinkedScanRunResultSchema.safeParse(
        scanRunResult({
          examined: 500,
          appended: 500,
          nextCursor: NEXT_CURSOR,
        }),
      ).success,
    ).toBe(true);
    expect(
      LinkedScanRunResultSchema.safeParse(
        scanRunResult({ examined: 500, appended: 0, nextCursor: null }),
      ).success,
    ).toBe(true);
  });

  it.each([
    [
      'more appended than examined',
      scanRunResult({ examined: 3, appended: 4 }),
    ],
    [
      'a cursor after a run shorter than the bound',
      scanRunResult({ examined: 499, appended: 1, nextCursor: NEXT_CURSOR }),
    ],
    ['more than 500 examined', scanRunResult({ examined: 501, appended: 1 })],
    ['a negative count', scanRunResult({ examined: -1, appended: 0 })],
    ['a fractional count', scanRunResult({ examined: 1.5, appended: 1 })],
    [
      'a cursor that is not entry id and hex path',
      scanRunResult({ examined: 500, appended: 1, nextCursor: 'more' }),
    ],
    ['a stray member', { ...scanRunResult(), instanceIds: [PATTERN] }],
    ['a missing member', { examined: 1, appended: 1 }],
    ['not an object', 'ok'],
  ])('rejects %s', (_name, result) => {
    expect(LinkedScanRunResultSchema.safeParse(result).success).toBe(false);
  });

  it('accepts the event resolution of a pattern activation and nothing else', () => {
    expect(
      LinkedScanEventResolutionSchema.safeParse({ found: false }).success,
    ).toBe(true);
    expect(
      LinkedScanEventResolutionSchema.safeParse({
        found: true,
        patternId: PATTERN,
        patternVersionId: VERSION,
      }).success,
    ).toBe(true);
    for (const reply of [
      { found: true, patternId: PATTERN },
      { found: false, patternId: PATTERN, patternVersionId: VERSION },
      { found: true, kind: 'pattern', refId: PATTERN },
      { found: 'yes' },
    ])
      expect(LinkedScanEventResolutionSchema.safeParse(reply).success).toBe(
        false,
      );
  });
});
