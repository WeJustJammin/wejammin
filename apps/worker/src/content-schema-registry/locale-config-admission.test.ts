import { describe, expect, it } from 'vitest';

import {
  makeDec108Harness,
  requestFor,
  sessionResult,
  specFor,
} from './phase-02-slice-09-dec108-test-support';
import { createContentSchemaRegistryApp } from './routes';
import {
  contentTypeBody,
  expectError,
  humanRequest,
  makeDependencies,
} from './routes.coverage.fixtures';

type Violation = Readonly<{ pointer?: string; message?: string }>;

const violationsOf = async (response: Response): Promise<Violation[]> => {
  const body = (await response.json()) as {
    code: string;
    details: { violations?: Violation[] };
  };
  expect(body.code).toBe('VALIDATION_FAILED');
  return body.details.violations ?? [];
};

const draft = (overrides: Record<string, unknown>) => ({
  ...contentTypeBody,
  supportedLocales: ['en-US', 'fr-FR'],
  fallbackChains: { 'fr-FR': ['en-US'] },
  ...overrides,
});

const createDraft = async (body: unknown) => {
  const { dependencies, ports } = makeDependencies();
  const response = await createContentSchemaRegistryApp(dependencies).request(
    humanRequest('/api/v1/cms/content-types', body),
  );
  return { response, ports };
};

describe('CMS-03A-01 locale configuration admission (OD-4)', () => {
  it('returns the exact table message at the table path and never calls the port', async () => {
    const { response, ports } = await createDraft(
      draft({
        supportedLocales: ['en-US', 'fr-FR', 'fr-FR'],
        fallbackChains: { 'fr-FR': ['en-US'], 'de-DE': ['en-US'] },
      }),
    );
    expect(response.status).toBe(422);
    expect(await violationsOf(response)).toEqual([
      {
        pointer: '/supportedLocales/2',
        message: 'supportedLocales must be unique',
      },
      {
        pointer: '/fallbackChains/de-DE',
        message: 'fallbackChains key must be a supported locale',
      },
    ]);
    for (const port of Object.values(ports))
      expect(port).not.toHaveBeenCalled();
  });

  it('reports every defect in the exact-refusal table order', async () => {
    const { response } = await createDraft(
      draft({
        sourceLocale: 'de-DE',
        supportedLocales: ['en-US', 'fr-fr', 'en-US'],
        fallbackChains: { 'es-ES': ['en-US'], 'en-US': ['fr-FR'] },
      }),
    );
    expect(
      (await violationsOf(response)).map((entry) => entry.message),
    ).toEqual([
      'locale tag must be a canonical-case BCP 47 tag',
      'supportedLocales must be unique',
      'supportedLocales must include sourceLocale',
      'fallbackChains key must be a supported locale',
      'defaultLocale must not have a fallback chain',
      'every supported locale other than defaultLocale needs a fallback chain',
    ]);
  });

  it('names a cycle and a chain that does not end at the default', async () => {
    const cycle = await createDraft(
      draft({
        supportedLocales: ['en-US', 'fr-FR', 'pt-BR'],
        fallbackChains: {
          'fr-FR': ['pt-BR', 'en-US'],
          'pt-BR': ['fr-FR', 'en-US'],
        },
      }),
    );
    expect(await violationsOf(cycle.response)).toEqual([
      {
        pointer: '/fallbackChains',
        message: 'fallback chains must not form a cycle',
      },
    ]);
    const end = await createDraft(
      draft({
        supportedLocales: ['en-US', 'fr-FR', 'pt-BR'],
        fallbackChains: { 'fr-FR': ['en-US', 'pt-BR'], 'pt-BR': ['en-US'] },
      }),
    );
    expect(await violationsOf(end.response)).toEqual([
      {
        pointer: '/fallbackChains/fr-FR',
        message: 'fallback chain must end at defaultLocale',
      },
    ]);
  });

  it('escapes pointer segments and drops a pointer it cannot print safely', async () => {
    const { response } = await createDraft(
      draft({
        supportedLocales: ['en-US'],
        fallbackChains: { 'a/b': ['en-US'], é: ['en-US'] },
      }),
    );
    const violations = await violationsOf(response);
    expect(violations).toContainEqual({
      pointer: '/fallbackChains/a~1b',
      message: 'locale tag must be a canonical-case BCP 47 tag',
    });
    expect(
      violations.every(
        (entry) => entry.message !== undefined && !('path' in entry),
      ),
    ).toBe(true);
  });

  it('keeps non-locale validation failures free of client-controlled text', async () => {
    const { response } = await createDraft(draft({ typeKey: 'Bad Key' }));
    const violations = await violationsOf(response);
    expect(violations.length).toBeGreaterThan(0);
    for (const entry of violations)
      expect(entry.message).toBe('The value is invalid.');
  });

  it('passes a valid configuration through unsorted and unchanged', async () => {
    const body = draft({
      supportedLocales: ['fr-FR', 'en-US'],
      fallbackChains: { 'fr-FR': ['en-US'] },
    });
    const { response, ports } = await createDraft(body);
    expect(response.status).toBe(201);
    expect(ports.createTypeDraft).toHaveBeenCalledTimes(1);
    const port = ports.createTypeDraft as unknown as {
      mock: { calls: { body: Record<string, unknown> }[][] };
    };
    const call = port.mock.calls[0]?.[0] as {
      body: Record<string, unknown>;
    };
    expect(call.body).toMatchObject({
      supportedLocales: ['fr-FR', 'en-US'],
      fallbackChains: { 'fr-FR': ['en-US'] },
    });
  });

  it('rejects a port result that omits the locale configuration or hash', async () => {
    const { dependencies } = makeDependencies();
    const first = await createContentSchemaRegistryApp(dependencies).request(
      humanRequest('/api/v1/cms/content-types', draft({})),
    );
    expect(first.status).toBe(201);
    const resource = (await first.json()) as Record<string, unknown>;
    for (const key of [
      'supportedLocales',
      'fallbackChains',
      'localeConfigHash',
    ]) {
      const incomplete = Object.fromEntries(
        Object.entries(resource).filter(([name]) => name !== key),
      );
      const { dependencies: broken } = makeDependencies({
        port: { ok: true, value: incomplete },
      });
      const response = await createContentSchemaRegistryApp(broken).request(
        humanRequest('/api/v1/cms/content-types', draft({})),
      );
      await expectError(response, 502);
    }
  });
});

describe('CMS-03A-09 successor locale configuration admission (OD-4)', () => {
  const spec = specFor('CMS-03A-09');
  const send = async (body: unknown) => {
    const harness = makeDec108Harness({ session: sessionResult(spec) });
    const response = await harness.app.request(requestFor(spec, { body }));
    return { response, port: harness.ports.createSchemaSuccessor };
  };

  it.each([
    [
      'supportedLocales without fallbackChains',
      { supportedLocales: ['en-US'], fallbackChains: null },
    ],
    [
      'fallbackChains without supportedLocales',
      { supportedLocales: null, fallbackChains: {} },
    ],
  ])('refuses %s with the exact pair message', async (_name, locale) => {
    const { response, port } = await send({ expectedVersion: '1', ...locale });
    expect(response.status).toBe(422);
    expect(await violationsOf(response)).toEqual([
      {
        pointer: '/fallbackChains',
        message:
          'supportedLocales and fallbackChains must be both null or both present',
      },
    ]);
    expect(port).not.toHaveBeenCalled();
  });

  it('refuses an invalid replacement before the port', async () => {
    const { response, port } = await send({
      expectedVersion: '1',
      supportedLocales: ['en-US', 'fr-FR'],
      fallbackChains: { 'fr-FR': ['de-DE'] },
    });
    expect(await violationsOf(response)).toEqual([
      {
        pointer: '/fallbackChains/fr-FR/0',
        message: 'fallback chain locale must be a supported locale',
      },
    ]);
    expect(port).not.toHaveBeenCalled();
  });

  it('passes both-null (clone) and both-present (replace) to the port unchanged', async () => {
    const clone = await send({
      expectedVersion: '1',
      supportedLocales: null,
      fallbackChains: null,
    });
    expect(clone.response.status).toBe(201);
    expect((clone.port?.mock.calls[0]?.[0] as { body: unknown }).body).toEqual({
      expectedVersion: '1',
      supportedLocales: null,
      fallbackChains: null,
    });
    const replace = await send({
      expectedVersion: '1',
      supportedLocales: ['fr-FR', 'en-US'],
      fallbackChains: { 'fr-FR': ['en-US'] },
    });
    expect(replace.response.status).toBe(201);
    expect(
      (replace.port?.mock.calls[0]?.[0] as { body: unknown }).body,
    ).toEqual({
      expectedVersion: '1',
      supportedLocales: ['fr-FR', 'en-US'],
      fallbackChains: { 'fr-FR': ['en-US'] },
    });
  });

  it('refuses a request that omits the locale pair keys entirely', async () => {
    const { response, port } = await send({ expectedVersion: '1' });
    expect(response.status).toBe(422);
    expect(port).not.toHaveBeenCalled();
  });
});
