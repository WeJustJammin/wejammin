import { describe, expect, it } from 'vitest';

import { ACTIVATION_TABLE } from './governed-activation-tokens.test-support';
import { OPERATIONS } from './governed-review-ops-table.test-support';
import { TABLES as BASE_TABLES } from './governed-review-ops-tokens.test-support';
import { expectError, jsonReply } from './governed-review-ops.test-support';

const TABLES: typeof BASE_TABLES = {
  ...BASE_TABLES,
  'CMS-03C-09': ACTIVATION_TABLE,
};

describe.each(OPERATIONS)('$id SQL refusal transport', (row) => {
  it.each(TABLES[row.id] ?? [])(
    'maps %s',
    async (_name, provider, [status, code, details]) => {
      const harness = row.harness({
        reply: () => jsonReply(provider.body, provider.status),
      });
      const response = await harness.send(row.request());
      const error = await expectError(response, status, code);
      expect(error.details).toEqual(details);
      expect(JSON.stringify(error)).not.toMatch(/private|currentVersion|"99"/);
    },
  );

  it('adopts a token only from the message, never from prose in details', async () => {
    const harness = row.harness({
      reply: () =>
        jsonReply(
          {
            code: 'P0001',
            message: 'unregistered',
            details: 'NOT_FOUND capability_missing',
          },
          400,
        ),
    });
    await expectError(await harness.send(row.request()), 500, 'INTERNAL_ERROR');
  });
});

describe('STEP_UP_REQUIRED raised by SQL (CMS-03C-07, -08 and -09)', () => {
  it.each(
    OPERATIONS.filter(
      (row) =>
        row.id === 'CMS-03C-07' ||
        row.id === 'CMS-03C-08' ||
        row.id === 'CMS-03C-09',
    ),
  )(
    '$id answers 401 with the step-up members, reserving nothing',
    async (row) => {
      const harness = row.harness({
        reply: () =>
          jsonReply({ code: 'P0001', message: 'STEP_UP_REQUIRED' }, 400),
      });
      const error = await expectError(
        await harness.send(row.request()),
        401,
        'STEP_UP_REQUIRED',
      );
      expect(error.details).toEqual({
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      });
    },
  );
});
