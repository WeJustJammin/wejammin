import { describe, it } from 'vitest';

import { createProductionCmsEditorialDependencies } from './cms-editorial-production';
import {
  configuredOriginList,
  validateOriginList,
} from './cms-editorial-production-session';
import {
  CmsEditorialProductionConfigurationError,
  DEFAULT_DEADLINE_MS,
  MAX_ORIGIN_LENGTH,
} from './cms-editorial-production-types';
import {
  environment,
  expect,
  vi,
} from './cms-editorial-production.test-support';

const composeWith = (
  overrides: Record<string, unknown> = {},
  env: typeof environment = environment,
) =>
  createProductionCmsEditorialDependencies({
    environment: env,
    fetchImpl: vi.fn() as unknown as typeof fetch,
    ...overrides,
  } as never);

const rejectsOrigin = (origin: unknown): boolean => {
  try {
    validateOriginList(
      [origin] as readonly string[],
      CmsEditorialProductionConfigurationError,
    );
    return false;
  } catch {
    return true;
  }
};

describe('cms editorial production factory configuration', () => {
  it('wraps an invalid Supabase environment as a configuration error', () => {
    expect(() =>
      composeWith({}, { ...environment, SUPABASE_URL: 'not-a-url' }),
    ).toThrow(CmsEditorialProductionConfigurationError);
    expect(() =>
      composeWith({}, { ...environment, SUPABASE_SECRET_KEY: 'short' }),
    ).toThrow(CmsEditorialProductionConfigurationError);
  });

  it('rejects an out-of-band deadline or response budget', () => {
    for (const deadlineMs of [0, -1, 1.5, DEFAULT_DEADLINE_MS + 1]) {
      expect(() => composeWith({ deadlineMs })).toThrow(
        CmsEditorialProductionConfigurationError,
      );
    }
    for (const maxResponseBytes of [0, 1.5, Number.NaN]) {
      expect(() => composeWith({ maxResponseBytes })).toThrow(
        CmsEditorialProductionConfigurationError,
      );
    }
    expect(() =>
      composeWith({ deadlineMs: DEFAULT_DEADLINE_MS }),
    ).not.toThrow();
    expect(() => composeWith({ maxResponseBytes: 1 })).not.toThrow();
  });

  it('reads the human origin allowlist from the environment by default', () => {
    const dependencies = composeWith(
      {},
      {
        ...environment,
        CMS_HUMAN_ORIGINS:
          'https://cms.example.test, https://admin.example.test',
      },
    );
    expect(dependencies.humanOrigins).toEqual([
      'https://cms.example.test',
      'https://admin.example.test',
    ]);
    expect(Object.isFrozen(dependencies.humanOrigins)).toBe(true);
  });

  it('treats an absent or blank origin list as empty', () => {
    expect(configuredOriginList(undefined)).toEqual([]);
    expect(configuredOriginList('   ')).toEqual([]);
    expect(
      composeWith({}, { ...environment, CMS_HUMAN_ORIGINS: '  ' }).humanOrigins,
    ).toEqual([]);
  });

  it('rejects an explicit wildcard or non-string origin entry', () => {
    expect(rejectsOrigin('*')).toBe(true);
    expect(rejectsOrigin('')).toBe(true);
    expect(rejectsOrigin('https://cms.example.test\n')).toBe(true);
    expect(rejectsOrigin('x'.repeat(MAX_ORIGIN_LENGTH + 1))).toBe(true);
    expect(rejectsOrigin(17)).toBe(true);
  });

  it('rejects an origin that is not a bare HTTP(S) root', () => {
    expect(rejectsOrigin('https://')).toBe(true);
    expect(rejectsOrigin('not-a-url')).toBe(true);
    expect(rejectsOrigin('ftp://cms.example.test')).toBe(true);
    expect(rejectsOrigin('https://user:pass@cms.example.test')).toBe(true);
    expect(rejectsOrigin('https://cms.example.test/path')).toBe(true);
    expect(rejectsOrigin('https://cms.example.test/?q=1')).toBe(true);
    expect(rejectsOrigin('https://cms.example.test/#frag')).toBe(true);
    expect(rejectsOrigin('https://cms.example.test')).toBe(false);
    expect(rejectsOrigin('http://localhost:8787')).toBe(false);
  });

  it('rejects a non-array origin allowlist', () => {
    expect(() =>
      validateOriginList(
        'https://cms.example.test' as unknown as readonly string[],
        CmsEditorialProductionConfigurationError,
      ),
    ).toThrow(CmsEditorialProductionConfigurationError);
    expect(
      validateOriginList(undefined, CmsEditorialProductionConfigurationError),
    ).toEqual([]);
  });

  it('accepts a caller-supplied origin allowlist over the environment', () => {
    const dependencies = composeWith({
      humanOrigins: ['https://console.example.test'],
    });
    expect(dependencies.humanOrigins).toEqual(['https://console.example.test']);
  });

  it('names the configuration error with a default and a custom message', () => {
    expect(new CmsEditorialProductionConfigurationError().message).toBe(
      'Invalid cms editorial production configuration',
    );
    expect(new CmsEditorialProductionConfigurationError('boom').message).toBe(
      'boom',
    );
  });

  it('falls back to the default message for a non-Error configuration fault', () => {
    const hostile = {
      ...environment,
      get SUPABASE_URL(): string {
        throw 'not-an-error';
      },
    } as unknown as typeof environment;
    expect(() => composeWith({}, hostile)).toThrow(
      CmsEditorialProductionConfigurationError,
    );
    expect(() => composeWith({}, hostile)).toThrow(
      'Invalid cms editorial production configuration',
    );
  });

  it('defaults the transport seams when no fetch implementation is supplied', () => {
    const dependencies = createProductionCmsEditorialDependencies({
      environment,
      humanOrigins: ['https://cms.example.test'],
    });
    expect(typeof dependencies.now).toBe('function');
    expect(dependencies.deadlineMs).toBe(DEFAULT_DEADLINE_MS);
  });
});
