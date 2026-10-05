import { describe, expect, it, vi } from 'vitest';

import { LOCALE_CONFIG_MESSAGES } from '@wejammin/contracts/client';

import { forwardContentSchemaRegistryMutation } from '../../server/content-schema-registry-platform-api';
import { invalidPayloadError } from '../../server/content-schema-registry-platform-mutation-support';

/**
 * AC248 (FE03 form validation): a refused form names the offending field by
 * RFC 6901 JSON Pointer so the summary can link it and the field can be marked
 * invalid. The first-party façade refuses a payload that fails the generated
 * request schema before any dependency call; that local 422 used to carry
 * pointers only for locale and template-binding issues, so an invalid type key
 * answered "Check the highlighted schema fields." with nothing highlighted.
 * Every issue now contributes its pointer; only the fixed server-owned locale
 * strings carry text, and no echoed input ever does.
 */

const request = (): Request =>
  new Request('https://app.test/app/cms-content-modeling', {
    method: 'POST',
    headers: { 'x-request-id': '018f0c45-73fe-7dc2-9c09-68f7ecf132dd' },
  });

const violationsOf = async (response: Response): Promise<unknown> =>
  ((await response.json()) as { details: { violations?: unknown } }).details
    .violations;

describe('[P2-S09-AC-248] local 422 names every invalid field', () => {
  it('[P2-S09-AC-248] gives a pointer, and no text, for an issue that is not a locale or template-binding refusal', async () => {
    const response = invalidPayloadError(request(), [
      { path: ['typeKey'], message: 'Invalid string: must match pattern' },
    ]);
    expect(response.status).toBe(422);
    expect(await violationsOf(response)).toEqual([{ path: '/typeKey' }]);
  });

  it('[P2-S09-AC-248] keeps the fixed locale text beside its pointer and orders mixed issues as the schema reported them', async () => {
    const response = invalidPayloadError(request(), [
      { path: ['label'], message: 'Too small' },
      { path: ['supportedLocales', 1], message: LOCALE_CONFIG_MESSAGES.unique },
      { path: ['ownerCapability'], message: 'Invalid input' },
    ]);
    expect(await violationsOf(response)).toEqual([
      { path: '/label' },
      { path: '/supportedLocales/1', message: LOCALE_CONFIG_MESSAGES.unique },
      { path: '/ownerCapability' },
    ]);
  });

  it('[P2-S09-AC-248] escapes pointer segments and never echoes an issue message that is not a fixed string', async () => {
    const response = invalidPayloadError(request(), [
      { path: ['a/b', 'c~d'], message: 'SECRET-INPUT-VALUE' },
    ]);
    const body = JSON.stringify(await violationsOf(response));
    expect(body).toBe('[{"path":"/a~1b/c~0d"}]');
    expect(body).not.toContain('SECRET-INPUT-VALUE');
  });

  it('[P2-S09-AC-248] skips a whole-payload issue that has no field to point at, and caps the list at 50', async () => {
    const issues = [
      { path: [], message: 'Invalid input: expected object' },
      ...Array.from({ length: 60 }, (_, index) => ({
        path: [`field${index}`],
        message: 'Invalid input',
      })),
    ];
    const violations = (await violationsOf(
      invalidPayloadError(request(), issues),
    )) as { path: string }[];
    expect(violations).toHaveLength(50);
    expect(violations[0]).toEqual({ path: '/field0' });
  });

  it('[P2-S09-AC-248] sends no violations when every issue is a whole-payload issue', async () => {
    const response = invalidPayloadError(request(), [
      { path: [], message: 'Invalid input: expected object' },
    ]);
    expect(((await response.json()) as { details: object }).details).toEqual(
      {},
    );
  });

  it('[P2-S09-AC-248] the real façade answers a create with an invalid type key by pointing at /typeKey before any dependency call', async () => {
    const binding = { fetch: vi.fn(async () => new Response('{}')) };
    const response = await forwardContentSchemaRegistryMutation(
      new Request('https://app.test/app/cms-content-modeling', {
        method: 'POST',
        headers: {
          cookie: 'wj_access=session; wj_csrf=csrf',
          origin: 'https://app.test',
          'content-type': 'application/json',
          'x-csrf-token': 'csrf',
          'idempotency-key': 'cms-operation-123',
          'x-request-id': '018f0c45-73fe-7dc2-9c09-68f7ecf132dd',
        },
        body: JSON.stringify({
          typeKey: 'Bad Key',
          label: 'Release note',
          ownerCapability: 'cms.schema_designer',
          sourceLocale: 'en-US',
          defaultLocale: 'en-US',
          supportedLocales: ['en-US'],
          fallbackChains: {},
          workflowKey: 'cms.content.workflow',
          workflowVersion: '1',
          defaultTemplateVersionId: null,
          fields: [],
          relations: [],
          templateBindings: [],
          capabilityBindings: [],
        }),
      }),
      binding,
      { operationId: 'CMS-03A-01' },
    );
    expect(response.status).toBe(422);
    expect(binding.fetch).not.toHaveBeenCalled();
    expect(await violationsOf(response)).toEqual([{ path: '/typeKey' }]);
  });
});
