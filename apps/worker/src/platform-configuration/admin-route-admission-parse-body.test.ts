import { describe, expect, it } from 'vitest';

import { parseBody } from './admin-route-admission';

const schema = {
  safeParse: (value: unknown) =>
    typeof value === 'object' && value !== null && 'name' in value
      ? { success: true as const, data: value as { name: string } }
      : {
          success: false as const,
          error: {
            issues: [{ path: ['name'], message: 'name is required' }],
          },
        },
};

const post = (body: string): Request =>
  new Request('https://api.example.test/api/v1/admin/example', {
    body,
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });

describe('admin parseBody (BE00 step 6 on a read body)', () => {
  it('returns the parsed value of a body the schema accepts', async () => {
    await expect(parseBody(post('{"name":"ok"}'), schema)).resolves.toEqual({
      ok: true,
      value: { name: 'ok' },
    });
  });

  it('answers a body the schema rejects as a 400 with the violation path', async () => {
    const result = await parseBody(post('{}'), schema);

    expect(result).toMatchObject({ ok: false, status: 400 });
  });
});
