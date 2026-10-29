import { describe, expect, it } from 'vitest';

import { createProductionCmsCompositionDependencies } from '../../../apps/worker/src/production-worker-runtime-cms';
import type { WorkerBindings } from '../../../apps/worker/src/worker-bindings';
import { createS12RealGoverned } from './s12-real-governed';
import {
  createS12RealLocale,
  createS12RealTemplate,
} from './s12-real-template-locale';

/*
 * The real-route API Worker registers a CMS route only when its composition boundary is present;
 * a boundary left out is a 404 the web relays as a 502 ([T7] failed that way: the launcher had no
 * CMS-03C-03 term actions). The launcher serves `cmsEditorial` (Slice 11 production composition)
 * and the `cmsTemplate` / `cmsLocale` fixtures itself; every other boundary production composes
 * must come from createS12RealGoverned. The launcher's `cmsTemplate` / `cmsLocale` are routed (a
 * Slice 11/12 session reaches production, every other session its fixture), so the routed objects
 * must expose exactly the members production composes. Construction only: nothing is fetched.
 */
const LAUNCHER_SERVED = ['cmsEditorial', 'cmsLocale', 'cmsTemplate'];
const bindings = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SECRET_KEY: 'sb_secret_local_parity_probe',
  S10_HUMAN_ORIGINS: 'http://127.0.0.1:4324',
};

describe('S12 real-route API Worker composition parity', () => {
  it('serves every CMS composition boundary the production Worker composes', () => {
    const production = createProductionCmsCompositionDependencies(
      {
        ...bindings,
        APP_ENVIRONMENT: 'development',
        APP_RELEASE: 's12-parity',
        CMS_HUMAN_ORIGINS: bindings.S10_HUMAN_ORIGINS,
      } as unknown as WorkerBindings,
      (input, init) => fetch(input, init),
      { resolveSession: async () => ({ ok: false }) } as never,
      undefined,
    );
    const served = Object.keys(createS12RealGoverned(bindings, new Set()));
    const expected = Object.keys(production)
      .filter((key) => !LAUNCHER_SERVED.includes(key))
      .sort();
    expect(served.sort()).toEqual(expected);
    expect(LAUNCHER_SERVED.every((key) => key in production)).toBe(true);
  });

  it('routes the template and locale boundaries with every member production composes', () => {
    const production = createProductionCmsCompositionDependencies(
      {
        ...bindings,
        APP_ENVIRONMENT: 'development',
        APP_RELEASE: 's12-parity',
        CMS_HUMAN_ORIGINS: bindings.S10_HUMAN_ORIGINS,
      } as unknown as WorkerBindings,
      (input, init) => fetch(input, init),
      { resolveSession: async () => ({ ok: false }) } as never,
      undefined,
    );
    const routedTemplate = createS12RealTemplate(
      production.cmsTemplate,
      bindings,
      new Set(),
    );
    const routedLocale = createS12RealLocale(
      production.cmsLocale,
      bindings,
      new Set(),
    );
    expect(Object.keys(routedTemplate).sort()).toEqual(
      Object.keys(production.cmsTemplate).sort(),
    );
    expect(Object.keys(routedLocale).sort()).toEqual(
      Object.keys(production.cmsLocale).sort(),
    );
  });
});
