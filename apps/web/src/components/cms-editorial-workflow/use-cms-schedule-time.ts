import type { TimeAuthority } from '@wejammin/contracts/time-authority';
import * as React from 'react';

/**
 * The pinned tz snapshot is 218 KB (about 26 KB gzip). It is imported only when
 * the schedule form is opened, behind a dynamic import, so it travels in its
 * own lazy chunk and no other page pays for it (FE03, bundle budget). The
 * authority verifies the snapshot's SHA-256 before it answers.
 */
export const loadTimeAuthority = async (): Promise<TimeAuthority> =>
  (
    await import('@wejammin/contracts/time-authority')
  ).loadPinnedTimeAuthority();

export type TimeAuthorityStatus = 'idle' | 'loading' | 'ready' | 'failed';

export interface ScheduleTime {
  readonly status: TimeAuthorityStatus;
  readonly authority: TimeAuthority | null;
}

export const useTimeAuthority = (
  active: boolean,
  load: () => Promise<TimeAuthority> = loadTimeAuthority,
): ScheduleTime => {
  const [time, setTime] = React.useState<ScheduleTime>({
    status: 'idle',
    authority: null,
  });
  const started = React.useRef(false);
  React.useEffect(() => {
    if (!active || started.current) return;
    started.current = true;
    setTime({ status: 'loading', authority: null });
    load().then(
      (authority) => setTime({ status: 'ready', authority }),
      () => setTime({ status: 'failed', authority: null }),
    );
  }, [active, load]);
  return time;
};
