import * as React from 'react';
import { GrantableCmsCapabilitySchema } from '@wejammin/contracts';

import {
  readGrantList,
  runGrantCommand,
  type GrantListReadResult,
} from './cms-capability-grant-client';
import {
  COMMAND_COPY,
  stateForResult,
  type GrantCommandKind,
  type GrantCommandState,
} from './cms-capability-grant-commands';
import {
  consumeStepUpDetour,
  navigateTo,
  recordConsoleUrl,
  signInHref,
} from './cms-capability-grant-navigation';
import {
  CMS_CAPABILITY_GRANT_DEFAULT_QUERY,
  cmsCapabilityGrantConsoleUrl,
} from './cms-capability-grant-url';
import type {
  CmsCapabilityGrantConsoleProps,
  CmsCapabilityGrantListPage,
  CmsCapabilityGrantListState,
  CmsCapabilityGrantQueryState,
  CmsCapabilityGrantResource,
} from './cms-capability-grant-types';

export const OPERATION_FOR_KIND: Readonly<Record<GrantCommandKind, string>> = {
  grant: 'CMS-03A-15',
  renew: 'CMS-03A-16',
  revoke: 'CMS-03A-17',
};

const PROXY = '/api/v1/cms/capability-grants';
const LIST_LOADING_DELAY_MS = 250;

const actionFor = (kind: GrantCommandKind, grantId: string | null): string =>
  kind === 'grant'
    ? PROXY
    : `${PROXY}/${encodeURIComponent(grantId ?? '')}/${kind === 'renew' ? 'renewals' : 'revocations'}`;

/** Fold a list read into the list state, keeping the last verified page. */
const listStateFor = (
  read: GrantListReadResult,
  previous: CmsCapabilityGrantListState,
  query: CmsCapabilityGrantQueryState,
  person: string,
  requestId: string,
): CmsCapabilityGrantListState => {
  const held: CmsCapabilityGrantListPage | null =
    previous.status === 'success' || previous.status === 'degraded'
      ? previous.data
      : null;
  if (read.kind === 'ok')
    return read.page.items.length === 0
      ? {
          status: 'empty',
          reason:
            query.capability !== undefined ||
            query.state !== undefined ||
            person.trim() !== ''
              ? 'filter-miss'
              : 'no-records',
        }
      : { status: 'success', data: read.page, version: '1', stale: false };
  if (read.kind === 'forbidden')
    return { status: 'disabled', reason: COMMAND_COPY.owner };
  const retryable =
    read.kind === 'error' ? read.retryable : read.kind === 'degraded';
  const retryAfterSeconds =
    read.kind === 'error' ? read.retryAfterSeconds : null;
  return {
    status: 'degraded',
    data: held,
    requestId,
    lastVerifiedAt: held === null ? null : new Date().toISOString(),
    retryable,
    retryAfterSeconds,
  };
};

export interface GrantRowTarget {
  readonly grantId: string;
  readonly kind: 'renew' | 'revoke';
}

export interface GrantPrefill {
  readonly subjectPersonId: string;
  readonly capability: string;
  readonly nonce: number;
}

/** State and commands of the owner grant console; the server stays authoritative. */
export const useCmsCapabilityGrants = (
  props: CmsCapabilityGrantConsoleProps,
) => {
  const [list, setList] = React.useState(props.initialList);
  const [query, setQuery] = React.useState(props.query);
  const [person, setPerson] = React.useState('');
  const [result, setResult] = React.useState<{
    readonly kind: GrantCommandKind;
    readonly state: GrantCommandState;
    readonly sequence: number;
  } | null>(null);
  const [pending, setPending] = React.useState<GrantCommandKind | null>(null);
  const [openRow, setOpenRow] = React.useState<GrantRowTarget | null>(null);
  const [prefill, setPrefill] = React.useState<GrantPrefill | null>(null);
  const [epoch, setEpoch] = React.useState(0);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [listLoading, setListLoading] = React.useState(false);
  const busy = React.useRef(false);
  const attempted = React.useRef('');

  React.useEffect(() => {
    if (consumeStepUpDetour()) setNotice(COMMAND_COPY.entriesNotSaved);
  }, []);

  // FE03 URL state: an invalid address was normalized by the server, so the
  // address bar is replaced (never pushed) with the validated query.
  const initialQuery = React.useRef(props.query);
  React.useEffect(() => {
    const canonical = cmsCapabilityGrantConsoleUrl(initialQuery.current);
    if (`${window.location.pathname}${window.location.search}` !== canonical)
      recordConsoleUrl(canonical, 'replace');
  }, []);

  const refetch = React.useCallback(
    async (nextQuery = query, nextPerson = person): Promise<void> => {
      // FE03 loading: the skeleton appears only after 250 ms; the last
      // verified rows stay visible beneath it.
      const skeleton = window.setTimeout(
        () => setListLoading(true),
        LIST_LOADING_DELAY_MS,
      );
      const read = await readGrantList({
        query: nextQuery,
        subjectPersonId: nextPerson,
      }).finally(() => {
        window.clearTimeout(skeleton);
        setListLoading(false);
      });
      if (read.kind === 'unauthenticated') {
        navigateTo(signInHref(cmsCapabilityGrantConsoleUrl(nextQuery)));
        return;
      }
      setList((previous) =>
        listStateFor(read, previous, nextQuery, nextPerson, props.requestId),
      );
    },
    [query, person, props.requestId],
  );

  const applyQuery = React.useCallback(
    (next: CmsCapabilityGrantQueryState, mode: 'push' | 'replace'): void => {
      setQuery(next);
      recordConsoleUrl(cmsCapabilityGrantConsoleUrl(next), mode);
      void refetch(next, person);
    },
    [person, refetch],
  );

  const applyPerson = React.useCallback(
    (value: string): void => {
      setPerson(value);
      void refetch({ ...query, cursor: undefined }, value);
    },
    [query, refetch],
  );

  const command = React.useCallback(
    async (
      kind: GrantCommandKind,
      form: HTMLFormElement,
      grantId: string | null,
    ): Promise<void> => {
      if (busy.current) return;
      busy.current = true;
      const submitted = new FormData(form);
      if (kind === 'grant')
        attempted.current = String(submitted.get('capability') ?? '');
      setPending(kind);
      setNotice(null);
      const outcome = await runGrantCommand({
        action: actionFor(kind, grantId),
        operationId: OPERATION_FOR_KIND[kind],
        formData: submitted,
      });
      const state = stateForResult(kind, outcome, props.termWindow);
      busy.current = false;
      setPending(null);
      setResult((previous) => ({
        kind,
        state,
        sequence: (previous?.sequence ?? 0) + 1,
      }));
      if (state.status === 'success') {
        setOpenRow(null);
        setPrefill(null);
        setEpoch((value) => value + 1);
      }
      if (state.status === 'failure' && state.action === 'sign-in')
        navigateTo(signInHref(cmsCapabilityGrantConsoleUrl(query)));
      if (
        state.status === 'success' ||
        (state.status === 'failure' && state.refetch)
      )
        await refetch();
    },
    [props.termWindow, query, refetch],
  );

  const sortBy = (sort: 'validThrough' | 'updatedAt'): void =>
    applyQuery(
      {
        ...query,
        cursor: undefined,
        sort,
        direction:
          query.sort === sort && query.direction === 'asc' ? 'desc' : 'asc',
      },
      'push',
    );
  const nextPage = (): void => {
    if (list.status !== 'success' || list.data.nextCursor === null) return;
    applyQuery({ ...query, cursor: list.data.nextCursor }, 'push');
  };
  const resetFilters = (): void => {
    setPerson('');
    setQuery(CMS_CAPABILITY_GRANT_DEFAULT_QUERY);
    recordConsoleUrl(
      cmsCapabilityGrantConsoleUrl(CMS_CAPABILITY_GRANT_DEFAULT_QUERY),
      'push',
    );
    void refetch(CMS_CAPABILITY_GRANT_DEFAULT_QUERY, '');
  };
  /** The 409 helper: filter the list to the capability just attempted. */
  const showAttemptedCapability = (): void => {
    const parsed = GrantableCmsCapabilitySchema.safeParse(attempted.current);
    if (parsed.success)
      applyQuery(
        { ...query, cursor: undefined, capability: parsed.data },
        'push',
      );
  };
  /** Prefill the grant form from a revoked row already held in memory. */
  const grantAgain = (grant: CmsCapabilityGrantResource): void =>
    setPrefill((previous) => ({
      subjectPersonId: grant.subjectPersonId,
      capability: grant.capability,
      nonce: (previous?.nonce ?? 0) + 1,
    }));

  return {
    sortBy,
    nextPage,
    resetFilters,
    showAttemptedCapability,
    grantAgain,
    list,
    query,
    person,
    result,
    pending,
    openRow,
    prefill,
    epoch,
    notice,
    listLoading,
    setOpenRow,
    setPrefill,
    setResult,
    refetch,
    applyQuery,
    applyPerson,
    command,
  };
};
