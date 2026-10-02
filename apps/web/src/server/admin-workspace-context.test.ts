import { describe, expect, it, vi } from 'vitest';

import { resolveAdminWorkspace } from './admin-workspace-context';

const TASK_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d8';
const INSTANT = '2026-09-02T03:00:00.000Z';
const SNAPSHOT_PATH = '/api/v1/admin/capability-snapshot';

const inbox = (canAct: boolean) => ({
  items: [
    {
      taskId: TASK_ID,
      sourceType: 'setting_definition',
      sourceId: TASK_ID,
      sourceVersion: '4',
      taskClass: 'approval',
      requiredCapability: 'admin.inbox.read',
      assigneePersonId: null,
      dueAt: null,
      severity: 'high',
      freshnessAt: INSTANT,
      freshness: 'healthy',
      state: 'open',
      sourceStatus: 'active',
      canAct,
    },
  ],
  nextCursor: null,
  aggregateFreshness: 'healthy',
  partialSources: [],
  generatedAt: INSTANT,
});

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const binding = (options: {
  readonly canAct?: boolean;
  readonly snapshot?: Response;
  readonly inboxStatus?: number;
}) => ({
  fetch: vi.fn(async (input: RequestInfo | URL) => {
    const { pathname } = new URL((input as Request).url);
    if (pathname === SNAPSHOT_PATH)
      return options.snapshot ?? json({ capabilities: [] });
    if (pathname === '/api/v1/admin/inbox')
      return options.inboxStatus === undefined
        ? json(inbox(options.canAct ?? false))
        : json({ code: 'FORBIDDEN' }, options.inboxStatus);
    return json({}, 404);
  }),
});

const resolve = (
  b: ReturnType<typeof binding>,
  extra: Partial<Parameters<typeof resolveAdminWorkspace>[0]> = {},
) =>
  resolveAdminWorkspace({
    request: new Request(
      'https://web.example/app/platform-configuration-admin',
      {
        headers: { cookie: 'wj_session_ref=verified; tracking=ignored' },
      },
    ),
    binding: b,
    tab: 'capabilities',
    requestId: '018f0c45-73fe-7dc2-9c09-68f7ecf132d9',
    ...extra,
  });

describe('resolveAdminWorkspace capability source', () => {
  it('takes capabilities from the Worker CFG-05B-07 projection', async () => {
    const b = binding({
      snapshot: json({
        capabilities: ['admin.inbox.read', 'admin.capability.grant'],
      }),
    });
    const result = await resolve(b);
    expect(result.access).toBe('full');
    expect(result.capabilities).toEqual([
      'admin.inbox.read',
      'admin.capability.grant',
    ]);
    const call = b.fetch.mock.calls
      .map(([value]) => value as Request)
      .find((request) => new URL(request.url).pathname === SNAPSHOT_PATH);
    expect(new URL(call?.url ?? 'https://x').search).toBe('');
    expect(call?.headers.get('cookie')).toBe('wj_session_ref=verified');
  });

  it('merges a trusted page snapshot with the Worker projection', async () => {
    const result = await resolve(
      binding({ snapshot: json({ capabilities: ['admin.audit.read'] }) }),
      { capabilitySnapshot: ['admin.inbox.read'] },
    );
    expect(result.capabilities).toEqual([
      'admin.inbox.read',
      'admin.audit.read',
    ]);
    expect(result.access).toBe('read-only');
  });

  it('keeps an inbox reader without the grant capability read-only', async () => {
    const result = await resolve(
      binding({ snapshot: json({ capabilities: ['admin.inbox.read'] }) }),
    );
    expect(result.access).toBe('read-only');
  });

  it.each([
    ['503', json({ code: 'DEPENDENCY_UNAVAILABLE' }, 503)],
    ['a contract mismatch', json({ capabilities: ['cms.editor'] })],
    ['a non-JSON body', new Response('nope', { status: 200 })],
  ])('fails closed to no capabilities on %s', async (_label, snapshot) => {
    const result = await resolve(binding({ snapshot }));
    expect(result.capabilities).toEqual([]);
    expect(result.access).toBe('read-only');
  });

  it('never trusts a capability header on the inbox response', async () => {
    const b = {
      fetch: vi.fn(async (input: RequestInfo | URL) => {
        const { pathname } = new URL((input as Request).url);
        if (pathname === SNAPSHOT_PATH) return json({ capabilities: [] });
        return new Response(JSON.stringify(inbox(false)), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'x-configuration-capabilities': 'admin.capability.grant',
          },
        });
      }),
    };
    const result = await resolve(b);
    expect(result.capabilities).toEqual([]);
    expect(result.access).toBe('read-only');
  });

  it('does not read the projection for a hidden or forbidden workspace', async () => {
    const hidden = binding({});
    await resolve(hidden, { forceHidden: true });
    expect(hidden.fetch).not.toHaveBeenCalled();
    const forbidden = binding({ inboxStatus: 403 });
    const result = await resolve(forbidden);
    expect(result.access).toBe('not-rendered');
    expect(
      forbidden.fetch.mock.calls.some(
        ([value]) => new URL((value as Request).url).pathname === SNAPSHOT_PATH,
      ),
    ).toBe(false);
  });
});
