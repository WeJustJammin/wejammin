/**
 * The identifier scan of the Slice 12 journeys, extended past the browser (P2-S12-AC-273: "no diff value, canonical id or
 * person id in the URL, storage, logs or telemetry"; FE03 line 895 names the decision reasons, the policy basis, the pattern
 * diff values, the canonical ids and every assignment identifier).
 *
 * Browser side: `s12-pw5-trace.ts` (every URL, request, navigation and console line; local and session storage). This module
 * adds IndexedDB database names to that, and the SERVER side:
 *
 *  - `platform_private.outbox_events`: the telemetry-shaped events the commands committed (payload, dead-letter reason);
 *  - `audit_private.audit_events`: the audit rows the commands committed;
 *  - the SERVER LOGS the launcher captured (`server-log-capture.ts`): the API Worker's stdout and stderr (the production
 *    logger's structured lines, the route telemetry the production boundaries log through it, every other `console` line
 *    and wrangler's request and error lines), the web server's wrangler output, and the launcher's own lines.
 *
 * Telemetry emitters of these journeys and where each lands: the production logger and the boundaries' `telemetry`
 * callbacks (which only call that logger) go to the API log; wrangler request lines go to both server logs; the outbox is
 * scanned above; the Worker's `captureException` is the production runtime's own no-op and the web code paths call no
 * beacon, tracing or analytics client, so those two have no sink to read (README, "Server log capture"). Not type-checked by
 * `pnpm type-check`.
 */
import { fileURLToPath } from 'node:url';

import { expect, type Page } from '@playwright/test';

import { psql } from '../../postgrest/support/stack';
import {
  logFilesHolding,
  readServerLogsSettled,
  resolveServerLogDirectory,
  type CapturedLog,
} from './server-log-capture';
import { expectNothingIdentifying, type Trace } from './s12-pw5-trace';

export type Forbidden = Readonly<{
  /** Person and auth-user ids: allowed in request bodies (an assignment names its reviewer), never in a URL, storage, console or event. */
  persons: readonly string[];
  /** Diff values, decision reasons and other run-unique text: in no URL, storage, console, event, audit row or server log. */
  values: readonly string[];
  /** Canonical-domain ids (FE03 line 895): treated as values. */
  canonicalIds?: readonly string[];
  /** Policy basis text (FE03 line 895): treated as values. */
  policyBasis?: readonly string[];
}>;

/** Everything that may appear in no URL, storage, console, event, audit row or server log. */
export const valuesOf = (forbidden: Forbidden): string[] => [
  ...forbidden.values,
  ...(forbidden.canonicalIds ?? []),
  ...(forbidden.policyBasis ?? []),
];

/** The project root, from this file's place in `tests/e2e/support/`. */
const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));

/** The captured server logs by file name that hold `needle`; empty means it did not leak. */
export const serverLogHits = (
  needle: string,
  logs: readonly CapturedLog[],
): string[] => logFilesHolding(needle, logs);

/** The launcher's captured logs, read once they stop growing; throws (fail closed) when no capture is running. */
export const readCapturedServerLogs = (): Promise<CapturedLog[]> =>
  readServerLogsSettled(resolveServerLogDirectory(projectRoot));

const quote = (value: string): string => `'${value.replaceAll("'", "''")}'`;

const indexedDatabaseNames = (page: Page): Promise<string> =>
  page.evaluate(async () => {
    const databases = await window.indexedDB.databases();
    return databases.map((database) => database.name ?? '').join('\n');
  });

/**
 * The rows of the server-side sinks that hold `needle` verbatim. `position` is an exact substring test (no LIKE wildcards).
 * The audit rows legitimately carry the actor id, so a person id is looked for in the events only.
 */
export const sinkHits = (
  needle: string,
  sinks: 'events' | 'events-and-audit',
): string[] => {
  const hits: string[] = [];
  // `cms.capability.grant.changed.v1` names its subject person by design (`subjectPersonId`, CMS-03A-15 to -17): the
  // owner's reviewer grants of the journey cast commit it, so a person-id scan skips that one event type.
  const events = Number(
    psql(
      `select count(*) from platform_private.outbox_events
        where event_type <> 'cms.capability.grant.changed.v1'
          and (position(${quote(needle)} in payload::text) > 0
            or position(${quote(needle)} in coalesce(dead_letter_reason, '')) > 0
            or position(${quote(needle)} in coalesce(last_dispatch_error_code, '')) > 0)`,
    ),
  );
  if (events > 0) hits.push(`outbox_events x${String(events)}`);
  if (sinks === 'events-and-audit') {
    const audit = Number(
      psql(
        `select count(*) from audit_private.audit_events audit_row
          where position(${quote(needle)} in pg_catalog.to_jsonb(audit_row)::text) > 0`,
      ),
    );
    if (audit > 0) hits.push(`audit_events x${String(audit)}`);
  }
  return hits;
};

/** The browser scan (URLs, console, storage, IndexedDB names) and the server-side scan, for one journey. */
export const expectNothingLeaked = async (
  gathered: Trace,
  pages: readonly Page[],
  forbidden: Forbidden,
): Promise<void> => {
  const values = valuesOf(forbidden);
  await expectNothingIdentifying(gathered, pages, [
    ...forbidden.persons,
    ...values,
  ]);
  const databases = (await Promise.all(pages.map(indexedDatabaseNames))).join(
    '\n',
  );
  for (const needle of [...forbidden.persons, ...values])
    expect(
      databases,
      `IndexedDB must not hold ${needle.slice(0, 12)}…`,
    ).not.toContain(needle);
  for (const needle of forbidden.persons)
    expect(
      sinkHits(needle, 'events'),
      `server events must not hold ${needle.slice(0, 12)}…`,
    ).toEqual([]);
  for (const needle of values)
    expect(
      sinkHits(needle, 'events-and-audit'),
      `server events and audit rows must not hold ${needle.slice(0, 12)}…`,
    ).toEqual([]);
  // The server logs: read last, after every journey step has run, and only once they stop growing.
  const logs = await readCapturedServerLogs();
  for (const needle of [...forbidden.persons, ...values])
    expect(
      serverLogHits(needle, logs),
      `server logs must not hold ${needle.slice(0, 12)}…`,
    ).toEqual([]);
};
