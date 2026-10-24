import { describe, expect, it, vi } from 'vitest';

import { governedJobBody, sourceBody } from './governed-recheck.test-support';
import { createGovernedRecheckProcessor } from './processor';

type Outcome = { outcome: 'ack' | 'retry'; delaySeconds?: number };

const build = (
  governed: Outcome = { outcome: 'ack' },
  delegate: Outcome = { outcome: 'ack' },
) => {
  const order: string[] = [];
  const job = { process: vi.fn(async () => (order.push('job'), governed)) };
  const sourceProcess = (name: string) =>
    vi.fn(async () => (order.push(name), governed));
  const sources = {
    'cms.block.lifecycle.changed.v1': {
      process: sourceProcess('source:block'),
    },
    'cms.schema.activated.v1': { process: sourceProcess('source:schema') },
    'cms.pattern.activated.v1': { process: sourceProcess('source:pattern') },
  };
  const editorial = {
    process: vi.fn(async () => (order.push('editorial'), delegate)),
  };
  const processor = createGovernedRecheckProcessor({
    job: job as never,
    sources: sources as never,
    delegate: editorial,
  });
  return { processor, job, sources, editorial, order };
};

describe('[P2-S12-AC-202] the governed recheck processor', () => {
  it('runs a governed job message in the job alone', async () => {
    const built = build();
    await expect(
      built.processor.process({ body: governedJobBody(), attempts: 1 }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(built.order).toEqual(['job']);
  });

  it.each([
    ['cms.block.lifecycle.changed.v1', 'source:block'],
    ['cms.schema.activated.v1', 'source:schema'],
    ['cms.pattern.activated.v1', 'source:pattern'],
  ] as const)(
    'enqueues the governed job for %s first, then lets the editorial recheck consume the same event',
    async (eventType, source) => {
      const built = build();
      await expect(
        built.processor.process({ body: sourceBody(eventType), attempts: 1 }),
      ).resolves.toEqual({ outcome: 'ack' });
      expect(built.order).toEqual([source, 'editorial']);
    },
  );

  it('returns the editorial outcome once the governed job is on the queue', async () => {
    const built = build(
      { outcome: 'ack' },
      { outcome: 'retry', delaySeconds: 60 },
    );
    await expect(
      built.processor.process({
        body: sourceBody('cms.schema.activated.v1'),
        attempts: 2,
      }),
    ).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 60,
    });
  });

  it('retries without touching the editorial recheck when the governed job cannot be enqueued', async () => {
    const built = build({ outcome: 'retry', delaySeconds: 15 });
    await expect(
      built.processor.process({
        body: sourceBody('cms.pattern.activated.v1'),
        attempts: 1,
      }),
    ).resolves.toEqual({
      outcome: 'retry',
      delaySeconds: 15,
    });
    expect(built.editorial.process).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a source event the governed recheck does not consume',
      sourceBody('cms.template.activated.v1'),
    ],
    ['a source event of another family', sourceBody('cms.taxonomy.changed.v1')],
    ['an editorial job message', { jobType: 'cms.review.dependency_recheck' }],
    ['a body no consumer recognises', { hello: 'world' }],
  ])('hands %s to the editorial recheck alone', async (_name, body) => {
    const built = build();
    await built.processor.process({ body, attempts: 1 });
    expect(built.order).toEqual(['editorial']);
  });

  it('hands an unknown version of an owned family to both so each applies its own rule', async () => {
    const built = build();
    await built.processor.process({
      body: sourceBody('cms.schema.activated.v1', {
        eventType: 'cms.schema.activated.v2',
      }),
      attempts: 1,
    });
    expect(built.order).toEqual(['source:schema', 'editorial']);
  });
});
