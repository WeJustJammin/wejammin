import { describe, expect, it } from 'vitest';

import {
  appendRequest,
  draftDetailPayload,
  draftDetailRequest,
  entryListPayload,
  fetchFailing,
  historyPagePayload,
  historyRequest,
  listRequest,
  postgrestRaise,
  wiredApp,
} from './cms-editorial-production-app.test-support';
import {
  ENTRY_ID,
  PARTY_ID,
  USER_ID,
} from './cms-editorial-production.test-support';
import {
  appendedRevisionId,
  resource,
} from './cms-editorial/route-fixtures.test-support';
import {
  ok,
  recorder,
} from './cms-editorial-production-telemetry.test-support';

/**
 * BE03b "Observability" for the safe reads and the redaction rule (:1439),
 * through the real route -> production adapter chain.
 */

describe('read operations', () => {
  it('[P2-S10-AC-071] a concealed draft read counts a denied detail read and carries no entry hash', async () => {
    const sink = recorder();
    const response = await draftDetailRequest(
      wiredApp(
        fetchFailing(() => postgrestRaise('NOT_FOUND')),
        { telemetry: sink.telemetry },
      ),
    );
    expect(response.status).toBe(404);
    await sink.settled();
    expect(sink.events[0]?.metrics).toMatchObject({
      'cms_entry_draft_detail_total{outcome="denied"}': 1,
      cms_entry_draft_detail_denied_total: 1,
    });
    expect(sink.events[0]?.entityIdHash).toBeUndefined();
    expect(sink.events[0]?.slo).toMatchObject({ tier: 1, commandP95Ms: 750 });
  });

  it('[P2-S10-AC-069] a served draft counts the detail read and its safe field and relation counts, not its values', async () => {
    const sink = recorder();
    const response = await draftDetailRequest(
      wiredApp(fetchFailing(ok(draftDetailPayload)), {
        telemetry: sink.telemetry,
      }),
    );
    expect(response.status).toBe(200);
    await sink.settled();
    expect(sink.events[0]?.metrics).toMatchObject({
      'cms_entry_draft_detail_total{outcome="success"}': 1,
      fields_returned: 0,
      relations_returned: 0,
    });
    expect(sink.events[0]?.metrics).not.toHaveProperty(
      'cms_revision_created_total',
    );
    expect(sink.events[0]?.entityVersion).toBe('3');
  });

  it('[P2-S10-AC-020] history and list reads carry safe counts and never a revision metric', async () => {
    const sink = recorder();
    await historyRequest(
      wiredApp(fetchFailing(ok(historyPagePayload)), {
        telemetry: sink.telemetry,
      }),
    );
    await listRequest(
      wiredApp(fetchFailing(ok(entryListPayload)), {
        telemetry: sink.telemetry,
      }),
    );
    await sink.settled(2);
    const byOperation = new Map(sink.events.map((e) => [e.operationId, e]));
    expect(byOperation.get('CMS-03B-03')?.metrics).toMatchObject({
      items_returned: 0,
      changes_returned: 0,
    });
    expect(byOperation.get('CMS-03B-13')?.metrics).toMatchObject({
      items_returned: 1,
    });
    for (const event of sink.events) {
      expect(event.metrics).not.toHaveProperty('cms_revision_created_total');
      expect(event.eventType).toBe('none');
    }
  });
});

describe('redaction (BE03b:1439)', () => {
  it('[P2-S10-AC-009] [P2-S10-AC-015] no event carries an identifier, value, credential or request body', async () => {
    const sink = recorder();
    const fetchImpl = fetchFailing(ok(resource(appendedRevisionId, '2')));
    const app = wiredApp(fetchImpl, { telemetry: sink.telemetry });
    await appendRequest(app, {
      headers: {
        cookie: 'wj_session_ref=secret-cookie; wj_csrf=csrf-secret',
        'x-csrf-token': 'csrf-secret',
        authorization: 'Bearer secret-token',
      },
    });
    await historyRequest(app);
    await sink.settled(2);
    for (const event of sink.events) {
      const text = JSON.stringify(event);
      for (const forbidden of [
        USER_ID,
        PARTY_ID,
        ENTRY_ID,
        'Hello',
        'secret-cookie',
        'csrf-secret',
        'secret-token',
        'idempotency-key-0001',
      ])
        expect(text).not.toContain(forbidden);
    }
  });
});
