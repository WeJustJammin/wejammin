import { describe, expect, it } from 'vitest';

import { fakeRpc } from '../event-consumers/test-support';
import {
  createRpcLocaleObservabilityPort,
  localeObservabilityWindow,
  parseLocaleObservation,
  type LocaleObservation,
} from './locale-observability';

/*
 * [P2-S12-AC-052] BE03c Observability, "Database-side locale observability (DEC-208)": the closed-open window
 * `[T - 3 min, T - 2 min)`, the strict three-integer parser and the service-role RPC port. The probe (counters,
 * gauge, alert, swallowed failure) is `locale-observability-probe.test.ts`.
 */

const T = Date.UTC(2026, 9, 22, 12, 5, 0);
const iso = (ms: number): string => new Date(ms).toISOString();

const observation = (patch: Partial<LocaleObservation> = {}) => ({
  fanoutRows: 0,
  staleFieldsAppended: 0,
  staleLegalFields: 0,
  ...patch,
});

describe('[P2-S12-AC-052] the observation window', () => {
  it('is [T - 3 min, T - 2 min) for T the scheduled time floored to the minute', () => {
    expect(localeObservabilityWindow(T)).toEqual({
      start: iso(T - 3 * 60_000),
      end: iso(T - 2 * 60_000),
    });
    expect(localeObservabilityWindow(T)).toEqual({
      start: '2026-10-22T12:02:00.000Z',
      end: '2026-10-22T12:03:00.000Z',
    });
  });

  it('floors a firing that is late within its minute to the same window', () => {
    for (const offset of [1, 999, 30_000, 59_999])
      expect(localeObservabilityWindow(T + offset)).toEqual(
        localeObservabilityWindow(T),
      );
  });

  it('moves to the next window exactly on the minute boundary', () => {
    expect(localeObservabilityWindow(T - 1)).toEqual({
      start: '2026-10-22T12:01:00.000Z',
      end: '2026-10-22T12:02:00.000Z',
    });
    expect(localeObservabilityWindow(T + 60_000).start).toBe(
      localeObservabilityWindow(T).end,
    );
  });

  it('tiles time: consecutive minutely ticks read adjacent windows with no gap and no overlap', () => {
    for (let tick = 0; tick < 180; tick += 1) {
      const current = localeObservabilityWindow(T + tick * 60_000);
      const next = localeObservabilityWindow(T + (tick + 1) * 60_000);
      expect(current.end).toBe(next.start);
    }
  });

  it('always spans exactly 60 seconds between whole minutes (what the database accepts)', () => {
    for (const time of [T, T + 17, T + 59_999, T - 1, T + 86_400_000 - 1]) {
      const { start, end } = localeObservabilityWindow(time);
      expect(Date.parse(end) - Date.parse(start)).toBe(60_000);
      expect(Date.parse(start) % 60_000).toBe(0);
      expect(start).toMatch(/:00\.000Z$/u);
    }
  });

  it('refuses a scheduled time that is not a finite instant', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1e30, 1e30])
      expect(() => localeObservabilityWindow(bad)).toThrow(
        'Invalid scheduled time',
      );
  });
});

describe('[P2-S12-AC-052] the strict response parser', () => {
  it('accepts exactly three non-negative integers', () => {
    expect(
      parseLocaleObservation({
        fanoutRows: 2,
        staleFieldsAppended: 3,
        staleLegalFields: 1,
      }),
    ).toEqual({ fanoutRows: 2, staleFieldsAppended: 3, staleLegalFields: 1 });
    expect(parseLocaleObservation(observation())).toEqual(observation());
  });

  it.each([
    ['null', null],
    ['an array', [1, 2, 3]],
    ['a string', '{"fanoutRows":0}'],
    ['a missing key', { fanoutRows: 0, staleFieldsAppended: 0 }],
    ['an extra key', { ...observation(), locale: 'fr-FR' }],
    ['an extra id key', { ...observation(), id: 'x' }],
    ['a negative count', observation({ fanoutRows: -1 })],
    ['a negative field sum', observation({ staleFieldsAppended: -3 })],
    ['a non-integer gauge', observation({ staleLegalFields: 1.5 })],
    ['a numeric string', { ...observation(), fanoutRows: '2' }],
    ['a boolean', { ...observation(), staleLegalFields: true }],
    ['NaN', observation({ staleLegalFields: Number.NaN })],
    ['Infinity', observation({ fanoutRows: Number.POSITIVE_INFINITY })],
    ['an unsafe integer', observation({ fanoutRows: 2 ** 53 })],
    ['a null member', { ...observation(), staleLegalFields: null }],
  ])('rejects %s', (_name, value) => {
    expect(() => parseLocaleObservation(value)).toThrow(
      'Malformed locale observability response',
    );
  });
});

describe('[P2-S12-AC-052] the RPC port', () => {
  it('calls the named service-role RPC with the window and parses the answer', async () => {
    const { calls, rpc } = fakeRpc({
      cms_locale_observability_read: () => ({
        fanoutRows: 4,
        staleFieldsAppended: 9,
        staleLegalFields: 2,
      }),
    });
    const signal = new AbortController().signal;
    await expect(
      createRpcLocaleObservabilityPort(rpc).read(
        localeObservabilityWindow(T),
        signal,
      ),
    ).resolves.toEqual({
      fanoutRows: 4,
      staleFieldsAppended: 9,
      staleLegalFields: 2,
    });
    expect(calls).toEqual([
      {
        operation: 'cms_locale_observability_read',
        input: {
          p_window_start: '2026-10-22T12:02:00.000Z',
          p_window_end: '2026-10-22T12:03:00.000Z',
        },
      },
    ]);
  });

  it('rejects a malformed answer instead of passing it on', async () => {
    const { rpc } = fakeRpc({
      cms_locale_observability_read: () => ({
        fanoutRows: 1,
        staleFieldsAppended: 1,
        staleLegalFields: 1,
        extra: 1,
      }),
    });
    await expect(
      createRpcLocaleObservabilityPort(rpc).read(
        localeObservabilityWindow(T),
        new AbortController().signal,
      ),
    ).rejects.toThrow('Malformed locale observability response');
  });
});
