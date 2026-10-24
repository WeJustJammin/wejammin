import { describe, expect, it, vi } from 'vitest';

import { scanJobBody, sourceBody } from './linked-scan.test-support';
import { createLinkedScanProcessor } from './processor';

type Outcome = { outcome: 'ack' | 'retry'; delaySeconds?: number };

const build = (
  source: Outcome = { outcome: 'ack' },
  delegate: Outcome = { outcome: 'ack' },
) => {
  const order: string[] = [];
  const job = {
    process: vi.fn(
      async () => (order.push('job'), { outcome: 'ack' as const }),
    ),
  };
  const sourceConsumer = {
    process: vi.fn(async () => (order.push('source'), source)),
  };
  const next = {
    process: vi.fn(async () => (order.push('delegate'), delegate)),
  };
  const processor = createLinkedScanProcessor({
    job: job as never,
    source: sourceConsumer as never,
    delegate: next,
  });
  return { processor, job, sourceConsumer, next, order };
};

describe('[P2-S12-AC-212] the linked-update scan processor', () => {
  it('runs a scan job message in the job alone', async () => {
    const built = build();
    await expect(
      built.processor.process({ body: scanJobBody(), attempts: 1 }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(built.order).toEqual(['job']);
  });

  it('enqueues the scan for cms.pattern.activated.v1 first, then lets the next processor consume the same event', async () => {
    const built = build();
    await expect(
      built.processor.process({
        body: sourceBody('cms.pattern.activated.v1'),
        attempts: 1,
      }),
    ).resolves.toEqual({ outcome: 'ack' });
    expect(built.order).toEqual(['source', 'delegate']);
  });

  it("returns the next processor's outcome once the scan job is on the queue", async () => {
    const built = build(
      { outcome: 'ack' },
      { outcome: 'retry', delaySeconds: 60 },
    );
    await expect(
      built.processor.process({
        body: sourceBody('cms.pattern.activated.v1'),
        attempts: 2,
      }),
    ).resolves.toEqual({ outcome: 'retry', delaySeconds: 60 });
  });

  it('retries without touching the next processor when the scan job cannot be enqueued', async () => {
    const built = build({ outcome: 'retry', delaySeconds: 15 });
    await expect(
      built.processor.process({
        body: sourceBody('cms.pattern.activated.v1'),
        attempts: 1,
      }),
    ).resolves.toEqual({ outcome: 'retry', delaySeconds: 15 });
    expect(built.next.process).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a source event the scan does not consume',
      sourceBody('cms.template.activated.v1'),
    ],
    ['a schema activation', sourceBody('cms.schema.activated.v1')],
    [
      'a governed recheck job message',
      { jobType: 'cms.governed_review.recheck' },
    ],
    ['an editorial job message', { jobType: 'cms.review.dependency_recheck' }],
    ['a body no consumer recognises', { hello: 'world' }],
    ['a body that is not an object', 'scan'],
  ])('hands %s to the next processor alone', async (_name, body) => {
    const built = build();
    await built.processor.process({ body, attempts: 1 });
    expect(built.order).toEqual(['delegate']);
  });

  it('hands an unknown version of the family to both so each applies its own rule', async () => {
    const built = build();
    await built.processor.process({
      body: sourceBody('cms.pattern.activated.v1', {
        eventType: 'cms.pattern.activated.v2',
      }),
      attempts: 1,
    });
    expect(built.order).toEqual(['source', 'delegate']);
  });
});
