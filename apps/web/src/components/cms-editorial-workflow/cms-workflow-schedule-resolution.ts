import {
  CMS_TZDB_VERSION,
  CmsScheduleLocalDateTimeSchema,
  type CmsEditorialRefusalDetails,
} from '@wejammin/contracts';
import type { TimeAuthority } from '@wejammin/contracts/time-authority';

/**
 * The schedule form's view of BE03b E8. The form runs the SAME pinned resolver
 * and tz snapshot as the Worker, so the instant it shows and sends is the one the
 * server re-derives (the server stays authoritative). The resolver compares a
 * given `resolvedUtc`; the form does not have one yet, so it asks with a probe
 * instant and reads the instant the resolver states it expected.
 */
export type Disambiguation = 'none' | 'earlier' | 'later';

type Authority = Pick<TimeAuthority, 'resolveSchedule'>;

export interface ScheduleInput {
  readonly localDateTime: string;
  readonly timezone: string;
  readonly disambiguation: Disambiguation;
}

type Gap = Extract<
  CmsEditorialRefusalDetails,
  { reasonCode: 'nonexistent_local_time' }
>['alternatives'];
type Fold = Extract<
  CmsEditorialRefusalDetails,
  { reasonCode: 'ambiguous_local_time' }
>['alternatives'];

export type ScheduleResolution =
  | { readonly kind: 'empty' }
  | {
      readonly kind: 'resolved';
      readonly resolvedUtc: string;
      readonly offsetSeconds: number;
      readonly disambiguation: Disambiguation;
      /** Set when the local time happens twice, so the choice can be changed. */
      readonly fold?: Fold;
    }
  | { readonly kind: 'gap'; readonly alternatives: Gap }
  | { readonly kind: 'fold'; readonly alternatives: Fold }
  | {
      readonly kind: 'refused';
      readonly reason: CmsEditorialRefusalDetails['reasonCode'];
      readonly window?: { readonly minUtc: string; readonly maxUtc: string };
    };

/** Never a schedulable instant: the answer to it always names the expected one. */
const PROBE_UTC = '1970-01-01T00:00:00Z';

const refused = (details: CmsEditorialRefusalDetails): ScheduleResolution =>
  details.reasonCode === 'schedule_out_of_horizon'
    ? {
        kind: 'refused',
        reason: details.reasonCode,
        window: { minUtc: details.minUtc, maxUtc: details.maxUtc },
      }
    : { kind: 'refused', reason: details.reasonCode };

export const resolveScheduleInput = (
  authority: Authority,
  input: ScheduleInput,
  nowMs: number,
): ScheduleResolution => {
  if (
    input.timezone === '' ||
    !CmsScheduleLocalDateTimeSchema.safeParse(input.localDateTime).success
  )
    return { kind: 'empty' };
  const ask = (resolvedUtc: string, disambiguation: Disambiguation) =>
    authority.resolveSchedule(
      {
        localDateTime: input.localDateTime,
        timezone: input.timezone,
        tzdbVersion: CMS_TZDB_VERSION,
        resolvedUtc,
        disambiguation,
      },
      nowMs,
    );
  const probed = ask(PROBE_UTC, input.disambiguation);
  /* v8 ignore next -- the probe is never a schedulable instant, so it never resolves */
  if (probed.ok) return { kind: 'empty' };
  const { details } = probed;
  switch (details.reasonCode) {
    case 'nonexistent_local_time':
      return { kind: 'gap', alternatives: details.alternatives };
    case 'ambiguous_local_time':
      return { kind: 'fold', alternatives: details.alternatives };
    case 'disambiguation_not_applicable':
      // An earlier/later choice made for a different time no longer applies.
      return resolveScheduleInput(
        authority,
        { ...input, disambiguation: 'none' },
        nowMs,
      );
    case 'resolved_utc_mismatch': {
      const confirmed = ask(details.expectedUtc, input.disambiguation);
      if (!confirmed.ok) return refused(confirmed.details);
      // A chosen earlier/later means the time happens twice: keep both on offer.
      const twice =
        confirmed.disambiguation === 'none' ? null : ask(PROBE_UTC, 'none');
      return {
        kind: 'resolved',
        resolvedUtc: confirmed.resolvedUtc,
        offsetSeconds: confirmed.offsetSeconds,
        disambiguation: confirmed.disambiguation,
        ...(twice !== null &&
        !twice.ok &&
        twice.details.reasonCode === 'ambiguous_local_time'
          ? { fold: twice.details.alternatives }
          : {}),
      };
    }
    default:
      return refused(details);
  }
};

/** `UTC+05:30`, `UTC-05:00`: the offset in force at the resolved instant. */
export const offsetLabel = (offsetSeconds: number): string => {
  const sign = offsetSeconds < 0 ? '-' : '+';
  const minutes = Math.abs(offsetSeconds) / 60;
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `UTC${sign}${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
};

/** The zone names of the snapshot for the form's suggestion list, sorted. */
export const zoneSuggestions = (
  authority: Pick<TimeAuthority, 'zoneNames'>,
): readonly string[] => [...authority.zoneNames()].sort();
