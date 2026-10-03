import { describe, expect, it } from 'vitest';

import {
  bodyOf,
  jsonRequest,
  makeHarness,
  mutationPath,
  sendHuman,
} from './phase-02-slice-09-pre-support';
import {
  TYPE_ID,
  VERSION_ID,
  error,
  validField,
  validRelation,
} from './phase-02-slice-09-test-values';

const CHILD_ID = '50000000-0000-4000-8000-000000000005';
const NOT_DRAFT = 'The version is not an unactivated draft.';

describe('[P2-S09-AC-004] field and relation edits exist only on an unactivated draft version', () => {
  it.each([
    ['/api/v1/cms/fields'],
    ['/api/v1/cms/relations'],
    [`/api/v1/cms/content-types/${TYPE_ID}/fields`],
    [`/api/v1/cms/content-types/${TYPE_ID}/relations`],
    [
      `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}/fields/${CHILD_ID}`,
    ],
    [
      `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}/relations/${CHILD_ID}`,
    ],
  ])('registers no standalone child route at %s', async (path) => {
    for (const method of ['POST', 'PUT', 'PATCH'] as const) {
      const harness = makeHarness();
      const template = jsonRequest(path, validField, { 'if-match': '"1"' });
      const response = await harness.app.request(
        new Request(template.url, {
          method,
          headers: template.headers,
          body: JSON.stringify(validField),
        }),
      );
      expect(response.status, `${method} ${path}`).toBeGreaterThanOrEqual(404);
      expect(response.status).toBeLessThanOrEqual(405);
      expect(harness.ports.addFieldDefinition).not.toHaveBeenCalled();
      expect(harness.ports.bindRelation).not.toHaveBeenCalled();
    }
  });

  it.each([
    ['CMS-03A-02', validField, 'addFieldDefinition'],
    ['CMS-03A-03', validRelation, 'bindRelation'],
  ] as const)(
    'relays %s against a version that is not an unactivated draft as a typed 409 with no child resource',
    async (operationId, body, port) => {
      const harness = makeHarness();
      harness.ports[port].mockResolvedValueOnce(
        error(409, 'CONFLICT', NOT_DRAFT, { currentState: 'active' }),
      );
      const response = await sendHuman(harness, operationId, body);
      expect(response.status).toBe(409);
      const parsed = await bodyOf(response);
      expect(parsed.code).toBe('CONFLICT');
      expect(JSON.stringify(parsed)).not.toContain('resourceKind');
      expect(harness.ports[port]).toHaveBeenCalledTimes(1);
      const input = harness.ports[port].mock.calls[0]?.[0] as {
        path: Record<string, string>;
      };
      expect(input.path).toEqual({
        contentTypeId: TYPE_ID,
        versionId: VERSION_ID,
      });
    },
  );

  it('addresses the child edit only through the owning version path, never through a body-supplied version or type', async () => {
    for (const [operationId, body, path] of [
      ['CMS-03A-02', validField, mutationPath.field],
      ['CMS-03A-03', validRelation, mutationPath.relation],
    ] as const) {
      const harness = makeHarness();
      const response = await harness.app.request(
        jsonRequest(
          path,
          { ...body, contentTypeVersionId: VERSION_ID },
          { 'if-match': '"1"' },
        ),
      );
      expect(response.status, operationId).toBe(422);
      expect(harness.ports.addFieldDefinition).not.toHaveBeenCalled();
      expect(harness.ports.bindRelation).not.toHaveBeenCalled();
    }
  });
});
