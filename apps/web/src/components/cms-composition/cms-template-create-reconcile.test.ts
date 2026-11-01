import type { TemplateVersionRequest } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { reconcileUnknownCreate } from './cms-template-create-reconcile';
import { detail } from './cms-template-designer.test-support';

const attempt: TemplateVersionRequest = {
  templateKey: detail.templateKey,
  compatibleTypeIds: detail.compatibleTypeIds,
  slots: detail.slots,
  reservedRegions: detail.reservedRegions,
  bindings: detail.bindings,
  locale: detail.locale,
  audience: detail.audience,
  expectedVersion: null,
};
const first = { ...detail, version: '1', templateVersion: 1 };

describe('reconcileUnknownCreate (FE03 1048 degraded, DEC-242)', () => {
  it('reads version 1 of exactly the attempted definition as a committed create', () => {
    const verdict = reconcileUnknownCreate(attempt, {
      kind: 'loaded',
      detail: first,
    });
    expect(verdict).toMatchObject({
      kind: 'created',
      resource: { templateKey: 'release-note', version: '1' },
    });
  });

  it('is not fooled by key order inside the definition', () => {
    const verdict = reconcileUnknownCreate(
      {
        ...attempt,
        bindings: {
          b: { projection: 'x', required: true },
          a: { required: false, projection: 'y' },
        } as never,
      },
      {
        kind: 'loaded',
        detail: {
          ...first,
          bindings: {
            a: { projection: 'y', required: false },
            b: { required: true, projection: 'x' },
          } as never,
        },
      },
    );
    expect(verdict.kind).toBe('created');
  });

  it.each([
    ['another audience', { ...first, audience: 'members' }],
    ['a later version', { ...detail, version: '2', templateVersion: 2 }],
  ])(
    'reads %s as an existing template, never as the attempt',
    (_name, other) => {
      expect(
        reconcileUnknownCreate(attempt, { kind: 'loaded', detail: other }),
      ).toEqual({ kind: 'existing', latest: other });
    },
  );

  it('reads a 404 as absent: nothing committed', () => {
    expect(
      reconcileUnknownCreate(attempt, { kind: 'rejected', status: 404 }),
    ).toEqual({ kind: 'absent' });
  });

  it.each([
    [{ kind: 'unavailable' } as const],
    [{ kind: 'rejected', status: 403 } as const],
    [{ kind: 'rejected', status: 429 } as const],
    [{ kind: 'rejected', status: 401 } as const],
  ])('cannot settle on %j', (read) => {
    expect(reconcileUnknownCreate(attempt, read)).toEqual({
      kind: 'undetermined',
    });
  });
});
