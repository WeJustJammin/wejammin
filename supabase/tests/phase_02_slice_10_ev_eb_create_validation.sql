-- Slice 10 evidence lane EB: CMS-03B-10 create body validation with no mutation (AC-062) and no fabricated existing
-- version (AC-049).  Every refusal runs through the named worker-facing RPC (platform_api.cms_create_entry) exactly as the
-- Worker calls it, in a rolled-back subtransaction, and is checked against a fingerprint of every table a command could
-- touch (entries, revisions, values, relations, conflicts, reservations, assignments, audit, outbox).

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_rpc/009-restore-policy-binding.sqlinc
\ir phase_02_slice_10_ev_eb/000-helpers.sqlinc

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));

-- ---------------------------------------------------------------------------------------
-- H. Create body validation with no mutation (AC-062) and no fabricated existing version (AC-049).
-- ---------------------------------------------------------------------------------------
create or replace function pg_temp.eb_field_pointer(p_key text)
returns text
language sql
stable
as $body$
  select '/fields/' || (select value from s10_ids where key = p_key)
$body$;

select pg_temp.eb_probe('eb-validate-type-id', null, pg_temp.eb_create_sql('eb-create-bad-type-0001', jsonb_build_object('contentTypeId', 'not-a-uuid')));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-validate-type-id')), 'P0001|VALIDATION_FAILED|["/contentTypeId"]|-',
  'EB create validation: a malformed contentTypeId is VALIDATION_FAILED at /contentTypeId'
);
select is(
  pg_temp.eb_obs('eb-validate-type-id')->>'after', pg_temp.eb_obs('eb-validate-type-id')->>'before',
  'EB create validation: the malformed-contentTypeId refusal wrote no entry, revision, value, assignment, reservation, audit or outbox row'
);
select pg_temp.eb_probe('eb-validate-version-id', null, pg_temp.eb_create_sql('eb-create-bad-version-0001', jsonb_build_object('contentTypeVersionId', 'not-a-uuid')));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-validate-version-id')), 'P0001|VALIDATION_FAILED|["/contentTypeVersionId"]|-',
  'EB create validation: a malformed contentTypeVersionId is VALIDATION_FAILED at /contentTypeVersionId'
);
select is(
  pg_temp.eb_obs('eb-validate-version-id')->>'after', pg_temp.eb_obs('eb-validate-version-id')->>'before',
  'EB create validation: the malformed-contentTypeVersionId refusal wrote nothing'
);
select pg_temp.eb_probe('eb-validate-locale-shape', null, pg_temp.eb_create_sql('eb-create-bad-locale-0001', jsonb_build_object('locale', 'en_US')));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-validate-locale-shape')), 'P0001|VALIDATION_FAILED|["/locale"]|-',
  'EB create validation: a malformed locale is VALIDATION_FAILED at /locale'
);
select is(
  pg_temp.eb_obs('eb-validate-locale-shape')->>'after', pg_temp.eb_obs('eb-validate-locale-shape')->>'before',
  'EB create validation: the malformed-locale refusal wrote nothing'
);
select pg_temp.eb_probe('eb-validate-locale-set', null, pg_temp.eb_create_sql('eb-create-bad-locale-set-0001', jsonb_build_object('locale', 'zz-ZZ')));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-validate-locale-set')), 'P0001|VALIDATION_FAILED|["/locale"]|-',
  'EB create validation: a well-formed locale outside the active schema locale set is VALIDATION_FAILED at /locale'
);
select is(
  pg_temp.eb_obs('eb-validate-locale-set')->>'after', pg_temp.eb_obs('eb-validate-locale-set')->>'before',
  'EB create validation: the out-of-set-locale refusal wrote nothing'
);
select pg_temp.eb_probe(
  'eb-validate-artifact', null,
  pg_temp.eb_create_sql('eb-create-bad-artifact-0001', jsonb_build_object(
    'schemaArtifact', pg_temp.eb_create_request('x')->'schemaArtifact' || jsonb_build_object('artifactHash', repeat('0', 64)))));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-validate-artifact')), 'P0001|VALIDATION_FAILED|["/schemaArtifact"]|-',
  'EB create validation: a schema artifact whose hash is not the compiled artifact of the version is VALIDATION_FAILED at /schemaArtifact'
);
select is(
  pg_temp.eb_obs('eb-validate-artifact')->>'after', pg_temp.eb_obs('eb-validate-artifact')->>'before',
  'EB create validation: the off-registry-schema refusal wrote nothing'
);
select pg_temp.eb_probe(
  'eb-validate-activation', null,
  pg_temp.eb_create_sql('eb-create-bad-activation-0001', jsonb_build_object(
    'activationEvidence', pg_temp.eb_create_request('x')->'activationEvidence' || jsonb_build_object('policyHash', repeat('9', 64)))));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-validate-activation')), 'P0001|VALIDATION_FAILED|["/activationEvidence"]|-',
  'EB create validation: forged activation evidence is VALIDATION_FAILED at /activationEvidence'
);
select is(
  pg_temp.eb_obs('eb-validate-activation')->>'after', pg_temp.eb_obs('eb-validate-activation')->>'before',
  'EB create validation: the forged-activation-evidence refusal wrote nothing'
);
select pg_temp.eb_probe(
  'eb-validate-unknown-field', null,
  pg_temp.eb_create_sql('eb-create-unknown-field-0001', jsonb_build_object(
    'values', jsonb_build_object('a9100000-0000-4000-8000-0000000009d1', 'orphan value'))));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-validate-unknown-field')), 'P0001|VALIDATION_FAILED|["/fields/a9100000-0000-4000-8000-0000000009d1"]|-',
  'EB create validation: a value keyed by an id that is no field of the version is VALIDATION_FAILED at that field pointer'
);
select is(
  pg_temp.eb_obs('eb-validate-unknown-field')->>'after', pg_temp.eb_obs('eb-validate-unknown-field')->>'before',
  'EB create validation: the unknown-field-value refusal wrote nothing'
);
select pg_temp.eb_probe(
  'eb-validate-wrong-kind', null,
  pg_temp.eb_create_sql('eb-create-wrong-kind-0001', jsonb_build_object(
    'values', jsonb_build_object((select value from s10_ids where key = 'typeFieldId'), true))));
select is(
  pg_temp.eb_obs('eb-validate-wrong-kind')->>'state' || ':' || (pg_temp.eb_obs('eb-validate-wrong-kind')->>'message'), 'P0001:VALIDATION_FAILED',
  'EB create validation: a boolean value in a short_text field is VALIDATION_FAILED'
);
select is(
  pg_temp.eb_obs('eb-validate-wrong-kind')->>'after', pg_temp.eb_obs('eb-validate-wrong-kind')->>'before',
  'EB create validation: the wrong-kind-value refusal wrote nothing'
);

-- A create names no existing resource: every member that would fabricate one is an unknown member of the body.
select pg_temp.eb_probe('eb-fabricated-ifmatch', null, pg_temp.eb_create_sql('eb-create-ifmatch-0001', jsonb_build_object('ifMatch', '1')));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-fabricated-ifmatch')), 'P0001|INVALID_REQUEST|-|-',
  'EB create precondition: a create carrying an If-Match member is INVALID_REQUEST'
);
select is(
  pg_temp.eb_obs('eb-fabricated-ifmatch')->>'after', pg_temp.eb_obs('eb-fabricated-ifmatch')->>'before',
  'EB create precondition: the If-Match-carrying create wrote nothing'
);
select pg_temp.eb_probe('eb-fabricated-expected', null, pg_temp.eb_create_sql('eb-create-expected-0001', jsonb_build_object('expectedVersion', '1')));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-fabricated-expected')), 'P0001|INVALID_REQUEST|-|-',
  'EB create precondition: a create carrying an expectedVersion member is INVALID_REQUEST'
);
select pg_temp.eb_probe('eb-fabricated-base', null, pg_temp.eb_create_sql('eb-create-base-0001', jsonb_build_object('baseRevision', '1')));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-fabricated-base')), 'P0001|INVALID_REQUEST|-|-',
  'EB create precondition: a create carrying a baseRevision member is INVALID_REQUEST'
);
select pg_temp.eb_probe('eb-fabricated-owner', null, pg_temp.eb_create_sql('eb-create-owner-0001', jsonb_build_object('ownerId', (select value from s10_ids where key = 'organization'))));
select is(
  pg_temp.eb_shape(pg_temp.eb_obs('eb-fabricated-owner')), 'P0001|INVALID_REQUEST|-|-',
  'EB create authority: a create carrying an ownerId member is INVALID_REQUEST and nothing is written'
);
select is(
  pg_temp.eb_obs('eb-fabricated-owner')->>'after', pg_temp.eb_obs('eb-fabricated-owner')->>'before',
  'EB create authority: the ownerId-carrying create wrote nothing'
);
select pg_temp.eb_probe('eb-created-version-one', null, pg_temp.eb_create_sql('eb-create-version-one-0001'));
select is(
  pg_temp.eb_obs('eb-created-version-one')->'response'->'entry'->>'version', '1',
  'EB create precondition: the entry version of a created entry is the server-derived 1'
);

select * from finish();
rollback;
