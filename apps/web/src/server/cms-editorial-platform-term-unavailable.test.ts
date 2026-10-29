import { describe, expect, it } from 'vitest';

import {
  WRITES,
  apiError,
  bindingWith,
  bodyOf,
  type Proxy,
  uuid2,
} from './cms-editorial-platform-hardening.test-support';

/**
 * BE03c "Receiving obligations from Slice 10 (DEC-141)" item 5: once Slice 12 registers the taxonomy authority, a
 * taxonomy value naming a term that is not assignable is 422 `term_unavailable` at the field pointer. The value-write
 * proxies keep that typed reason instead of scrubbing it, and a restore (which owns no value reasons) still drops it.
 */
describe('value writes relay the DEC-141 term_unavailable reason [P2-S12-AC-246]', () => {
  it('a value write keeps term_unavailable with its field pointer', async () => {
    const create = WRITES[0] as Proxy;
    const response = await create.call(
      bindingWith(async () =>
        apiError(422, 'VALIDATION_FAILED', {
          reasonCode: 'term_unavailable',
          violations: [{ path: `/fields/${uuid2}`, code: 'term_unavailable' }],
        }),
      ),
    );
    expect(response.status).toBe(422);
    expect((await bodyOf(response)).details).toMatchObject({
      reasonCode: 'term_unavailable',
      violations: [{ path: `/fields/${uuid2}`, code: 'term_unavailable' }],
    });
  });

  it('a restore, which owns no value reasons, still drops term_unavailable', async () => {
    const restore = WRITES[3] as Proxy;
    const response = await restore.call(
      bindingWith(async () =>
        apiError(422, 'VALIDATION_FAILED', { reasonCode: 'term_unavailable' }),
      ),
    );
    expect((await bodyOf(response)).details).toEqual({});
  });
});
