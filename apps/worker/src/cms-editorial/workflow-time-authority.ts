import {
  loadPinnedTimeAuthority,
  type TimeAuthority,
} from '@wejammin/contracts/time-authority';

import type { CmsEditorialDependencies, CmsEditorialError } from './types';

/**
 * The Worker side of BE03b E8. The committed tz snapshot is hash-verified when
 * this module loads; a corrupted or swapped asset yields no authority, and every
 * schedule command is then answered 503 `DEPENDENCY_UNAVAILABLE`. The snapshot
 * is a build asset: tz data is never fetched at runtime.
 */
const pinnedAtLoad: Promise<TimeAuthority | null> =
  loadPinnedTimeAuthority().then(
    (authority) => authority,
    () => null,
  );

export const timeAuthorityOf = (
  dependencies: Pick<CmsEditorialDependencies, 'timeAuthority'>,
): Promise<TimeAuthority | null> =>
  dependencies.timeAuthority === undefined
    ? pinnedAtLoad
    : dependencies.timeAuthority();

/** The 422 a time-authority refusal publishes: token, members and the pointer. */
export const timeRefusal = (
  refusal: Readonly<{
    pointer: string;
    details: Readonly<Record<string, unknown>>;
  }>,
): CmsEditorialError => ({
  ok: false,
  status: 422,
  code: 'VALIDATION_FAILED',
  message: 'The publication schedule time is invalid.',
  details: {
    ...refusal.details,
    violations: [
      {
        path: refusal.pointer,
        code: refusal.details.reasonCode,
        message: 'The value is invalid.',
      },
    ],
  },
});
