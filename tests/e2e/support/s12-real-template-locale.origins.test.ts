import { describe, expect, it, vi } from 'vitest';

import type { CmsLocaleDependencies } from '../../../apps/worker/src/cms-composition/locale-routes';
import type { CmsTemplateDependencies } from '../../../apps/worker/src/cms-composition/template-routes';
import {
  createS12RealLocale,
  createS12RealTemplate,
} from './s12-real-template-locale';

/**
 * The real-route launcher serves two homes (fixture sessions and the production composition), so the
 * routed dependencies accept the origins of BOTH: the fixture origin the test world sends and the
 * origin the production composition is configured with (the launcher passes
 * `https://platform-api.internal` beside the web origin). The two differ here, so dropping either
 * side of the union is visible.
 */
const FIXTURE_ORIGIN = 'http://127.0.0.1:4324';
const PRODUCTION_ORIGIN = 'https://platform-api.internal';
const bindings = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SECRET_KEY: 'sb_secret_local_routing_probe',
  S10_HUMAN_ORIGINS: PRODUCTION_ORIGIN,
};

describe('S12 real-route origins', () => {
  it('the template composition accepts the fixture origin and the production origin, and only those', () => {
    const base = {
      humanOrigins: [FIXTURE_ORIGIN],
      now: Date.now,
      resolveSession: vi.fn(),
    } as unknown as CmsTemplateDependencies;
    const routed = createS12RealTemplate(base, bindings, new Set());
    expect([...routed.humanOrigins].sort()).toEqual(
      [FIXTURE_ORIGIN, PRODUCTION_ORIGIN].sort(),
    );
  });

  it('the locale composition accepts the fixture origin and the production origin, and only those', () => {
    const base = {
      humanOrigins: [FIXTURE_ORIGIN],
      now: Date.now,
      resolveSession: vi.fn(),
    } as unknown as CmsLocaleDependencies;
    const routed = createS12RealLocale(base, bindings, new Set());
    expect([...routed.humanOrigins].sort()).toEqual(
      [FIXTURE_ORIGIN, PRODUCTION_ORIGIN].sort(),
    );
  });
});
