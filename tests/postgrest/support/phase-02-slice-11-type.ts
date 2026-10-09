/**
 * The ONE active content type the Slice 11 suites share (lane S11-4R), under the shared
 * operator-bootstrap owner. The owner receipt (`cms_owner_initialization`) is what
 * CMS-03B-18 and every `owner` read scope derive from, so Slice 11 worlds cannot live in
 * an isolated organization; find-or-create keeps the footprint on the owner's content-type
 * list (paged by `worker-round-trip`) at exactly one type for all four suites.
 *
 * Everything but the activation envelope comes from production code: the draft is created
 * by the production registry app (CMS-03A-01); activation mirrors `cms-editorial-world.ts`
 * (the real `editorial` workflow-policy member, applied directly because the 03a approval
 * chain is exercised by the Slice 09 suites).
 */
import { expect } from 'vitest';

import { createCmsApp, draftTypeBody, ownerSession } from './cms-app';
import type { EditorialWorld } from './cms-editorial-world';
import { type CmsOwner, psql } from './stack';

const TYPE_KEY = 's11_world';

const grantAuthoring = (owner: CmsOwner): void => {
  psql(`
    insert into identity_private.organization_actor_grant(
      organization_id, person_id, capability_code, valid_from, valid_through, active)
    select '${owner.organizationId}', '${owner.personId}', capability,
           current_date, current_date + 30, true
      from (values ('cms.author'), ('cms.editor'), ('cms.schema_designer'))
           as capabilities(capability)
    on conflict (organization_id, person_id, capability_code)
    do update set active = true, valid_through = excluded.valid_through`);
};

const activate = (typeId: string, versionId: string): void => {
  psql(`
    begin;
    select set_config('app.cms_rpc', 'true', true);
    update platform_private.cms_content_type_versions version_row
       set state = 'active',
           version = version_row.version + 1,
           activation_workflow_policy_key = member.m->>'key',
           activation_workflow_policy_version = (member.m->>'version')::bigint,
           activation_workflow_policy_hash = member.m->>'policyHash',
           activation_required_decision_count = (member.m->>'requiredDecisionCount')::integer,
           activation_required_capabilities = member.m->'requiredCapabilities',
           activation_approval_evidence_hash = repeat('b', 64),
           updated_at = clock_timestamp()
      from (select platform_private.cms_workflow_policy_member('editorial', 1) as m) member
     where version_row.id = '${versionId}';
    update platform_private.cms_content_types
       set state = 'active', version = version + 1, updated_at = clock_timestamp()
     where id = '${typeId}';
    commit;`);
};

export const ensureS11ContentType = async (
  owner: CmsOwner,
): Promise<EditorialWorld> => {
  grantAuthoring(owner);
  const existing = psql(`
    select t.id || '|' || v.id
      from platform_private.cms_content_types t
      join platform_private.cms_content_type_versions v
        on v.content_type_id = t.id and v.state = 'active'
     where t.type_key = '${TYPE_KEY}' limit 1`);
  let contentTypeId: string;
  let contentTypeVersionId: string;
  if (existing === '') {
    const registry = createCmsApp(
      ownerSession(owner.authUserId, owner.organizationId, [
        'cms.schema_designer',
      ]),
    );
    const created = await registry.send('POST', '/api/v1/cms/content-types', {
      body: draftTypeBody(TYPE_KEY),
    });
    expect(created.status).toBe(201);
    contentTypeId = String(created.body.contentTypeId);
    contentTypeVersionId = String(created.body.id);
    activate(contentTypeId, contentTypeVersionId);
  } else {
    [contentTypeId = '', contentTypeVersionId = ''] = existing.split('|');
  }
  const titleFieldId = psql(`
    select stable_field_id from platform_private.cms_field_definition_versions
     where content_type_version_id = '${contentTypeVersionId}' and field_key = 'title'`);
  return { owner, contentTypeId, contentTypeVersionId, titleFieldId };
};
