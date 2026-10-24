// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { rateLimitMessage } from '../../lib/safe-read-retry';
import { setup } from './cms-editorial-conflict-controller.test-support';
import {
  BLURB,
  TITLE,
  apiError,
} from './cms-editorial-editor-fixtures.test-support';

/**
 * FE03 "Network and retry contract" (:1172): a 429 waits for `Retry-After`, announces the
 * remaining wait and preserves input. Here the 429 answers the conflict form's re-read
 * (CMS-03B-12) after a 409 on the resolution.
 */
describe('a 429 on the conflict re-read after a 409', () => {
  it('announces the remaining wait and keeps every choice', async () => {
    const { controller, calls } = setup([
      apiError(409, 'CONFLICT', { conflict: 'VERSION_MISMATCH' }),
      apiError(
        429,
        'RATE_LIMITED',
        { retryAfterSeconds: 9 },
        { 'retry-after': '9' },
      ),
    ]);
    controller.choose(TITLE, 'yours');
    controller.choose(BLURB, 'theirs');
    await controller.submit();
    expect(calls).toHaveLength(2);
    const state = controller.getState();
    expect(state.phase).toBe('idle');
    expect(state.alert).toBe(true);
    expect(state.retryAfterSeconds).toBe(9);
    expect(state.message).toBe(rateLimitMessage(9));
    expect(state.choices[TITLE]?.choice).toBe('yours');
    expect(state.choices[BLURB]?.choice).toBe('theirs');
  });

  it('without a stated delay asks for a moment and still keeps the choices', async () => {
    const { controller } = setup([
      apiError(409, 'CONFLICT', { conflict: 'VERSION_MISMATCH' }),
      apiError(429, 'RATE_LIMITED'),
    ]);
    controller.choose(TITLE, 'yours');
    controller.choose(BLURB, 'theirs');
    await controller.submit();
    expect(controller.getState().message).toBe(rateLimitMessage(null));
    expect(controller.getState().choices[TITLE]?.choice).toBe('yours');
  });

  it('keeps the plain copy for a re-read that failed otherwise', async () => {
    const { controller } = setup([
      apiError(409, 'CONFLICT', { conflict: 'VERSION_MISMATCH' }),
      apiError(503, 'DEPENDENCY_UNAVAILABLE'),
    ]);
    controller.choose(TITLE, 'yours');
    controller.choose(BLURB, 'theirs');
    await controller.submit();
    expect(controller.getState().message).not.toContain('Too many requests');
    expect(controller.getState().retryAfterSeconds).toBeNull();
  });
});
