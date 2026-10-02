import { describe, expect, it, vi } from 'vitest';

import {
  parseContentSchemaRegistryStepUpHeaders,
  resolveContentSchemaRegistryActingContextLabel,
} from './content-schema-registry-acting-context';
import { CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER } from '@wejammin/contracts';

const PARTY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const OTHER_PARTY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const CONTEXT_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const STEP_UP_HEADER = CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER;
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const FRESH_UNTIL = '2026-10-01T12:30:00.000Z';

const contextItem = (overrides: Record<string, unknown> = {}) => ({
  contextId: CONTEXT_ID,
  partyId: PARTY_ID,
  kind: 'organization',
  label: 'Northwind Collective',
  avatarRef: null,
  selectable: true,
  authorityFreshUntil: FRESH_UNTIL,
  ...overrides,
});

const listResponse = (items: readonly unknown[] = [contextItem()]) =>
  Response.json({
    projectionVersion: '1',
    items,
    nextCursor: null,
    hasMore: false,
  });

const read = (response: Response) => vi.fn(async () => response);

describe('content schema registry acting-context label resolution', () => {
  it('resolves the human label for the server-selected acting party', async () => {
    const fetchActingContexts = read(listResponse());
    await expect(
      resolveContentSchemaRegistryActingContextLabel({
        actingPartyId: PARTY_ID,
        fetchActingContexts,
        now: NOW,
      }),
    ).resolves.toBe('Northwind Collective');
    expect(fetchActingContexts).toHaveBeenCalledOnce();
  });

  it('never returns a raw identifier and fails closed to null when unresolved', async () => {
    const unresolved: readonly (readonly [string, Response])[] = [
      [OTHER_PARTY_ID, listResponse()],
      [PARTY_ID, listResponse([contextItem({ partyId: OTHER_PARTY_ID })])],
      [PARTY_ID, listResponse([])],
      [PARTY_ID, new Response('nope', { status: 503 })],
      [PARTY_ID, Response.json({ items: 'not-an-array' })],
      [PARTY_ID, listResponse([contextItem({ label: '' })])],
      [PARTY_ID, listResponse([contextItem({ label: PARTY_ID })])],
      [PARTY_ID, listResponse([contextItem({ label: '  ' })])],
      [PARTY_ID, listResponse([contextItem({ selectable: false })])],
      [
        PARTY_ID,
        listResponse([
          contextItem({ authorityFreshUntil: '2026-10-01T11:59:59.999Z' }),
        ]),
      ],
      [
        PARTY_ID,
        listResponse([contextItem(), contextItem({ label: 'Duplicate row' })]),
      ],
      [PARTY_ID, listResponse([contextItem({ label: 'Control\u0007chars' })])],
      [PARTY_ID, listResponse([contextItem({ label: 'x'.repeat(121) })])],
    ];
    for (const [actingPartyId, response] of unresolved) {
      const label = await resolveContentSchemaRegistryActingContextLabel({
        actingPartyId,
        fetchActingContexts: read(response),
        now: NOW,
      });
      expect(label).toBeNull();
    }
  });

  it('fails closed on a non-finite server clock and padded authority instants', async () => {
    await expect(
      resolveContentSchemaRegistryActingContextLabel({
        actingPartyId: PARTY_ID,
        fetchActingContexts: read(listResponse()),
        now: Number.NaN,
      }),
    ).resolves.toBeNull();
    await expect(
      resolveContentSchemaRegistryActingContextLabel({
        actingPartyId: PARTY_ID,
        fetchActingContexts: read(
          listResponse([
            contextItem({ authorityFreshUntil: ' 2026-10-01T12:30:00.000Z ' }),
          ]),
        ),
        now: NOW,
      }),
    ).resolves.toBeNull();
  });

  it('rejects a response object that is not a real Response', async () => {
    await expect(
      resolveContentSchemaRegistryActingContextLabel({
        actingPartyId: PARTY_ID,
        fetchActingContexts: vi.fn(async () => ({}) as Response),
        now: NOW,
      }),
    ).resolves.toBeNull();
  });

  it('rejects an unsafe acting-party selector before any read', async () => {
    for (const actingPartyId of [
      null,
      '',
      'not-a-uuid',
      PARTY_ID.toUpperCase(),
      ` ${PARTY_ID}`,
    ] as const) {
      const fetchActingContexts = read(listResponse());
      await expect(
        resolveContentSchemaRegistryActingContextLabel({
          actingPartyId,
          fetchActingContexts,
        }),
      ).resolves.toBeNull();
      expect(fetchActingContexts).not.toHaveBeenCalled();
    }
  });

  it('fails closed when the acting-contexts read throws', async () => {
    await expect(
      resolveContentSchemaRegistryActingContextLabel({
        actingPartyId: PARTY_ID,
        fetchActingContexts: vi.fn(async () => {
          throw new Error('dependency unavailable');
        }),
      }),
    ).resolves.toBeNull();
  });
});

describe('content schema registry step-up freshness display state', () => {
  const NOW = Date.parse('2026-10-01T12:00:00.000Z');

  const headersOf = (entries: Record<string, string>) => {
    const headers = new Headers();
    for (const [name, value] of Object.entries(entries))
      headers.set(name, value);
    return headers;
  };

  it('derives verified freshness only from a valid recent expiry', () => {
    expect(
      parseContentSchemaRegistryStepUpHeaders(
        headersOf({ [STEP_UP_HEADER]: '2026-10-01T12:05:00.000Z' }),
        NOW,
      ),
    ).toBe('verified');
  });

  it('fails closed to required for absent, malformed, or out-of-window evidence', () => {
    const cases: readonly Record<string, string>[] = [
      {},
      { [STEP_UP_HEADER]: '' },
      { [STEP_UP_HEADER]: 'not-a-timestamp' },
      { [STEP_UP_HEADER]: '2026-10-01T11:40:00.000Z' },
      { [STEP_UP_HEADER]: '2026-10-01T12:00:00.000Z' },
      { [STEP_UP_HEADER]: '2026-10-01T13:00:00.000Z' },
      { [STEP_UP_HEADER]: '2026-10-01T12:05:00Z' },
      { [STEP_UP_HEADER]: '2026-10-01T08:05:00.000-04:00' },
    ];
    for (const entries of cases)
      expect(
        parseContentSchemaRegistryStepUpHeaders(headersOf(entries), NOW),
        JSON.stringify(entries),
      ).toBe('required');
  });

  it('fails closed when the rendering clock is not a finite instant', () => {
    expect(
      parseContentSchemaRegistryStepUpHeaders(
        headersOf({ [STEP_UP_HEADER]: '2026-10-01T12:05:00.000Z' }),
        Number.NaN,
      ),
    ).toBe('required');
  });
});
