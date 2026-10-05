// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';
import {
  closeMounted,
  createForm,
} from './content-schema-registry-s09-r4-mapping-forms.test-support';
import { sentinelDetail } from './content-schema-registry-s09-r4-mapping.test-support';

/**
 * FE03 CMS-03A-01: the authoritative 201 `ContentTypeVersionResource` ends the
 * create form in navigation to the created version, which renders that exact
 * resource (every member of it is mapped by the detail mapping test).
 */

afterEach(() => {
  closeMounted();
  vi.unstubAllGlobals();
});

const resource = sentinelDetail().resource;
const CREATED = `/app/cms-content-modeling/${resource.contentTypeId}/versions/${resource.id}`;

const submitCreate = async (answer: Response) => {
  const form = createForm();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => answer),
  );
  const navigate = vi.fn();
  const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
    navigate,
  });
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(form.getAttribute('aria-busy')).toBe('false'));
  cleanup();
  return { form, navigate };
};

const created = (location: string, body: unknown = resource): Response =>
  new Response(JSON.stringify(body), {
    status: 201,
    headers: { 'content-type': 'application/json', location },
  });

describe('CMS-03A-01 201', () => {
  it('[P2-S09-AC-222] the authoritative 201 navigates to the created version at its server-provided same-origin address', async () => {
    const { navigate } = await submitCreate(created(CREATED));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(CREATED);
  });

  it('[P2-S09-AC-222] a cross-origin continuation is never followed', async () => {
    const { navigate } = await submitCreate(
      created('https://evil.example/app/cms-content-modeling'),
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-222] a 201 whose body is not a JSON object is not authoritative and never navigates', async () => {
    const { navigate, form } = await submitCreate(created(CREATED, 'created'));
    expect(navigate).not.toHaveBeenCalled();
    expect(
      form.querySelector('[data-cms-command-status]')?.textContent,
    ).toContain('still being reconciled');
  });
});
