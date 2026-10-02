/**
 * BE03a OD-4 locale-configuration acceptance evidence (CMS-03A-01 and
 * CMS-03A-09). Every case drives the real Hono app and admission pipeline;
 * only the dependency ports are faked. A refused request must be 422
 * VALIDATION_FAILED with the exact table message at the exact JSON pointer
 * and must never reach the port, so no row can be inserted.
 */
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
  humanRequest,
  makeDependencies,
} from './routes.coverage.fixtures';

type Violation = Readonly<{ pointer?: string; message?: string }>;
type Body = Record<string, unknown>;

const M = {
  size: 'supportedLocales must contain 1 to 32 locales',
  canonical: 'locale tag must be a canonical-case BCP 47 tag',
  unique: 'supportedLocales must be unique',
  missingSource: 'supportedLocales must include sourceLocale',
  missingDefault: 'supportedLocales must include defaultLocale',
  keyUnsupported: 'fallbackChains key must be a supported locale',
  forDefault: 'defaultLocale must not have a fallback chain',
  missing:
    'every supported locale other than defaultLocale needs a fallback chain',
  size16: 'fallback chain must contain 1 to 16 locales',
  chainUnsupported: 'fallback chain locale must be a supported locale',
  chainUnique: 'fallback chain locales must be unique',
  self: 'fallback chain must not include its own target locale',
  end: 'fallback chain must end at defaultLocale',
  cycle: 'fallback chains must not form a cycle',
  pair: 'supportedLocales and fallbackChains must be both null or both present',
} as const;

const draft = (overrides: Body): Body => ({
  ...contentTypeBody,
  supportedLocales: ['en-US', 'fr-FR'],
  fallbackChains: { 'fr-FR': ['en-US'] },
  ...overrides,
});

const withoutKey = (body: Body, key: string): Body =>
  Object.fromEntries(Object.entries(body).filter(([name]) => name !== key));

const send = async (body: Body) => {
  const { dependencies, ports } = makeDependencies();
  const response = await createContentSchemaRegistryApp(dependencies).request(
    humanRequest('/api/v1/cms/content-types', body),
  );
  return { response, ports };
};

const violationsOf = async (response: Response): Promise<Violation[]> => {
  const body = (await response.json()) as {
    code: string;
    details: { violations?: Violation[] };
  };
  expect(body.code).toBe('VALIDATION_FAILED');
  return body.details.violations ?? [];
};

const expectRefused = async (
  overrides: Body,
  expected: readonly Violation[],
): Promise<void> => {
  const { response, ports } = await send(draft(overrides));
  expect(response.status).toBe(422);
  expect(await violationsOf(response)).toEqual(expected);
  for (const port of Object.values(ports)) expect(port).not.toHaveBeenCalled();
};

const expectAccepted = async (overrides: Body): Promise<void> => {
  const body = draft(overrides);
  const { response, ports } = await send(body);
  expect(response.status).toBe(201);
  const calls = Object.values(ports).flatMap(
    (port) => (port as unknown as { mock: { calls: unknown[][] } }).mock.calls,
  );
  expect(calls).toHaveLength(1);
  const forwarded = (calls[0]?.[0] as { body: Body }).body;
  expect(forwarded.supportedLocales).toEqual(body.supportedLocales);
  expect(forwarded.fallbackChains).toEqual(body.fallbackChains);
};

const at = (pointer: string, message: string): Violation => ({
  pointer,
  message,
});

const THREE = ['en-US', 'fr-FR', 'pt-BR'];
const languages = (count: number): string[] =>
  Array.from(
    { length: count },
    (_, index) =>
      `${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(
        97 + (index % 26),
      )}`,
  ).filter((tag) => tag !== 'en');
const toEnglish = (tags: readonly string[]): Record<string, string[]> =>
  Object.fromEntries(
    tags.filter((tag) => tag !== 'en-US').map((tag) => [tag, ['en-US']]),
  );

describe('OD-4 CMS-03A-01 source and default locale fields', () => {
  it('[P2-S09-AC-043] [P2-S09-AC-1151] sourceLocale is a required canonical-case BCP 47 string of 2 to 35 characters that is a member of supportedLocales', async () => {
    const withoutSource = withoutKey(draft({}), 'sourceLocale');
    const missing = await send(withoutSource);
    expect(missing.response.status).toBe(422);
    for (const tag of ['en-us', 'e', 'EN', `en-${'x'.repeat(33)}`])
      await expectRefused({ sourceLocale: tag }, [
        at('/sourceLocale', M.canonical),
        at('/supportedLocales', M.missingSource),
      ]);
    await expectRefused({ sourceLocale: 'de-DE' }, [
      at('/supportedLocales', M.missingSource),
    ]);
    await expectAccepted({ sourceLocale: 'fr-FR' });
    await expectAccepted({
      sourceLocale: 'zh-Hans-CN',
      supportedLocales: ['en-US', 'zh-Hans-CN'],
      fallbackChains: { 'zh-Hans-CN': ['en-US'] },
    });
  });

  it('[P2-S09-AC-043] [P2-S09-AC-1152] defaultLocale is a required canonical-case BCP 47 string of 2 to 35 characters, the governed delivery fallback root, that is a member of supportedLocales', async () => {
    const withoutDefault = withoutKey(draft({}), 'defaultLocale');
    const missing = await send(withoutDefault);
    expect(missing.response.status).toBe(422);
    await expectRefused({ defaultLocale: 'de-DE' }, [
      at('/supportedLocales', M.missingDefault),
      at('/fallbackChains', M.missing),
      at('/fallbackChains/fr-FR', M.end),
    ]);
    const nonCanonical = await send(draft({ defaultLocale: 'en-us' }));
    expect(nonCanonical.response.status).toBe(422);
    expect(
      (await violationsOf(nonCanonical.response)).some(
        (entry) =>
          entry.pointer === '/defaultLocale' && entry.message === M.canonical,
      ),
    ).toBe(true);
    await expectAccepted({
      defaultLocale: 'fr-FR',
      fallbackChains: { 'en-US': ['fr-FR'] },
    });
  });
});

describe('OD-4 CMS-03A-01 supportedLocales rules', () => {
  it('[P2-S09-AC-1153] supportedLocales holds 1 to 32 entries and a request with 0 or 33 entries is refused with 422 and no partial insert', async () => {
    await expectRefused({ supportedLocales: [], fallbackChains: {} }, [
      at('/supportedLocales', M.size),
      at('/supportedLocales', M.missingSource),
      at('/supportedLocales', M.missingDefault),
    ]);
    const thirtyThree = ['en-US', ...languages(32)];
    const over = await send(
      draft({
        supportedLocales: thirtyThree,
        fallbackChains: toEnglish(thirtyThree),
      }),
    );
    expect(over.response.status).toBe(422);
    expect((await violationsOf(over.response))[0]).toEqual(
      at('/supportedLocales', M.size),
    );
    for (const port of Object.values(over.ports))
      expect(port).not.toHaveBeenCalled();
    const thirtyTwo = ['en-US', ...languages(31)];
    expect(thirtyTwo).toHaveLength(32);
    await expectAccepted({
      supportedLocales: thirtyTwo,
      fallbackChains: toEnglish(thirtyTwo),
    });
    await expectAccepted({ supportedLocales: ['en-US'], fallbackChains: {} });
  });

  it('[P2-S09-AC-1154] every supportedLocales tag is canonical case and 2 to 35 characters, so EN-us, en_US and zh-hans-cn are refused', async () => {
    for (const tag of [
      'EN-us',
      'en_US',
      'zh-hans-cn',
      'x',
      `en-${'a'.repeat(33)}`,
    ]) {
      const { response, ports } = await send(
        draft({
          supportedLocales: ['en-US', tag],
          fallbackChains: { 'fr-FR': ['en-US'] },
        }),
      );
      expect(response.status).toBe(422);
      expect(await violationsOf(response)).toContainEqual(
        at('/supportedLocales/1', M.canonical),
      );
      for (const port of Object.values(ports))
        expect(port).not.toHaveBeenCalled();
    }
    await expectAccepted({
      supportedLocales: ['en-US', 'zh-Hans-CN'],
      fallbackChains: { 'zh-Hans-CN': ['en-US'] },
    });
  });

  it('[P2-S09-AC-1155] supportedLocales entries are unique', async () => {
    await expectRefused(
      {
        supportedLocales: ['en-US', 'fr-FR', 'fr-FR'],
        fallbackChains: { 'fr-FR': ['en-US'] },
      },
      [at('/supportedLocales/2', M.unique)],
    );
  });

  it('[P2-S09-AC-1156] supportedLocales includes sourceLocale', async () => {
    await expectRefused({ sourceLocale: 'pt-BR' }, [
      at('/supportedLocales', M.missingSource),
    ]);
  });

  it('[P2-S09-AC-1157] supportedLocales includes defaultLocale', async () => {
    await expectRefused({ defaultLocale: 'pt-BR' }, [
      at('/supportedLocales', M.missingDefault),
      at('/fallbackChains', M.missing),
      at('/fallbackChains/fr-FR', M.end),
    ]);
  });
});

describe('OD-4 CMS-03A-01 fallbackChains rules', () => {
  it('[P2-S09-AC-1159] fallbackChains is keyed by every supported locale except defaultLocale, so a key outside supportedLocales, a key for defaultLocale and a supported locale without a key are each refused', async () => {
    await expectRefused(
      { fallbackChains: { 'fr-FR': ['en-US'], 'de-DE': ['en-US'] } },
      [at('/fallbackChains/de-DE', M.keyUnsupported)],
    );
    await expectRefused(
      { fallbackChains: { 'fr-FR': ['en-US'], 'en-US': ['fr-FR'] } },
      [at('/fallbackChains/en-US', M.forDefault)],
    );
    await expectRefused(
      { supportedLocales: THREE, fallbackChains: { 'fr-FR': ['en-US'] } },
      [at('/fallbackChains', M.missing)],
    );
    await expectAccepted({
      supportedLocales: THREE,
      fallbackChains: { 'fr-FR': ['en-US'], 'pt-BR': ['en-US'] },
    });
  });

  it('[P2-S09-AC-1160] each fallbackChains value holds 1 to 16 unique supported locales and a chain of 0 or 17 entries, a repeated locale or an unsupported locale is refused', async () => {
    await expectRefused({ fallbackChains: { 'fr-FR': [] } }, [
      at('/fallbackChains/fr-FR', M.size16),
    ]);
    const eighteen = ['en-US', ...languages(17)];
    const others = eighteen.filter((tag) => tag !== 'en-US');
    const seventeenChain = [...others.slice(1), 'en-US'];
    expect(seventeenChain).toHaveLength(17);
    await expectRefused(
      {
        supportedLocales: eighteen,
        fallbackChains: {
          ...toEnglish(eighteen),
          [others[0] as string]: seventeenChain,
        },
      },
      [at(`/fallbackChains/${others[0]}`, M.size16)],
    );
    const sixteenChain = [...others.slice(1, 16), 'en-US'];
    expect(sixteenChain).toHaveLength(16);
    await expectAccepted({
      supportedLocales: eighteen,
      fallbackChains: {
        ...toEnglish(eighteen),
        [others[0] as string]: sixteenChain,
      },
    });
    await expectRefused(
      {
        supportedLocales: THREE,
        fallbackChains: {
          'fr-FR': ['pt-BR', 'pt-BR', 'en-US'],
          'pt-BR': ['en-US'],
        },
      },
      [at('/fallbackChains/fr-FR/1', M.chainUnique)],
    );
    await expectRefused({ fallbackChains: { 'fr-FR': ['de-DE', 'en-US'] } }, [
      at('/fallbackChains/fr-FR/0', M.chainUnsupported),
    ]);
  });

  it('[P2-S09-AC-1161] a fallbackChains value never contains its own target locale', async () => {
    await expectRefused({ fallbackChains: { 'fr-FR': ['fr-FR', 'en-US'] } }, [
      at('/fallbackChains/fr-FR/0', M.self),
    ]);
  });

  it('[P2-S09-AC-1162] each fallbackChains value ends at defaultLocale', async () => {
    await expectRefused(
      {
        supportedLocales: THREE,
        fallbackChains: { 'fr-FR': ['en-US', 'pt-BR'], 'pt-BR': ['en-US'] },
      },
      [at('/fallbackChains/fr-FR', M.end)],
    );
  });

  it('[P2-S09-AC-1163] the directed graph with an edge from each target to every locale in its chain is acyclic, so a two-node cycle and a three-node cycle are refused', async () => {
    await expectRefused(
      {
        supportedLocales: THREE,
        fallbackChains: {
          'fr-FR': ['pt-BR', 'en-US'],
          'pt-BR': ['fr-FR', 'en-US'],
        },
      },
      [at('/fallbackChains', M.cycle)],
    );
    const four = [...THREE, 'de-DE'];
    await expectRefused(
      {
        supportedLocales: four,
        fallbackChains: {
          'fr-FR': ['pt-BR', 'en-US'],
          'pt-BR': ['de-DE', 'en-US'],
          'de-DE': ['fr-FR', 'en-US'],
        },
      },
      [at('/fallbackChains', M.cycle)],
    );
    await expectAccepted({
      supportedLocales: four,
      fallbackChains: {
        'fr-FR': ['pt-BR', 'en-US'],
        'pt-BR': ['de-DE', 'en-US'],
        'de-DE': ['en-US'],
      },
    });
  });

  it('[P2-S09-AC-1164] fallbackChains is {} only when supportedLocales is exactly [defaultLocale]', async () => {
    await expectAccepted({ supportedLocales: ['en-US'], fallbackChains: {} });
    await expectRefused({ fallbackChains: {} }, [
      at('/fallbackChains', M.missing),
    ]);
    await expectRefused(
      { supportedLocales: ['en-US'], fallbackChains: { 'fr-FR': ['en-US'] } },
      [at('/fallbackChains/fr-FR', M.keyUnsupported)],
    );
  });
});

describe('OD-4 CMS-03A-01 exact 422 messages and paths', () => {
  it('[P2-S09-AC-1167] reports supportedLocales must contain 1 to 32 locales at [supportedLocales] for 0 or more than 32 entries', async () => {
    const zero = await send(
      draft({ supportedLocales: [], fallbackChains: {} }),
    );
    expect(await violationsOf(zero.response)).toContainEqual(
      at('/supportedLocales', M.size),
    );
    const tags = ['en-US', ...languages(32)];
    const many = await send(
      draft({ supportedLocales: tags, fallbackChains: toEnglish(tags) }),
    );
    expect(await violationsOf(many.response)).toContainEqual(
      at('/supportedLocales', M.size),
    );
  });

  it('[P2-S09-AC-1168] reports the canonical-case message at the tag path when a tag is not canonical case, is outside 2-35 characters or is not BCP 47', async () => {
    for (const tag of ['en-us', 'x', 'en_US', `en-${'a'.repeat(33)}`, '12']) {
      const { response } = await send(
        draft({
          supportedLocales: ['en-US', 'fr-FR', tag],
          fallbackChains: { 'fr-FR': ['en-US'] },
        }),
      );
      expect(response.status).toBe(422);
      expect(await violationsOf(response)).toContainEqual(
        at('/supportedLocales/2', M.canonical),
      );
    }
  });

  it('[P2-S09-AC-1169] reports supportedLocales must be unique at [supportedLocales, index] for a repeated tag', async () => {
    await expectRefused(
      {
        supportedLocales: ['en-US', 'fr-FR', 'en-US'],
        fallbackChains: { 'fr-FR': ['en-US'] },
      },
      [at('/supportedLocales/2', M.unique)],
    );
  });

  it('[P2-S09-AC-1170] reports supportedLocales must include sourceLocale at [supportedLocales] when sourceLocale is not a member', async () => {
    await expectRefused({ sourceLocale: 'de-DE' }, [
      at('/supportedLocales', M.missingSource),
    ]);
  });

  it('[P2-S09-AC-1171] reports supportedLocales must include defaultLocale at [supportedLocales] when defaultLocale is not a member', async () => {
    const { response } = await send(draft({ defaultLocale: 'de-DE' }));
    expect(await violationsOf(response)).toContainEqual(
      at('/supportedLocales', M.missingDefault),
    );
  });

  it('[P2-S09-AC-1172] reports fallbackChains key must be a supported locale at [fallbackChains, key] when a key is not a supported locale', async () => {
    await expectRefused(
      { fallbackChains: { 'fr-FR': ['en-US'], 'de-DE': ['en-US'] } },
      [at('/fallbackChains/de-DE', M.keyUnsupported)],
    );
  });

  it('[P2-S09-AC-1173] reports defaultLocale must not have a fallback chain at [fallbackChains, defaultLocale] when defaultLocale has a key', async () => {
    await expectRefused(
      { fallbackChains: { 'fr-FR': ['en-US'], 'en-US': ['fr-FR'] } },
      [at('/fallbackChains/en-US', M.forDefault)],
    );
  });

  it('[P2-S09-AC-1174] reports the missing-chain message at [fallbackChains] when a supported locale other than defaultLocale has no key', async () => {
    await expectRefused(
      { supportedLocales: THREE, fallbackChains: { 'fr-FR': ['en-US'] } },
      [at('/fallbackChains', M.missing)],
    );
  });

  it('[P2-S09-AC-1175] reports fallback chain must contain 1 to 16 locales at [fallbackChains, target] when a chain has 0 or more than 16 entries', async () => {
    await expectRefused({ fallbackChains: { 'fr-FR': [] } }, [
      at('/fallbackChains/fr-FR', M.size16),
    ]);
    const eighteen = ['en-US', ...languages(17)];
    const others = eighteen.filter((tag) => tag !== 'en-US');
    await expectRefused(
      {
        supportedLocales: eighteen,
        fallbackChains: {
          ...toEnglish(eighteen),
          [others[0] as string]: [...others.slice(1), 'en-US'],
        },
      },
      [at(`/fallbackChains/${others[0]}`, M.size16)],
    );
  });

  it('[P2-S09-AC-1176] reports fallback chain locale must be a supported locale at [fallbackChains, target, index] when a chain entry is not a supported locale', async () => {
    await expectRefused({ fallbackChains: { 'fr-FR': ['de-DE', 'en-US'] } }, [
      at('/fallbackChains/fr-FR/0', M.chainUnsupported),
    ]);
  });

  it('[P2-S09-AC-1177] reports fallback chain locales must be unique at [fallbackChains, target, index] when a chain repeats a locale', async () => {
    await expectRefused(
      {
        supportedLocales: THREE,
        fallbackChains: {
          'fr-FR': ['pt-BR', 'pt-BR', 'en-US'],
          'pt-BR': ['en-US'],
        },
      },
      [at('/fallbackChains/fr-FR/1', M.chainUnique)],
    );
  });

  it('[P2-S09-AC-1178] reports fallback chain must not include its own target locale at [fallbackChains, target, index] when a chain contains its own target', async () => {
    await expectRefused({ fallbackChains: { 'fr-FR': ['fr-FR', 'en-US'] } }, [
      at('/fallbackChains/fr-FR/0', M.self),
    ]);
  });

  it('[P2-S09-AC-1179] reports fallback chain must end at defaultLocale at [fallbackChains, target] when the last entry is not defaultLocale', async () => {
    await expectRefused(
      {
        supportedLocales: THREE,
        fallbackChains: { 'fr-FR': ['en-US', 'pt-BR'], 'pt-BR': ['en-US'] },
      },
      [at('/fallbackChains/fr-FR', M.end)],
    );
  });

  it('[P2-S09-AC-1180] reports fallback chains must not form a cycle at [fallbackChains] when the chain graph has a cycle', async () => {
    await expectRefused(
      {
        supportedLocales: THREE,
        fallbackChains: {
          'fr-FR': ['pt-BR', 'en-US'],
          'pt-BR': ['fr-FR', 'en-US'],
        },
      },
      [at('/fallbackChains', M.cycle)],
    );
  });
});

describe('OD-4 CMS-03A-09 successor locale pair and ordering', () => {
  const spec = specFor('CMS-03A-09');
  const sendSuccessor = async (body: Body) => {
    const harness = makeDec108Harness({ session: sessionResult(spec) });
    const response = await harness.app.request(requestFor(spec, { body }));
    return { response, port: harness.ports.createSchemaSuccessor };
  };

  it('[P2-S09-AC-1181] reports the both-null-or-both-present message at [fallbackChains] when CMS-03A-09 sends one of supportedLocales and fallbackChains without the other', async () => {
    for (const locale of [
      { supportedLocales: ['en-US'], fallbackChains: null },
      { supportedLocales: null, fallbackChains: {} },
    ]) {
      const { response, port } = await sendSuccessor({
        expectedVersion: '1',
        ...locale,
      });
      expect(response.status).toBe(422);
      expect(await violationsOf(response)).toEqual([
        at('/fallbackChains', M.pair),
      ]);
      expect(port).not.toHaveBeenCalled();
    }
  });

  it('[P2-S09-AC-1187] CMS-03A-09 supportedLocales and fallbackChains are both null or both present and one present without the other is refused with 422', async () => {
    for (const locale of [
      { supportedLocales: ['en-US', 'fr-FR'], fallbackChains: null },
      { supportedLocales: null, fallbackChains: { 'fr-FR': ['en-US'] } },
    ]) {
      const { response, port } = await sendSuccessor({
        expectedVersion: '1',
        ...locale,
      });
      expect(response.status).toBe(422);
      expect(port).not.toHaveBeenCalled();
    }
    for (const locale of [
      { supportedLocales: null, fallbackChains: null },
      {
        supportedLocales: ['en-US', 'fr-FR'],
        fallbackChains: { 'fr-FR': ['en-US'] },
      },
    ]) {
      const { response, port } = await sendSuccessor({
        expectedVersion: '1',
        ...locale,
      });
      expect(response.status).toBe(201);
      expect(port).toHaveBeenCalledTimes(1);
    }
  });

  it('[P2-S09-AC-1182] CMS-03A-01 and CMS-03A-09 return every locale-configuration issue of a request with several defects in the order of the exact-refusal table, each as { path, message } in ApiError.details', async () => {
    const expected = [
      M.canonical,
      M.unique,
      M.missingSource,
      M.keyUnsupported,
      M.forDefault,
      M.missing,
    ];
    const created = await send(
      draft({
        sourceLocale: 'de-DE',
        supportedLocales: ['en-US', 'fr-fr', 'en-US'],
        fallbackChains: { 'es-ES': ['en-US'], 'en-US': ['fr-FR'] },
      }),
    );
    expect(
      (await violationsOf(created.response)).map((entry) => entry.message),
    ).toEqual(expected);
    const successor = await sendSuccessor({
      expectedVersion: '1',
      supportedLocales: ['en-US', 'fr-fr', 'en-US'],
      fallbackChains: { 'es-ES': ['en-US'], 'en-US': ['fr-FR'] },
    });
    expect(successor.response.status).toBe(422);
    const messages = (await violationsOf(successor.response)).map(
      (entry) => entry.message,
    );
    expect(messages).toEqual([
      M.canonical,
      M.unique,
      M.keyUnsupported,
      M.chainUnsupported,
    ]);
    const rank = messages.map((message) =>
      Object.values(M).indexOf(message as never),
    );
    expect(rank).toEqual([...rank].sort((left, right) => left - right));
    expect(successor.port).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-1183] CMS-03A-01 inserts no row when any locale-configuration rule refuses the request', async () => {
    const refusals: readonly Body[] = [
      { supportedLocales: [], fallbackChains: {} },
      { supportedLocales: ['en-US', 'EN-us'], fallbackChains: {} },
      {
        supportedLocales: ['en-US', 'fr-FR', 'fr-FR'],
        fallbackChains: { 'fr-FR': ['en-US'] },
      },
      { sourceLocale: 'de-DE' },
      { fallbackChains: {} },
      { fallbackChains: { 'fr-FR': ['fr-FR', 'en-US'] } },
    ];
    for (const overrides of refusals) {
      const { response, ports } = await send(draft(overrides));
      expect(response.status).toBe(422);
      for (const port of Object.values(ports))
        expect(port).not.toHaveBeenCalled();
    }
  });
});
