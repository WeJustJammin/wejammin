import { createServer } from 'node:http';

const PARTY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d4';
const REQUEST_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132db';
const CONFIGURATION_DEFINITION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d8';
const CONFIGURATION_VERSION_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d9';
const ADMIN_TASK_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf13301';
const PORT = Number(process.argv[process.argv.indexOf('--port') + 1] ?? 8787);

const fact = (title, creditRef, roleCodes = ['producer']) => ({
  title,
  creditRef,
  rightsBasis: 'licence',
  rightsState: 'verified',
  roleCodes,
  provenanceState: 'attested',
  mediaState: 'ready',
  captions: 'available',
  transcript: 'available',
});

const profile = (denied = false) => ({
  partyId: PARTY_ID,
  projectionVersion: '7',
  displayName: 'Ada Example',
  headline: 'Producer, collaborator, and rights-conscious creator.',
  layers: [
    { code: 'header', state: 'ready', facts: [] },
    {
      code: 'now',
      state: denied ? 'denied' : 'ready',
      ...(denied ? {} : { facts: [fact('Current work', 'credit-now')] }),
    },
    {
      code: 'record',
      state: 'ready',
      facts: [fact('Recorded work', 'credit-record')],
    },
    { code: 'detail', state: 'empty' },
  ],
  portfolio: [fact('Credit-backed portfolio item', 'credit-portfolio')],
  reel: [fact('Rights-bearing clip', 'credit-reel')],
});

const effectiveConfiguration = (key) => ({
  definitionId: CONFIGURATION_DEFINITION_ID,
  definitionVersionId: CONFIGURATION_VERSION_ID,
  key,
  valueKind: 'short_text',
  ownerCapability: 'settings.web.write',
  typedValue:
    key === 'web.untrusted' ? '<script>untrusted-value</script>' : 'jam',
  sourceScope: 'platform',
  sourceSubjectId: null,
  sourceValueVersionId: null,
  isDefault: true,
  effectiveFrom: null,
  effectiveTo: null,
  evaluatedAt: '2026-09-02T00:00:00.000Z',
  evaluatorVersion: '7',
  correlationId: '018f0c45-73fe-7dc2-9c09-68f7ecf132da',
  compatibility: 'exact',
});

const adminInbox = () => ({
  items: [
    {
      taskId: ADMIN_TASK_ID,
      sourceType: 'configuration',
      sourceId: CONFIGURATION_DEFINITION_ID,
      sourceVersion: '7',
      taskClass: 'approval',
      requiredCapability: 'admin.capability.grant',
      assigneePersonId: PARTY_ID,
      dueAt: '2026-09-03T00:00:00.000Z',
      severity: 'warning',
      freshnessAt: '2026-09-02T00:00:00.000Z',
      freshness: 'healthy',
      state: 'assigned',
      sourceStatus: 'ready',
      canAct: true,
    },
  ],
  nextCursor: null,
  aggregateFreshness: 'healthy',
  partialSources: [],
  generatedAt: '2026-09-02T00:00:00.000Z',
});

const body = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

const send = (response, status, value, headers = {}) => {
  const payload = JSON.stringify(value);
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-request-id': REQUEST_ID,
    ...headers,
  });
  response.end(payload);
};

const SESSION_CAPABILITIES = {
  'slice-07-e2e-session': [
    'settings.read',
    'settings.web.write',
    'settings.approve',
    'settings.release',
    'settings.rollback',
  ],
  'slice-07-e2e-read-only-session': ['settings.read'],
  'slice-08-e2e-session': [
    'admin.inbox.read',
    'admin.capability.grant',
    'admin.audit.read',
  ],
};

const capabilitiesForSession = (cookieHeader = '') => {
  const access = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('wj_access='))
    ?.slice('wj_access='.length);
  return SESSION_CAPABILITIES[access ?? ''] ?? [];
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/healthz') return send(response, 200, { ok: true });
  if (url.pathname === '/api/v1/me/identity' && request.method === 'GET')
    return send(response, 200, {
      personId: PARTY_ID,
      partyKind: 'person',
      accountState: 'active',
      version: '7',
      facets: [],
      aliases: [],
    });
  if (url.pathname === '/api/v1/me/acting-contexts' && request.method === 'GET')
    return send(response, 200, {
      projectionVersion: '7',
      items: [
        {
          contextId: PARTY_ID,
          partyId: PARTY_ID,
          kind: 'person',
          label: 'Self',
          avatarRef: null,
          selectable: true,
          authorityFreshUntil: '2099-01-01T00:00:00.000Z',
        },
      ],
      nextCursor: null,
      hasMore: false,
    });

  const configurationMatch = url.pathname.match(
    /^\/api\/v1\/config\/([^/]+)\/effective$/u,
  );
  if (configurationMatch?.[1] !== undefined && request.method === 'GET') {
    const key = decodeURIComponent(configurationMatch[1]);
    if (key === 'web.missing')
      return send(response, 404, {
        code: 'DEFINITION_NOT_FOUND',
        message: 'The requested configuration is not disclosed.',
        requestId: REQUEST_ID,
      });
    if (key === 'web.rate-limited')
      return send(
        response,
        429,
        {
          code: 'RATE_LIMITED',
          message: 'Wait before retrying.',
          requestId: REQUEST_ID,
          details: { retryAfterSeconds: 30 },
        },
        { 'retry-after': '30' },
      );
    return send(response, 200, effectiveConfiguration(key), {
      etag: '"7"',
    });
  }

  const configurationChangeMatch = url.pathname.match(
    /^\/api\/v1\/admin\/settings\/([^/]+)\/changes$/u,
  );
  if (
    configurationChangeMatch?.[1] === CONFIGURATION_DEFINITION_ID &&
    request.method === 'POST'
  ) {
    const payload = await body(request);
    if (request.headers['idempotency-key'] === undefined)
      return send(response, 400, {
        code: 'INVALID_REQUEST',
        message: 'Idempotency-Key is required.',
        requestId: REQUEST_ID,
      });
    if (payload.includes('{invalid-json'))
      return send(response, 422, {
        code: 'VALIDATION_FAILED',
        message: 'Check the highlighted fields.',
        requestId: REQUEST_ID,
        details: {
          violations: [
            {
              path: '/typedValue',
              code: 'invalid_json',
              message: 'Enter valid JSON.',
            },
          ],
        },
      });
    return send(response, 409, {
      code: 'VERSION_CONFLICT',
      message: 'Refresh the canonical version.',
      requestId: REQUEST_ID,
    });
  }

  if (url.pathname === '/api/v1/admin/inbox' && request.method === 'GET')
    return send(response, 200, adminInbox());

  // CFG-05B-07: the only capability source the real Worker exposes. It is a
  // session-level projection, never per-resource and never a response header,
  // so each e2e session cookie stands for one verified capability set.
  if (
    url.pathname === '/api/v1/admin/capability-snapshot' &&
    request.method === 'GET'
  )
    return send(
      response,
      200,
      { capabilities: capabilitiesForSession(request.headers.cookie) },
      { 'cache-control': 'no-store' },
    );

  const profileMatch = url.pathname.match(/^\/api\/v1\/profiles\/([^/]+)$/u);
  if (profileMatch?.[1] === PARTY_ID && request.method === 'GET')
    return send(
      response,
      200,
      profile(url.searchParams.get('source') === 'denied'),
      {
        etag: '"7"',
      },
    );

  if (profileMatch?.[1] === PARTY_ID && request.method === 'PUT') {
    const value = await body(request);
    if (/[<>]/u.test(value))
      return send(response, 422, {
        code: 'VALIDATION_FAILED',
        message: 'Check the highlighted fields.',
        requestId: REQUEST_ID,
        details: {
          violations: [
            {
              path: 'headline',
              message: 'Headline contains unsupported markup.',
            },
          ],
        },
      });
    return send(response, 200, profile());
  }

  if (
    url.pathname.startsWith('/api/v1/profiles/') ||
    url.pathname.startsWith('/api/v1/reel-items/')
  )
    return send(response, 200, profile());
  return send(response, 404, {
    code: 'NOT_FOUND',
    message: 'The requested profile resource was not found.',
    requestId: REQUEST_ID,
    details: { method: request.method, path: url.pathname },
  });
});

server.listen(PORT, '127.0.0.1');
