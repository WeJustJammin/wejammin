import { describe, expect, it, vi } from 'vitest';

import {
  createWorkerApp,
  type WorkerApp,
  type WorkerBindings,
  type WorkerDependencies,
} from './index';
import { createProductionWorkerAppRuntime } from './production-worker-runtime';

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-12-runtime',
  SUPABASE_SECRET_KEY: 'sb_secret_slice_12_runtime',
  SUPABASE_URL: 'https://supabase.example.test',
};

describe('production Worker runtime CMS composition', () => {
  it('injects a protected template dependency and serves the named route', async () => {
    let dependencies: WorkerDependencies | undefined;
    const app = createProductionWorkerAppRuntime(
      (value) => {
        dependencies = value;
        return createWorkerApp(value) as WorkerApp;
      },
      environment,
      vi.fn(async () => Response.json([])),
    );
    expect(dependencies?.cmsTemplate).toBeDefined();
    const response = await app.request(
      '/api/v1/cms/templates/versions',
      {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'bad',
      },
      environment,
    );
    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });

  it('injects the locale authoring dependency and mounts CMS-03C-04', async () => {
    let dependencies: WorkerDependencies | undefined;
    const app = createProductionWorkerAppRuntime(
      (value) => {
        dependencies = value;
        return createWorkerApp(value) as WorkerApp;
      },
      environment,
      vi.fn(async () => Response.json([])),
    );
    expect(dependencies?.cmsLocale).toBeDefined();
    const response = await app.request(
      '/api/v1/cms/entries/d2000000-0000-4000-8000-000000000001/locales/fr-FR/variants',
      {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'bad',
      },
      environment,
    );
    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });

  it('injects the taxonomy action boundary and mounts CMS-03C-03', async () => {
    let dependencies: WorkerDependencies | undefined;
    const app = createProductionWorkerAppRuntime(
      (value) => {
        dependencies = value;
        return createWorkerApp(value) as WorkerApp;
      },
      environment,
      vi.fn(async () => Response.json([])),
      undefined,
      undefined,
      undefined,
      undefined,
      { humanOrigins: ['https://cms.example.test'] },
    );
    expect(dependencies?.cmsTaxonomy).toBeDefined();
    const response = await app.request(
      '/api/v1/cms/taxonomies/d1200000-0000-4000-8000-000000000001/terms/actions',
      {
        method: 'POST',
        headers: {
          origin: 'https://cms.example.test',
          'content-type': 'text/plain',
        },
        body: 'bad',
      },
      environment,
    );
    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });

  it('injects the pattern instance adapter and mounts CMS-03C-02', async () => {
    let dependencies: WorkerDependencies | undefined;
    const app = createProductionWorkerAppRuntime(
      (value) => {
        dependencies = value;
        return createWorkerApp(value) as WorkerApp;
      },
      environment,
      vi.fn(async () => Response.json([])),
      undefined,
      undefined,
      undefined,
      undefined,
      { humanOrigins: ['https://cms.example.test'] },
    );
    expect(dependencies?.cmsPatternInstance).toBeDefined();
    const response = await app.request(
      '/api/v1/cms/compositions/pattern-instances',
      {
        method: 'POST',
        headers: {
          origin: 'https://cms.example.test',
          'content-type': 'text/plain',
        },
        body: 'bad',
      },
      environment,
    );
    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });
});
