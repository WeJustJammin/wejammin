/** Local producer-chain regressions. No hosted MFA/provider or acceptance claim. */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  activateS11SchemaCandidate,
  prepareS11SchemaCandidate,
  s11ActivationRequest,
  s11FrozenActivationEvidence,
} from './support/phase-02-slice-11-schema-lifecycle';
import {
  createS11Session,
  type S11TokenProof,
} from './support/phase-02-slice-11-session';
import {
  EFFECT_TABLES,
  expectUnchanged,
  snapshotDigest,
} from './support/phase-02-slice-11-effect';
import { createS11Stack } from './support/phase-02-slice-11-stack';
import { seedDraft } from './support/phase-02-slice-11-world';
import { type CmsOwner, ensureCmsOwner, psql } from './support/stack';

let owner: CmsOwner;
beforeAll(() => {
  owner = ensureCmsOwner();
});

/** Include CMS03A state as well as the complete shared 14-group editorial oracle. */
const schemaSnapshot = (): string =>
  psql(`select jsonb_object_agg(name, digest)::text from (
  ${[
    'cms_content_types',
    'cms_content_type_versions',
    'cms_schema_reviews',
    'cms_schema_review_assignments',
    'cms_schema_review_decisions',
    'cms_schema_dry_run_reports',
    'cms_schema_migration_plans',
  ]
    .map(
      (table) => `
    select '${table}' name, encode(sha256(convert_to(coalesce(string_agg(
      to_jsonb(t)::text, E'\\n' order by to_jsonb(t)::text), ''), 'utf8')), 'hex') digest
    from platform_private.${table} t`,
    )
    .join(' union all ')}
) snapshots`);

const frozenProducerRows = (reviewId: string, dryRunId: string): string =>
  psql(`
  select jsonb_build_object(
    'review', (select to_jsonb(r) - array['state','version','updated_at','decided_at','approval_evidence_hash']
      from platform_private.cms_schema_reviews r where id = '${reviewId}'),
    'decisions', (select jsonb_agg(to_jsonb(d) order by id)
      from platform_private.cms_schema_review_decisions d where review_id = '${reviewId}'),
    'report', (select to_jsonb(r) from platform_private.cms_schema_dry_run_reports r
      where id = '${dryRunId}')
  )::text`);

describe('Slice 11 genuine local schema lifecycle', () => {
  it('activates a fresh draft only with the actual dry-run, independent decision and server-derived approval hash', async () => {
    const candidate = await prepareS11SchemaCandidate(owner);
    expect(candidate.reviewer.actor.personId).not.toBe(owner.personId);
    expect(
      psql(`select count(*) from identity_private.organization_actor_grant
      where person_id = '${candidate.reviewer.actor.personId}'`),
    ).toBe('0');
    expect(
      psql(`select (d.assignment_id = '${candidate.assignmentId}'
      and d.reviewer_person_ref = '${candidate.reviewer.actor.personId}'
      and d.review_id = '${candidate.reviewId}' and d.decision = 'approve'
      and d.mfa_verified_at = '${candidate.reviewer.proofAt}'::timestamptz)::text
      from platform_private.cms_schema_review_decisions d where id = '${candidate.decisionId}'`),
    ).toBe('true');
    await activateS11SchemaCandidate(candidate);
    expect(
      psql(`select (v.activation_approval_evidence_hash = r.approval_evidence_hash
      and r.approval_evidence_hash = platform_private.cms_jcs_sha256(pg_catalog.jsonb_build_object(
        'version', 1,
        'reviewId', r.id,
        'definitionHash', r.definition_hash,
        'policyHash', r.policy_hash,
        'decisions', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id', decision.id,
            'assignmentId', decision.assignment_id,
            'capability', decision.capability_key,
            'reviewedHash', decision.reviewed_hash
          ) order by decision.id)
            from platform_private.cms_schema_review_decisions decision
           where decision.review_id = r.id and decision.decision = 'approve'
        ), '[]'::jsonb)
      ))
      and v.dry_run_id = '${candidate.dryRunId}' and r.dry_run_id = v.dry_run_id)::text
      from platform_private.cms_content_type_versions v
      join platform_private.cms_schema_reviews r on r.content_type_version_id = v.id
      where v.id = '${candidate.contentTypeVersionId}' and r.id = '${candidate.reviewId}'`),
    ).toBe('true');
    expect(
      candidate.designer.app.observed().filter(({ status }) => status >= 400),
    ).toEqual([]);
    expect(
      candidate.reviewer.app.observed().filter(({ status }) => status >= 400),
    ).toEqual([]);
  });

  it.each<S11TokenProof>(['stale', 'future', 'none', 'aal1'])(
    'refuses %s token MFA despite a freshly registered session and binding heartbeat, with all 14 groups unchanged',
    async (proof) => {
      const candidate = await prepareS11SchemaCandidate(owner);
      const session = await createS11Session(
        { ...owner, actingPartyId: owner.organizationId },
        proof,
      );
      const request = await s11ActivationRequest(candidate);
      const before = snapshotDigest();
      const schemaBefore = schemaSnapshot();
      session.app.clearObserved();
      const denied = await session.app.send('POST', request.path, {
        body: request.body,
        ifMatch: request.body.expectedVersion,
      });
      expect(denied).toMatchObject({
        status: 401,
        body: {
          code: 'STEP_UP_REQUIRED',
          details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
        },
      });
      expect(
        session.app.observed().some(({ rpc }) => rpc === 'cms_activate_schema'),
      ).toBe(false);
      expect(Object.keys(before).sort()).toEqual([...EFFECT_TABLES].sort());
      expect(Object.keys(before)).toHaveLength(14);
      expectUnchanged(before, snapshotDigest(), `token ${proof} refusal`);
      expect(schemaSnapshot()).toBe(schemaBefore);
      expect(
        psql(`select (last_seen_at > clock_timestamp() - interval '1 minute')::text
        from platform_private.acting_context_binding where id = '${session.bindingId}'`),
      ).toBe('true');
    },
  );

  it('refuses a foreign client binding selector before activation with complete no-effects evidence', async () => {
    const candidate = await prepareS11SchemaCandidate(owner);
    const request = await s11ActivationRequest(candidate);
    const before = snapshotDigest();
    const schemaBefore = schemaSnapshot();
    candidate.designer.app.clearObserved();
    const denied = await candidate.designer.app.send('POST', request.path, {
      body: request.body,
      ifMatch: request.body.expectedVersion,
      headers: { 'x-client-binding-id': candidate.reviewer.clientBindingId },
    });
    expect(denied).toMatchObject({
      status: 404,
      body: { code: 'CONTEXT_NOT_FOUND' },
    });
    expect(
      candidate.designer.app
        .observed()
        .some(({ rpc }) => rpc === 'cms_activate_schema'),
    ).toBe(false);
    expect(Object.keys(before)).toHaveLength(14);
    expectUnchanged(before, snapshotDigest(), 'foreign selector refusal');
    expect(schemaSnapshot()).toBe(schemaBefore);
  });

  it('activates a genuine successor with nonzero source rows and preserves old frozen evidence and revisions byte-for-byte', async () => {
    const first = await prepareS11SchemaCandidate(owner);
    const editorial = await activateS11SchemaCandidate(first);
    const actor = { ...owner, capabilities: ['cms.author', 'cms.editor'] };
    const stack = createS11Stack(actor);
    const entry = await seedDraft(
      stack,
      { owner: actor, editorial },
      'Successor source title',
    );
    const evidenceBefore = s11FrozenActivationEvidence(
      editorial.contentTypeVersionId,
    );
    const producersBefore = frozenProducerRows(first.reviewId, first.dryRunId);
    const revisionBefore =
      psql(`select to_jsonb(r)::text from platform_private.cms_entry_revisions r
      where id = '${entry.revisionId}'`);
    const successor = await prepareS11SchemaCandidate(owner, editorial);
    expect(
      psql(`select source_count::text from platform_private.cms_schema_dry_run_reports
      where id = '${successor.dryRunId}'`),
    ).toBe('1');
    expect(successor.workerCalls).toContain(
      'cms_process_schema_migration_dry_run_batch',
    );
    expect(successor.workerCalls).toContain(
      'cms_process_schema_migration_batch',
    );
    expect(
      psql(`select count(*) from platform_private.cms_schema_migration_target_rows
      where plan_id = '${successor.migrationPlanId}'`),
    ).toBe('1');
    await activateS11SchemaCandidate(successor);
    expect(s11FrozenActivationEvidence(editorial.contentTypeVersionId)).toBe(
      evidenceBefore,
    );
    expect(frozenProducerRows(first.reviewId, first.dryRunId)).toBe(
      producersBefore,
    );
    expect(
      psql(`select to_jsonb(r)::text from platform_private.cms_entry_revisions r
      where id = '${entry.revisionId}'`),
    ).toBe(revisionBefore);
    expect(
      psql(`select count(*) from platform_private.cms_entry_revisions
      where entry_id = '${entry.entryId}'`),
    ).toBe('1');
    expect(
      psql(`select state from platform_private.cms_content_type_versions
      where id = '${editorial.contentTypeVersionId}'`),
    ).toBe('superseded');
  });
});
