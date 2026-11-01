import { describe, expect, it } from 'vitest';

import {
  error,
  json,
  resource,
  send,
  throughProxy,
} from './related-content-submit.test-support';

describe('composed with the real same-origin proxy', () => {
  const through = throughProxy;
  const worker422 = () =>
    error(422, {
      reasonCode: 'related_target_ineligible',
      violations: [
        { path: '/pins/0', code: 'related_target_ineligible', message: 'x' },
      ],
    });

  it('saves through the proxy that verified the strict resource', async () => {
    const result = await send(
      through(() => json(201, resource(), { etag: '"5"' })),
    );
    expect(result.kind).toBe('saved');
  });

  it('reads the proxy 409 and 403 as the form expects', async () => {
    expect(
      (await send(through(() => error(409, { currentVersion: '9' })))).kind,
    ).toBe('conflict');
    expect(
      await send(
        through(() => error(403, { reasonCode: 'capability_missing' })),
      ),
    ).toMatchObject({ kind: 'refused', status: 403 });
  });

  // Test correction (fix pass 1): this test used to pin the proxy dropping the typed 422 (`{ kind:
  // 'rejected', status: 422 }`). BE03c 385-387 and 1417 require the uniform `related_target_ineligible` at
  // `/pins/{n}` or `/exclusions/{n}`, so the real relay must reach the form (the contract's
  // CmsCompositionRefusalDetailsSchema lists `related_target_ineligible` and `derived_rule_unknown`).
  it('reads the proxy 422 related_target_ineligible with the rows its pointers name', async () => {
    expect(await send(through(worker422))).toEqual({
      kind: 'refused',
      status: 422,
      reason: 'related_target_ineligible',
      rows: [{ list: 'pins', index: 0 }],
    });
  });

  it('reads the proxy 422 pointers into both lists, once each', async () => {
    const result = await send(
      through(() =>
        error(422, {
          reasonCode: 'related_target_ineligible',
          violations: [
            { path: '/exclusions/0', code: 'related_target_ineligible' },
            { path: '/pins/0', code: 'related_target_ineligible' },
            { path: '/pins/0', code: 'related_target_ineligible' },
          ],
        }),
      ),
    );
    expect(result).toEqual({
      kind: 'refused',
      status: 422,
      reason: 'related_target_ineligible',
      rows: [
        { list: 'exclusions', index: 0 },
        { list: 'pins', index: 0 },
      ],
    });
  });

  it('reads the proxy 422 derived_rule_unknown, which names no list row', async () => {
    expect(
      await send(
        through(() =>
          error(422, {
            reasonCode: 'derived_rule_unknown',
            violations: [
              { path: '/derivedRule/key', code: 'derived_rule_unknown' },
            ],
          }),
        ),
      ),
    ).toEqual({
      kind: 'refused',
      status: 422,
      reason: 'derived_rule_unknown',
      rows: [],
    });
  });

  it('reads a 422 with a token this operation does not publish as a plain rejection', async () => {
    expect(
      await send(
        through(() =>
          error(422, {
            reasonCode: 'pattern_cycle',
            violations: [{ path: '/pins/0', code: 'x' }],
          }),
        ),
      ),
    ).toEqual({ kind: 'rejected', status: 422 });
  });

  it('keeps the key on a 201 the proxy cannot verify: the unknown-outcome marker', async () => {
    expect(
      (await send(through(() => json(201, resource(), { etag: '"9"' })))).kind,
    ).toBe('uncertain');
  });
});
