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

describe('production Worker runtime CMS-03C-05 related-content', () => {
  it('injects the related-content boundary and mounts the named route', async () => {
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
    expect(dependencies?.cmsRelatedContent).toBeDefined();
    const response = await app.request(
      '/api/v1/cms/entries/10000000-0000-4000-8000-000000000001/related-content',
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
