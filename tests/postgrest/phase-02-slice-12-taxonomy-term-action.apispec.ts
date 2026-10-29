/**
 * Slice 12 real composition for CMS-03C-03 (`POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions`), the declared
 * happy path of `create` (P2-S12-AC-016): browser request -> production Hono Worker routes -> production RPC adapter ->
 * Kong -> PostgREST -> the newest SQL. The only supplied seams are the verified session (with a fresh step-up proof) and
 * an always-allow rate limiter, so the status, the body, the ETag and every committed row below are what the database
 * decided. The vocabulary is a real flat TaxonomyVersion taken through the production governed chain
 * (CMS-03C-16, 06, 08, 07, 09) exactly as `phase-02-slice-12-latency-taxonomy.apispec.ts` prepares its own.
 *
 * BE03c route row 165 (200 TaxonomyTermResource, `cms.taxonomy.changed.v1`), `Quoted ETag` of the term version,
 * pipeline line 1696 (apply, audit, outbox) and the SQL oracle `phase_02_slice_12_taxonomy_terms/030-create.sqlinc`.
 *
 * Commits fixtures: run right after `pnpm db:reset`, and reset again afterwards. Not run by the author of this file.
 */
import { randomUUID } from 'node:crypto';

import { TaxonomyTermResourceSchema } from '@wejammin/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  type LatencyStack,
  createLatencyStack,
} from './support/phase-02-slice-12-latency-stack';
import {
  type DefinedVersion,
  type LatencyWorld,
  actOnReview,
  approvedReview,
  expectCreated,
  expectOk,
  prepareLatencyWorld,
} from './support/phase-02-slice-12-latency-world';
import { psql } from './support/stack';

const tag = randomUUID().slice(0, 6);
let world: LatencyWorld;
let stack: LatencyStack;
let lineage = '';
let activeVersionId = '';

const count = (sql: string): number => Number(psql(sql));

beforeAll(async () => {
  world = await prepareLatencyWorld();
  stack = createLatencyStack(world.owner);
  const typeKey = psql(
    `select type_key from platform_private.cms_content_types where id = '${world.editorial.contentTypeId}'`,
  );
  stack.as(world.owner);
  const created = await stack.post('/api/v1/cms/taxonomies/versions', {
    body: {
      taxonomyKey: `hp-vocab-${tag}`,
      shape: 'flat',
      allowedTypeKeys: [typeKey],
      allowedFieldKeys: ['title'],
      canonicalOverlapDomains: [],
      expectedVersion: null,
    },
  });
  expectCreated(created, 'create the vocabulary');
  const subject: DefinedVersion = {
    id: String(created.body.id),
    contentHash: String(created.body.contentHash),
    version: String(created.body.version),
  };
  lineage = String(created.body.taxonomyId);
  activeVersionId = subject.id;
  const review = await approvedReview(
    stack,
    world,
    'taxonomy_version',
    subject,
  );
  expectOk(
    await actOnReview(stack, world, review, {
      action: 'activate',
      expectedVersion: review.version,
    }),
    'activate the vocabulary',
  );
}, 300_000);

describe('CMS-03C-03 term action happy path through the real stack', () => {
  it('[P2-S12-AC-016] a taxonomy curator creating a term in the active flat vocabulary is a 200 with the closed TaxonomyTermResource, the quoted term version as ETag, the committed term and labels, one audit record and one taxonomy event', async () => {
    const termKey = `hp-term-${tag}`;
    const idempotencyKey = `hp-term-${randomUUID()}`;
    stack.as(world.owner, 'fresh');
    const response = await stack.post(
      `/api/v1/cms/taxonomies/${lineage}/terms/actions`,
      {
        body: {
          taxonomyId: lineage,
          action: 'create',
          termKey,
          parentId: null,
          survivorId: null,
          labels: [
            { locale: 'en-US', label: 'Happy path' },
            { locale: 'fr-FR', label: 'Chemin heureux' },
          ],
          aliases: ['first'],
          expectedVersion: '1',
        },
        ifMatch: '1',
        idempotencyKey,
      },
    );
    expect(response.status, response.text).toBe(200);
    // The closed resource: the strict schema rejects any extra (owner, authority) member.
    const term = TaxonomyTermResourceSchema.parse(response.body);
    expect(term).toMatchObject({
      lifecycle: 'active',
      taxonomyId: lineage,
      termKey,
      parentId: null,
      successorId: null,
      version: '1',
    });
    expect(term.termId).toBe(term.id);
    expect(response.headers.get('etag')).toBe('"1"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toContain('application/json');

    // The committed term row, under the vocabulary's active version.
    expect(
      psql(
        `select lifecycle || '|' || version::text || '|' || term_key || '|' || taxonomy_version_id::text || '|' || aliases::text
           from platform_private.cms_terms where id = '${term.id}'`,
      ),
    ).toBe(`active|1|${termKey}|${activeVersionId}|["first"]`);
    expect(
      count(
        `select count(*) from platform_private.cms_terms where taxonomy_version_id = '${activeVersionId}' and term_key = '${termKey}'`,
      ),
    ).toBe(1);
    // One active version-1 label row per submitted locale.
    expect(
      psql(
        `select string_agg(locale || ':' || label, ',' order by locale collate "C")
           from platform_private.cms_term_labels
          where term_id = '${term.id}' and state = 'active' and version = 1`,
      ),
    ).toBe('en-US:Happy path,fr-FR:Chemin heureux');
    // Exactly one audit record names the term and one taxonomy event is queued for it.
    expect(
      count(
        `select count(*) from audit_private.audit_events
          where action = 'cms.taxonomy.term.create' and target_type = 'cms_term' and target_id = '${term.id}'`,
      ),
    ).toBe(1);
    expect(
      count(
        `select count(*) from platform_private.outbox_events
          where event_type = 'cms.taxonomy.changed.v1' and aggregate_id = '${term.id}'`,
      ),
    ).toBe(1);
    // The database, not a stub, answered through the named RPC.
    expect(
      stack
        .rpcs()
        .some(
          (call) => call.rpc === 'cms_act_taxonomy_term' && call.status === 200,
        ),
    ).toBe(true);
  }, 120_000);
});
