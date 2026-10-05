// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCanonicalPayloadCheck } from './content-schema-registry-canonical-payload-check';
import { readContentSchemaRegistryCanonicalOutcome } from './content-schema-registry-canonical-read';
import { initialProjectionState } from './content-schema-registry-canonical-projection-state';
import {
  ContractValidatorsNotLoadedError,
  loadContractValidators,
  loadedContractValidators,
  resetContractValidatorsForTest,
  type ContractValidators,
} from './content-schema-registry-contract-validators';
import { parseActivationResult } from './content-schema-registry-runtime-dom-activation-result';
import {
  DETAIL,
  islandMarkup,
  okBody,
} from './content-schema-registry-island-refetch.test-support';
import { classifyStepUpResponse } from './content-schema-registry-step-up-classify';

/**
 * AC261: the registry island ships no zod in its initial JavaScript. The strict
 * resource contracts are loaded the first time the browser must check a
 * payload it has not already received from the server. These tests run the
 * real read, parse and classify code with a counting loader and prove the
 * three guarantees that make that safe: an unchanged payload never loads zod,
 * a changed payload is still checked strictly (never trusted because it is
 * "from the server"), and a validator that cannot be loaded fails closed.
 */

const URL_UNDER_TEST = '/app/cms-content-modeling/x?limit=25';

const loadCount = { value: 0 };
const countingLoader = () => {
  loadCount.value += 1;
  return import('@wejammin/contracts/content-schema-registry/validators');
};

const heldProjection = () =>
  initialProjectionState({
    access: 'full',
    variant: 'ownerFull',
    initialList: { status: 'empty', reason: 'no-records' },
    initialDetail: {
      status: 'success',
      data: DETAIL,
      version: '1',
      stale: false,
    },
    initialReview: null,
  });

const serveMarkup = (markup: string): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(markup, { status: 200 })),
  );
};

const detailWith = (overrides: Record<string, unknown>) => ({
  status: 'success',
  data: { ...DETAIL, ...overrides },
  version: '2',
  stale: false,
});
/** A valid, different detail: the same version with another label. */
const relabelled = detailWith({
  resource: { ...DETAIL.resource, label: 'Changed' },
});

beforeEach(() => {
  loadCount.value = 0;
  resetContractValidatorsForTest(countingLoader);
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetContractValidatorsForTest();
});

describe('[P2-S09-AC-261] payload check', () => {
  it('[P2-S09-AC-261] accepts a payload identical to the held one without validators', () => {
    const check = createCanonicalPayloadCheck(heldProjection(), null);
    expect(check.detail(JSON.parse(JSON.stringify(DETAIL)))).toBe(true);
    expect(loadCount.value).toBe(0);
  });

  it('[P2-S09-AC-261] refuses to judge a changed payload before the validators are loaded', () => {
    const check = createCanonicalPayloadCheck(heldProjection(), null);
    expect(() => check.detail({ ...DETAIL, unexpected: true })).toThrow(
      ContractValidatorsNotLoadedError,
    );
    expect(() => check.list({ items: [] })).toThrow(
      ContractValidatorsNotLoadedError,
    );
    expect(() => check.review({})).toThrow(ContractValidatorsNotLoadedError);
  });

  it('[P2-S09-AC-261] judges a changed payload strictly once the validators are loaded', async () => {
    const validators: ContractValidators = await loadContractValidators();
    const check = createCanonicalPayloadCheck(heldProjection(), validators);
    expect(check.detail({ ...DETAIL, label: 'Changed' })).toBe(false);
    expect(
      check.detail({
        ...DETAIL,
        resource: { ...DETAIL.resource, label: 'Changed' },
      }),
    ).toBe(true);
    expect(check.detail({ ...DETAIL, unexpected: true })).toBe(false);
    expect(check.list({ items: 'not a list' })).toBe(false);
    expect(check.review({ status: 'success' })).toBe(false);
  });
});

describe('[P2-S09-AC-261] canonical read loads zod only for a changed payload', () => {
  it('[P2-S09-AC-261] an unchanged canonical read validates nothing and loads nothing', async () => {
    serveMarkup(okBody({ initialReview: null }));
    const outcome = await readContentSchemaRegistryCanonicalOutcome(
      document,
      URL_UNDER_TEST,
      heldProjection(),
    );
    expect(outcome.kind).toBe('projection');
    expect(loadCount.value).toBe(0);
    expect(loadedContractValidators()).toBeNull();
  });

  it('[P2-S09-AC-261] a changed payload loads the validators once and is then adopted', async () => {
    serveMarkup(
      okBody({
        initialReview: null,
        initialDetail: relabelled,
      }),
    );
    const first = await readContentSchemaRegistryCanonicalOutcome(
      document,
      URL_UNDER_TEST,
      heldProjection(),
    );
    expect(first.kind).toBe('projection');
    expect(loadCount.value).toBe(1);
    const second = await readContentSchemaRegistryCanonicalOutcome(
      document,
      URL_UNDER_TEST,
      heldProjection(),
    );
    expect(second.kind).toBe('projection');
    expect(loadCount.value).toBe(1);
  });

  it('[P2-S09-AC-261] a changed payload that breaks the strict contract is refused, not trusted', async () => {
    serveMarkup(
      okBody({
        initialReview: null,
        initialDetail: detailWith({ leakedLabel: 'SECRET' }),
      }),
    );
    const outcome = await readContentSchemaRegistryCanonicalOutcome(
      document,
      URL_UNDER_TEST,
      heldProjection(),
    );
    expect(outcome).toEqual({ kind: 'disabled', reason: 'invalid' });
    expect(loadCount.value).toBe(1);
  });

  it('[P2-S09-AC-261] with nothing held every payload is validated strictly', async () => {
    serveMarkup(okBody({ initialReview: null }));
    const outcome = await readContentSchemaRegistryCanonicalOutcome(
      document,
      URL_UNDER_TEST,
    );
    expect(outcome.kind).toBe('projection');
    expect(loadCount.value).toBe(1);
  });

  it('[P2-S09-AC-261] a validator chunk that cannot be loaded fails closed and is retried by the next read', async () => {
    resetContractValidatorsForTest(() => {
      loadCount.value += 1;
      return Promise.reject(new TypeError('chunk unavailable'));
    });
    serveMarkup(
      okBody({
        initialReview: null,
        initialDetail: relabelled,
      }),
    );
    const failed = await readContentSchemaRegistryCanonicalOutcome(
      document,
      URL_UNDER_TEST,
      heldProjection(),
    );
    expect(failed).toEqual({ kind: 'disabled', reason: 'unavailable' });
    resetContractValidatorsForTest(countingLoader);
    const retried = await readContentSchemaRegistryCanonicalOutcome(
      document,
      URL_UNDER_TEST,
      heldProjection(),
    );
    expect(retried.kind).toBe('projection');
  });

  it('[P2-S09-AC-261] leaves an island markup without props untouched by the lazy path', async () => {
    serveMarkup(islandMarkup({}).replace(/props="[^"]*"/u, ''));
    const outcome = await readContentSchemaRegistryCanonicalOutcome(
      document,
      URL_UNDER_TEST,
      heldProjection(),
    );
    expect(outcome.kind).toBe('disabled');
    expect(loadCount.value).toBe(0);
  });
});

describe('[P2-S09-AC-261] mutation helpers load zod on their first need', () => {
  it('[P2-S09-AC-261] an unverified activation body is never shown as a success', async () => {
    expect(loadedContractValidators()).toBeNull();
    expect(parseActivationResult({ resourceKind: 'schema_activation' })).toBe(
      null,
    );
    await loadContractValidators();
    expect(parseActivationResult({ resourceKind: 'schema_activation' })).toBe(
      null,
    );
  });

  it('[P2-S09-AC-261] a step-up 401 loads the typed schema and classifies the body', async () => {
    const response = new Response(
      JSON.stringify({
        code: 'STEP_UP_REQUIRED',
        details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
        requestId: 'req-1',
        message: 'x',
      }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    );
    const classification = await classifyStepUpResponse(response);
    expect(loadCount.value).toBe(1);
    expect(classification?.kind === 'navigate' || classification !== null).toBe(
      true,
    );
  });

  it('[P2-S09-AC-261] a step-up 401 whose typed schema cannot load is the malformed degraded state', async () => {
    resetContractValidatorsForTest(() =>
      Promise.reject(new TypeError('chunk unavailable')),
    );
    const response = new Response(
      JSON.stringify({ code: 'STEP_UP_REQUIRED', requestId: 'req-2' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    );
    expect(await classifyStepUpResponse(response)).toEqual({
      kind: 'malformed',
      requestId: 'req-2',
    });
  });

  it('[P2-S09-AC-261] a plain 401 never loads zod', async () => {
    const response = new Response(JSON.stringify({ code: 'UNAUTHENTICATED' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
    expect(await classifyStepUpResponse(response)).toBeNull();
    expect(loadCount.value).toBe(0);
  });
});
