import { ApiErrorSchema } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import { patternInstanceDetails } from './pattern-instance-details';
import { validUpdateResource } from './pattern-update-answers';
import { patternUpdateDetails } from './pattern-update-details';
import {
  failure,
  patternUpdateAdmission,
  type CmsPatternUpdateDependencies,
  type PatternUpdateError,
} from './pattern-update-ports';
import { patternUpdateError } from './pattern-update-response';
import {
  acceptBody,
  PU_ORIGIN,
  PU_REQUEST_ID,
  PU_SELECTOR_PATH,
  updateRow,
} from './pattern-update.test-support';
import { puSession } from './pattern-update-routes.test-support';

const errorOf = async (response: Response) =>
  ApiErrorSchema.parse(await response.json());

describe('refusal details of a source that is not a record', () => {
  it.each([
    ['null', null],
    ['an array', [{ reasonCode: 'capability_missing' }]],
    ['a string', 'private provider text'],
  ])('CMS-03C-02 keeps no member from %s', (_n, source) => {
    expect(patternInstanceDetails(409, source)).toEqual({});
    expect(patternInstanceDetails(422, source)).toEqual({});
    expect(patternInstanceDetails(403, source)).toEqual({});
  });

  it.each([
    ['null', null],
    ['an array', [{ reasonCode: 'x' }]],
    ['a string', 'private provider text'],
  ])('CMS-03C-15 keeps no member from %s', (_n, source) => {
    expect(patternUpdateDetails('CMS-03C-15', 409, source)).toEqual({});
    expect(patternUpdateDetails('CMS-03C-15', 422, source)).toEqual({});
  });
});

describe('validUpdateResource (CMS-03C-15) DEC-193 resolved rows', () => {
  const body = acceptBody(1);
  const etag = '"8"';

  it('rejects a lone resolved row that is neither detached-active nor linked-retired', () => {
    const resource = {
      items: [
        updateRow(0, {
          linkMode: 'detached',
          state: 'retired',
          patternVersion: 1,
        }),
      ],
    };
    expect(validUpdateResource(resource, etag, body)).toBe(false);
  });

  it('rejects a linked superseded row for a single-instance accept', () => {
    const resource = {
      items: [
        updateRow(0, {
          linkMode: 'linked',
          state: 'superseded' as never,
          patternVersion: 1,
        }),
      ],
    };
    expect(validUpdateResource(resource, etag, body)).toBe(false);
  });
});

describe('patternUpdateAdmission quota handling', () => {
  const dependencies = (
    rateLimit: CmsPatternUpdateDependencies['rateLimit'],
  ): CmsPatternUpdateDependencies =>
    ({
      humanOrigins: [PU_ORIGIN],
      now: () => 1_000,
      rateLimit,
    }) as unknown as CmsPatternUpdateDependencies;
  const decision = (limit: number) => ({
    ok: true as const,
    value: { allowed: true, limit, remaining: limit - 1, resetAt: 61 },
  });
  const request = new Request(`https://api.example.test${PU_SELECTOR_PATH}`);

  it('answers 504 when the caller aborts as the party quota settles', async () => {
    const controller = new AbortController();
    const rateLimit = vi.fn(
      async (input: { limit: number; rateScope: string }) => {
        if (input.rateScope === 'party') controller.abort();
        return decision(input.limit);
      },
    );
    const error = await patternUpdateAdmission(
      dependencies(rateLimit as never),
      'CMS-03C-13',
      request,
      puSession(),
      controller.signal,
    );
    expect(error).toMatchObject({ status: 504, retryAfterSeconds: 15 });
    expect(rateLimit).toHaveBeenCalledTimes(2);
  });
});

describe('patternUpdateError 429 projection', () => {
  const respond = (details: Record<string, unknown>, retry?: number) =>
    patternUpdateError(
      new Request(`https://api.example.test${PU_SELECTOR_PATH}`),
      { humanOrigins: [PU_ORIGIN] } as unknown as CmsPatternUpdateDependencies,
      PU_REQUEST_ID,
      'CMS-03C-13',
      {
        ...failure(429, details, retry),
      } as PatternUpdateError,
    );

  it('waits the 60 second window and relays no rate header when the refusal names none', async () => {
    const response = respond({});
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
    expect(response.headers.get('ratelimit-limit')).toBeNull();
    expect(response.headers.get('ratelimit-reset')).toBeNull();
    expect((await errorOf(response)).details).toEqual({});
  });

  it('relays the window of a well-formed 429', async () => {
    const response = respond(
      { retryAfterSeconds: 9, limit: 60, resetAt: '61' },
      9,
    );
    expect(response.headers.get('retry-after')).toBe('9');
    expect(response.headers.get('ratelimit-limit')).toBe('60');
    expect(response.headers.get('ratelimit-reset')).toBe('61');
  });
});
