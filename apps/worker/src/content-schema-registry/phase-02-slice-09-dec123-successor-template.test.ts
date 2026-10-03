/**
 * DEC-123 completion (CMS-03A-09): the successor request names the default
 * template and the template bindings with the OD-4 pair semantics. The Worker
 * admits both-null (clone) and both-present (replace) unchanged, refuses a
 * broken pair, a duplicate, an oversize list and a malformed member before the
 * port with BE00 pointers, and relays the database's typed template failures
 * (NOT_FOUND 404, INCOMPATIBLE 422 with the offending pointer, WITHDRAWN 409).
 */
import { describe, expect, it } from 'vitest';

import {
  makeDec108Harness,
  requestFor,
  sessionResult,
  specFor,
} from './phase-02-slice-09-dec108-test-support';
import { mapRpcFailure } from './production-errors';

const FIRST = '018f0c45-73fe-4dc2-9c09-68f7ecf132da';
const SECOND = '028f0c45-73fe-4dc2-9c09-68f7ecf132db';
const PAIR =
  'defaultTemplateVersionId and templateBindings must be both null or both present';
const base = {
  expectedVersion: '1',
  supportedLocales: null,
  fallbackChains: null,
};

type Violation = Readonly<{ path?: string; message?: string }>;

const spec = specFor('CMS-03A-09');
const send = async (body: unknown) => {
  const harness = makeDec108Harness({ session: sessionResult(spec) });
  const response = await harness.app.request(requestFor(spec, { body }));
  return { response, port: harness.ports.createSchemaSuccessor };
};
const violationsOf = async (response: Response): Promise<Violation[]> => {
  const body = (await response.json()) as {
    code: string;
    details: { violations?: Violation[] };
  };
  expect(body.code).toBe('VALIDATION_FAILED');
  return body.details.violations ?? [];
};
const refused = async (
  template: Record<string, unknown>,
): Promise<Violation[]> => {
  const { response, port } = await send({ ...base, ...template });
  expect(response.status).toBe(422);
  expect(port).not.toHaveBeenCalled();
  return violationsOf(response);
};

describe('CMS-03A-09 successor template binding admission (DEC-123)', () => {
  it('[P2-S09-AC-003] passes both-null (clone) to the port unchanged', async () => {
    const body = {
      ...base,
      defaultTemplateVersionId: null,
      templateBindings: null,
    };
    const { response, port } = await send(body);
    expect(response.status).toBe(201);
    expect((port?.mock.calls[0]?.[0] as { body: unknown }).body).toEqual(body);
  });

  it('[P2-S09-AC-045] passes both-present (replace) to the port unchanged, empty binding list included', async () => {
    const replace = {
      ...base,
      defaultTemplateVersionId: FIRST,
      templateBindings: [
        { templateVersionId: FIRST },
        { templateVersionId: SECOND },
      ],
    };
    const first = await send(replace);
    expect(first.response.status).toBe(201);
    expect((first.port?.mock.calls[0]?.[0] as { body: unknown }).body).toEqual(
      replace,
    );
    const empty = { ...replace, templateBindings: [] };
    const second = await send(empty);
    expect(second.response.status).toBe(201);
    expect((second.port?.mock.calls[0]?.[0] as { body: unknown }).body).toEqual(
      empty,
    );
  });

  it('[P2-S09-AC-045] refuses a default template without bindings at /templateBindings with the pair message', async () => {
    expect(
      await refused({
        defaultTemplateVersionId: FIRST,
        templateBindings: null,
      }),
    ).toEqual([{ path: '/templateBindings', message: PAIR }]);
  });

  it('[P2-S09-AC-049] refuses bindings without a default template at /templateBindings with the pair message', async () => {
    expect(
      await refused({
        defaultTemplateVersionId: null,
        templateBindings: [{ templateVersionId: FIRST }],
      }),
    ).toEqual([{ path: '/templateBindings', message: PAIR }]);
  });

  it('[P2-S09-AC-049] refuses a duplicate binding at the second occurrence and more than 32 bindings', async () => {
    expect(
      await refused({
        defaultTemplateVersionId: FIRST,
        templateBindings: [
          { templateVersionId: FIRST },
          { templateVersionId: FIRST },
        ],
      }),
    ).toEqual([
      {
        path: '/templateBindings/1/templateVersionId',
        message: 'templateBindings must be unique',
      },
    ]);
    const many = Array.from({ length: 33 }, (_, index) => ({
      templateVersionId: `${String(index).padStart(8, '0')}-73fe-4dc2-9c09-68f7ecf132da`,
    }));
    const violations = await refused({
      defaultTemplateVersionId: FIRST,
      templateBindings: many,
    });
    expect(violations.map((violation) => violation.path)).toContain(
      '/templateBindings',
    );
  });

  it('[P2-S09-AC-045] refuses a malformed default id, a binding with an unknown member and an omitted member', async () => {
    const malformed = await refused({
      defaultTemplateVersionId: 'nope',
      templateBindings: [],
    });
    expect(malformed.map((violation) => violation.path)).toEqual([
      '/defaultTemplateVersionId',
    ]);
    const extra = await refused({
      defaultTemplateVersionId: FIRST,
      templateBindings: [{ templateVersionId: FIRST, position: 1 }],
    });
    expect(extra.length).toBeGreaterThan(0);
    const { response, port } = await send({ ...base, templateBindings: null });
    expect(response.status).toBe(422);
    expect(port).not.toHaveBeenCalled();
  });
});

describe('CMS-03A-09 typed template failures from the database (DEC-123)', () => {
  const postgrest = (message: string, details: unknown = null) => ({
    code: 'P0001',
    message,
    details,
    hint: null,
  });

  it('[P2-S09-AC-049] relays INCOMPATIBLE as 422 with the offending pointer', () => {
    const detail = JSON.stringify({
      violations: [
        {
          path: '/templateBindings/1/templateVersionId',
          message: 'template version is not compatible with this content type',
        },
      ],
    });
    expect(
      mapRpcFailure(400, postgrest('VALIDATION_FAILED', detail)),
    ).toMatchObject({
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      details: {
        violations: [
          {
            path: '/templateBindings/1/templateVersionId',
            message:
              'template version is not compatible with this content type',
          },
        ],
      },
    });
  });

  it('[P2-S09-AC-049] relays an absent or concealed template as 404 and a withdrawn template as 409', () => {
    expect(mapRpcFailure(404, postgrest('NOT_FOUND'))).toMatchObject({
      ok: false,
      status: 404,
      code: 'NOT_FOUND',
    });
    expect(mapRpcFailure(409, postgrest('CONFLICT'))).toMatchObject({
      ok: false,
      status: 409,
      code: 'CONFLICT',
    });
  });
});
