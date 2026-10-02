#!/usr/bin/env node

/**
 * AC217 local evidence runner. Every call is a fresh `psql` process, so the
 * lease/cursor proof crosses committed PostgreSQL sessions. Run only against
 * the disposable local Supabase database right after `pnpm db:reset`: the owner
 * is initialized with the one-time operator command, and immutable rows are
 * retained by the database contract until the next local reset.
 *
 * DEC-108: the recovery candidate is produced ONLY through the named commands
 * (create -> dry-run -> worker seal -> submit -> assign -> decide -> activate,
 * then successor -> 128 fields -> dry-run -> seal -> submit -> assign ->
 * decide).  The runner never inserts a review, decision, dry-run report,
 * approved version or plan row, and never writes an evidence column.
 */
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

const container = process.env.AC217_DB_CONTAINER ?? 'supabase_db_wejammin';
const userId = randomUUID();
const reviewerId = randomUUID();
const ownerEmail = `ac217-owner-${randomUUID().slice(0, 8)}@example.test`;
const correlationId = randomUUID();
const typeKey = `ac217_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${sql(JSON.stringify(value))}::jsonb`;

const psqlArgs = (statement) => [
  'exec',
  '-i',
  container,
  'psql',
  '-X',
  '-v',
  'ON_ERROR_STOP=1',
  '-U',
  'postgres',
  '-d',
  'postgres',
  '-At',
  '-c',
  statement,
];

const runSql = (statement) => {
  const result = spawnSync('docker', psqlArgs(statement), {
    encoding: 'utf8',
    timeout: 30_000,
    killSignal: 'SIGKILL',
  });
  if (result.error || result.status !== 0) {
    const detail = (result.stderr || result.error?.message || 'psql failed')
      .trim()
      .split('\n')
      .slice(-4)
      .join(' ');
    throw new Error(`local PostgreSQL session failed: ${detail}`);
  }
  return result.stdout.trim();
};

const runSqlAsync = (statement) =>
  new Promise((resolve, reject) => {
    const child = spawn('docker', psqlArgs(statement), { encoding: 'utf8' });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, 30_000);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error('local PostgreSQL session exceeded 30 seconds'));
        return;
      }
      if (code !== 0) {
        reject(
          new Error(
            `local PostgreSQL session failed: ${stderr.trim().split('\n').slice(-4).join(' ')}`,
          ),
        );
        return;
      }
      resolve(stdout.trim());
    });
  });

const lastLine = (output) =>
  output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
const runJson = (statement) => JSON.parse(lastLine(runSql(statement)));
const runJsonAsync = async (statement) =>
  JSON.parse(lastLine(await runSqlAsync(statement)));
const runValue = (statement) => lastLine(runSql(statement));
const stableJson = (value) =>
  Array.isArray(value)
    ? value.map(stableJson)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stableJson(value[key])]),
        )
      : value;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const workerContext =
  "select set_config('request.jwt.claim.role','service_role',true); select set_config('app.cms_rpc','true',true);";
const call = (name, request) =>
  runJson(`${workerContext} select platform_api.${name}(${json(request)});`);
const callAsync = (name, request) =>
  runJsonAsync(
    `${workerContext} select platform_api.${name}(${json(request)});`,
  );

const scalar = (statement) => runValue(statement);
const versionOf = (versionId) =>
  scalar(
    `select version::text from platform_private.cms_content_type_versions where id=${sql(versionId)}::uuid;`,
  );
const planVersion = (planId) =>
  scalar(
    `select version::text from platform_private.cms_schema_migration_plans where id=${sql(planId)}::uuid;`,
  );
const reviewVersion = (reviewId) =>
  scalar(
    `select version::text from platform_private.cms_schema_reviews where id=${sql(reviewId)}::uuid;`,
  );
const envelope = (actor, withBinding) => ({
  authUserId: actor.authUserId,
  sessionId: randomUUID(),
  actorPersonId: actor.personId,
  actingPartyId: actor.partyId,
  stepUpVerified: true,
  stepUpAt: new Date(Date.now() - 60_000).toISOString(),
  requestId: randomUUID(),
  correlationId: randomUUID(),
  ...(withBinding ? { actingContextId: actor.bindingId } : {}),
});
const human = (actor, name, request, withBinding = false) =>
  call(name, { ...request, context: envelope(actor, withBinding) });
const key = (label) => `ac217-${label}-${randomUUID().slice(0, 8)}`;

// Worker seal of one queued dry-run attempt through the named worker RPCs.
const seal = (planId, versionId) => {
  const plan = call('cms_get_schema_migration_plan', {
    migrationPlanId: planId,
    schemaVersionId: versionId,
    expectedVersion: planVersion(planId),
  });
  const common = {
    migrationPlanId: planId,
    schemaVersionId: versionId,
    cursor: '0',
    transformKey: null,
    transformVersion: null,
    compilerHash: plan.compilerHash,
    sourceHash: plan.sourceHash,
    targetHash: plan.targetHash,
  };
  const claim = call('cms_claim_schema_migration_lease', {
    ...common,
    expectedVersion: planVersion(planId),
    leaseOwner: 'ac217-sealer',
    workerId: 'ac217-sealer',
    leaseDurationMs: '30000',
    now: new Date().toISOString(),
  });
  assert(
    claim.acquired === true,
    'the sealing worker did not acquire the dry-run lease',
  );
  call('cms_process_schema_migration_dry_run_batch', {
    ...common,
    expectedVersion: planVersion(planId),
    limit: '128',
    leaseToken: claim.leaseToken,
    rowEvidence: [],
    correlationId,
    causationId: null,
  });
  return call('cms_finalize_schema_migration_dry_run', {
    ...common,
    schemaVersionId: undefined,
    expectedVersion: planVersion(planId),
    sourceCount: '0',
    targetCount: '0',
    rowErrorCount: '0',
  });
};

// dry-run -> seal -> submit -> assign -> independent decision, as real actors.
const produceApproved = (owner, reviewer, candidate) => {
  const dryRun = human(owner, 'cms_start_schema_dry_run', {
    contentTypeId: candidate.typeId,
    versionId: candidate.versionId,
    expectedVersion: versionOf(candidate.versionId),
    transformKey: null,
    transformVersion: null,
    idempotencyKey: key('dry'),
  });
  assert(
    dryRun.state === 'queued',
    'the dry-run attempt was not accepted as queued',
  );
  seal(dryRun.migrationPlanId, candidate.versionId);
  const review = human(
    owner,
    'cms_submit_schema_review',
    {
      contentTypeId: candidate.typeId,
      versionId: candidate.versionId,
      expectedVersion: versionOf(candidate.versionId),
      dryRunId: dryRun.id,
      idempotencyKey: key('submit'),
    },
    true,
  );
  human(
    owner,
    'cms_assign_schema_review',
    {
      reviewId: review.id,
      action: 'create',
      expectedVersion: reviewVersion(review.id),
      reviewerPersonId: reviewer.personId,
      expiresAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
      idempotencyKey: key('assign'),
    },
    true,
  );
  const decision = human(
    reviewer,
    'cms_decide_schema_review',
    {
      reviewId: review.id,
      expectedVersion: reviewVersion(review.id),
      decision: 'approve',
      idempotencyKey: key('decide'),
    },
    true,
  );
  return {
    dryRunId: dryRun.id,
    planId: dryRun.migrationPlanId,
    reviewId: review.id,
    decisionId: decision.id,
  };
};

const storedEvidence = (versionId) => {
  const stored = runJson(
    `select jsonb_build_object('artifactId',artifact.id,'artifactHash',artifact.artifact_hash,
  'recomputed',platform_private.cms_jcs_sha256(jsonb_build_object('compilerVersion',artifact.compiler_version,
    'zodContractRef',artifact.zod_contract_ref,'editorManifest',artifact.editor_manifest,
    'rendererManifest',artifact.renderer_manifest,
    'localeConfigHash',(select version_row.locale_config_hash
      from platform_private.cms_content_type_versions version_row
      where version_row.id=artifact.content_type_version_id))),
  'fieldCount',jsonb_array_length(artifact.editor_manifest->'schema'->'fields'),
  'bounded',platform_private.cms_compiled_manifest_bounded(artifact.editor_manifest)
    and platform_private.cms_compiled_manifest_bounded(artifact.renderer_manifest))
from platform_private.cms_schema_artifacts artifact where artifact.content_type_version_id=${sql(versionId)}::uuid;`,
  );
  assert(
    stored.fieldCount === 128 &&
      stored.bounded === true &&
      stored.recomputed === stored.artifactHash,
    'persisted 128-field artifact is not the versioned compiler composition',
  );
  return stored;
};

const main = async () => {
  runSql(
    `begin; insert into auth.users(id,email,email_confirmed_at) values (${sql(userId)}::uuid,${sql(ownerEmail)},clock_timestamp()),(${sql(reviewerId)}::uuid,${sql(`reviewer-${ownerEmail}`)},clock_timestamp()); commit;`,
  );
  for (const [id, a, b] of [
    [userId, '11', '21'],
    [reviewerId, '12', '22'],
  ])
    runSql(
      `select platform_api.auth_bootstrap(${sql(id)}::uuid,decode(repeat(${sql(a)},32),'hex'),decode(repeat(${sql(b)},32),'hex'),${sql(randomUUID())}::uuid,${sql(randomUUID())}::uuid);`,
    );
  const personOf = (id) =>
    scalar(
      `select person_id::text from identity.auth_user_bindings where auth_user_id=${sql(id)}::uuid;`,
    );
  const ownerPerson = personOf(userId);
  const reviewerPerson = personOf(reviewerId);
  let init;
  try {
    init = runJson(
      `select platform_private.initialize_cms_owner(${sql(userId)}::uuid,${sql(ownerPerson)}::uuid,${sql(ownerEmail)},clock_timestamp()+interval '3 days',${sql(randomUUID())}::uuid,false);`,
    );
  } catch (error) {
    throw new Error(
      `owner initialization needs a freshly reset database (${error.message})`,
      { cause: error },
    );
  }
  const organizationId = init.organizationId;
  assert(
    typeof organizationId === 'string',
    'owner initialization returned no organization',
  );
  const binding = (person, party, kind, client) =>
    scalar(
      `with inserted as (insert into platform_private.acting_context_binding(person_id,acting_party_id,context_kind,client_binding_id,state,selected_at,last_seen_at,expires_at,projection_version,version) values (${sql(person)}::uuid,${sql(party)}::uuid,${sql(kind)},${sql(client)},'active',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '1 hour',1,1) returning id) select id::text from inserted;`,
    );
  const owner = {
    authUserId: userId,
    personId: ownerPerson,
    partyId: organizationId,
    bindingId: binding(
      ownerPerson,
      organizationId,
      'organization',
      'ac217-owner-session',
    ),
  };
  const reviewer = {
    authUserId: reviewerId,
    personId: reviewerPerson,
    partyId: reviewerPerson,
    bindingId: binding(
      reviewerPerson,
      reviewerPerson,
      'person',
      'ac217-reviewer-session',
    ),
  };

  // Active source (version 1, no fields) through the real human chain.
  const created = human(owner, 'cms_create_type_draft', {
    typeKey,
    label: 'AC217 recovery',
    ownerCapability: 'cms.schema_designer',
    sourceLocale: 'en-US',
    defaultLocale: 'en-US',
    supportedLocales: ['en-US'],
    fallbackChains: {},
    workflowKey: 'editorial',
    workflowVersion: '1',
    defaultTemplateVersionId: null,
    fields: [],
    relations: [],
    templateBindings: [],
    capabilityBindings: [],
    idempotencyKey: key('create'),
  });
  const source = { typeId: created.contentTypeId, versionId: created.id };
  const sourceEvidence = produceApproved(owner, reviewer, source);
  const sourceActivation = human(
    owner,
    'cms_activate_schema',
    {
      contentTypeId: source.typeId,
      versionId: source.versionId,
      expectedVersion: versionOf(source.versionId),
      dryRunId: sourceEvidence.dryRunId,
      approvalIds: [sourceEvidence.decisionId],
      migrationPlanId: sourceEvidence.planId,
      idempotencyKey: key('activate-source'),
    },
    true,
  );
  assert(sourceActivation.state === 'active', 'source schema did not activate');

  // 128-field successor through the real successor and field commands.
  const successor = human(owner, 'cms_create_schema_successor', {
    contentTypeId: source.typeId,
    versionId: source.versionId,
    expectedVersion: versionOf(source.versionId),
    idempotencyKey: key('successor'),
  });
  const typeId = source.typeId;
  const sourceId = source.versionId;
  const targetId = successor.id;
  runSql(`begin; ${workerContext}
do $fields$ declare i integer; begin
  for i in 1..128 loop
    perform platform_api.cms_add_field_definition(jsonb_build_object(
      'contentTypeId', ${sql(typeId)}::uuid, 'versionId', ${sql(targetId)}::uuid,
      'field', jsonb_build_object('key','field_' || lpad(i::text,3,'0'),'kind','short_text',
        'constraints','{}'::jsonb,'required',false,'validatorKey',null,'validatorVersion',null,
        'defaultMode','none','localizationMode','none',
        'editorConfig',jsonb_build_object('label','Field ' || i,'order',i),'lifecycle','active'),
      'migrationPlanId', null,
      'expectedVersion', (select version::text from platform_private.cms_content_type_versions where id=${sql(targetId)}::uuid),
      'idempotencyKey', 'ac217-field-' || i || '-${randomUUID().slice(0, 8)}',
      'context', ${json(envelope(owner, false))}));
  end loop;
end $fields$;
commit;`);
  const targetEvidence = produceApproved(owner, reviewer, {
    typeId,
    versionId: targetId,
  });
  const planId = targetEvidence.planId;
  const artifact = storedEvidence(targetId);
  const plan = call('cms_get_schema_migration_plan', {
    migrationPlanId: planId,
    schemaVersionId: targetId,
    expectedVersion: planVersion(planId),
  });
  const base = {
    compilerHash: plan.compilerHash,
    sourceHash: plan.sourceHash,
    targetHash: plan.targetHash,
  };
  assert(
    base.compilerHash === artifact.artifactHash,
    'the plan compiler hash is not the persisted 128-field artifact hash',
  );
  const v0 = BigInt(planVersion(planId));
  const common = {
    migrationPlanId: planId,
    schemaVersionId: targetId,
    ...base,
  };
  const claimOne = call('cms_claim_schema_migration_lease', {
    ...common,
    expectedVersion: String(v0),
    cursor: '0',
    leaseOwner: 'ac217-worker-a',
    workerId: 'ac217-worker-a',
    leaseDurationMs: '1',
    now: new Date().toISOString(),
    transformKey: null,
    transformVersion: null,
  });
  assert(
    claimOne.acquired === true && claimOne.plan.cursor === '0',
    'worker A did not acquire the committed lease',
  );
  const persisted = runJson(
    `select jsonb_build_object('version',version::text,'cursor',cursor::text,'state',state) from platform_private.cms_schema_migration_plans where id=${sql(planId)}::uuid;`,
  );
  assert(
    persisted.version === String(v0 + 1n) && persisted.cursor === '0',
    'worker A lease/version was not visible to a new committed session',
  );

  const claimTwo = call('cms_claim_schema_migration_lease', {
    ...common,
    expectedVersion: String(v0 + 1n),
    cursor: '0',
    leaseOwner: 'ac217-worker-b',
    workerId: 'ac217-worker-b',
    leaseDurationMs: '5000',
    now: new Date(Date.now() + 16 * 60_000).toISOString(),
    transformKey: null,
    transformVersion: null,
  });
  assert(
    claimTwo.acquired === true && claimTwo.plan.cursor === '0',
    'worker B did not resume the expired durable lease',
  );
  const batch = call('cms_process_schema_migration_batch', {
    ...common,
    expectedVersion: String(v0 + 2n),
    cursor: '0',
    limit: '128',
    leaseToken: claimTwo.leaseToken,
    rowEvidence: [],
    transformKey: null,
    transformVersion: null,
    correlationId,
    causationId: null,
  });
  assert(
    batch.done === true && batch.cursor === '0' && batch.migratedCount === '0',
    'worker B fabricated application rows for the zero-row plan',
  );
  const begin = call('cms_begin_schema_migration_verification', {
    migrationPlanId: planId,
    expectedVersion: String(v0 + 2n),
    cursor: '0',
    sourceCount: '0',
    targetCount: '0',
    rowErrorCount: '0',
    migratedCount: '0',
    failedCount: '0',
    transformKey: null,
    transformVersion: null,
    ...base,
  });
  assert(
    begin.state === 'verifying' && begin.version === String(v0 + 3n),
    'verification did not follow the committed restart',
  );
  const verified = call('cms_verify_schema_migration', {
    migrationPlanId: planId,
    schemaVersionId: targetId,
    expectedVersion: String(v0 + 3n),
    cursor: '0',
    leaseToken: claimTwo.leaseToken,
    sourceCount: '0',
    targetCount: '0',
    rowErrorCount: '0',
    migratedCount: '0',
    failedCount: '0',
    transformKey: null,
    transformVersion: null,
    ...base,
  });
  assert(
    verified.valid === true,
    'production verifier rejected truthful zero-row counters',
  );
  const completed = call('cms_complete_schema_migration', {
    migrationPlanId: planId,
    expectedVersion: String(v0 + 3n),
    leaseToken: claimTwo.leaseToken,
  });
  assert(
    completed.state === 'completed' && completed.cursor === '0',
    'completed plan fabricated a durable cursor',
  );

  const activationRequest = {
    migrationPlanId: planId,
    contentTypeId: typeId,
    schemaVersionId: targetId,
    expectedVersion: completed.version,
    expectedActiveVersionId: sourceId,
    transformKey: null,
    transformVersion: null,
    ...base,
    idempotencyKey: 'ac217-independent-activation-race',
    switchOnlyOnce: true,
  };
  const race = await Promise.allSettled([
    callAsync('cms_activate_schema_migration', activationRequest),
    callAsync('cms_activate_schema_migration', activationRequest),
  ]);
  assert(
    race.every((result) => result.status === 'fulfilled'),
    'concurrent activation sessions did not both complete',
  );
  const activationA = race[0].value;
  const activationB = race[1].value;
  assert(
    JSON.stringify(stableJson(activationA)) ===
      JSON.stringify(stableJson(activationB)) &&
      activationA.status === 'activated' &&
      activationA.eventId,
    'same-key activation race was not exactly idempotent',
  );
  const switched = runJson(
    `select jsonb_build_object('active',(select count(*) from platform_private.cms_content_type_versions where content_type_id=${sql(typeId)}::uuid and state='active'),'events',(select count(*) from platform_private.outbox_events where event_type='cms.schema.activated.v1' and payload->>'migrationPlanId'=${sql(planId)}),'compilerHash',(select artifact_hash from platform_private.cms_schema_artifacts where content_type_version_id=${sql(targetId)}::uuid));`,
  );
  assert(
    switched.active === 1 &&
      switched.events === 1 &&
      switched.compilerHash === base.compilerHash,
    'activation race changed active/event cardinality or compiler provenance',
  );

  const eventId = activationA.eventId;
  const eventCommon = {
    eventId,
    eventType: 'cms.schema.activated.v1',
    schemaVersion: '1',
    aggregateType: 'cms_content_type_version',
    aggregateId: targetId,
    aggregateVersion: versionOf(targetId),
    migrationPlanId: planId,
  };
  const initialClaimToken = randomUUID();
  const eventClaim = call('cms_claim_schema_migration_event', {
    ...eventCommon,
    claimToken: initialClaimToken,
    replay: false,
  });
  assert(
    eventClaim.status === 'new',
    'production event claim did not reserve the activation event',
  );
  assert(
    call('cms_dead_letter_schema_migration_event', {
      ...eventCommon,
      claimToken: initialClaimToken,
      reasonCode: 'SIMULATED_WORKER_LOSS',
    }).accepted === true,
    'production DLQ RPC rejected the simulated failure',
  );
  const dlq = runJson(
    `select jsonb_build_object('eventType',event_type,'schemaVersion',schema_version::text,'aggregateId',aggregate_id::text,'aggregateVersion',aggregate_version::text,'deadLettered',dead_lettered_at is not null,'dispatched',dispatched_at is not null,'reason',dead_letter_reason,'errorCode',last_dispatch_error_code,'lease',dispatch_lease_token is null) from platform_private.outbox_events where id=${sql(eventId)}::uuid;`,
  );
  assert(
    dlq.eventType === 'cms.schema.activated.v1' &&
      dlq.schemaVersion === '1' &&
      dlq.aggregateId === targetId &&
      dlq.aggregateVersion === versionOf(targetId) &&
      dlq.deadLettered === true &&
      dlq.dispatched === true &&
      dlq.reason === 'SIMULATED_WORKER_LOSS' &&
      dlq.errorCode === 'SIMULATED_WORKER_LOSS' &&
      dlq.lease === true,
    'production DLQ did not persist the bound event identity and reason',
  );
  const replayTokens = [randomUUID(), randomUUID()];
  const replayRace = await Promise.allSettled(
    replayTokens.map((claimToken) =>
      callAsync('cms_claim_schema_migration_event', {
        ...eventCommon,
        claimToken,
        replay: true,
      }),
    ),
  );
  const replayStatuses = replayRace.map((result) =>
    result.status === 'fulfilled' ? result.value.status : 'rejected',
  );
  assert(
    [...replayStatuses].sort().join(',') === 'in_progress,replayable',
    'concurrent DLQ replay claims did not elect exactly one fenced owner',
  );
  const winningIndex = replayStatuses.indexOf('replayable');
  const replayClaimToken = replayTokens[winningIndex];
  assert(
    typeof replayClaimToken === 'string',
    'concurrent DLQ replay did not retain its winning fence token',
  );
  const acknowledgement = {
    ...eventCommon,
    claimToken: replayClaimToken,
    outcome: 'success',
  };
  const ackRace = await Promise.allSettled([
    callAsync('cms_acknowledge_schema_migration_event', acknowledgement),
    callAsync('cms_acknowledge_schema_migration_event', acknowledgement),
  ]);
  assert(
    ackRace.every(
      (result) =>
        result.status === 'fulfilled' && result.value.accepted === true,
    ),
    'concurrent replay acknowledgements were not idempotent',
  );
  const acknowledged = runJson(
    `select jsonb_build_object('claimState',(select state from platform_private.idempotency_records where actor_id=${sql(eventId)}::uuid and operation='cms.schema.event.claim' and key_hash=platform_private.cms_key_hash(${sql(eventId)})),'deadLettered',(select dead_lettered_at is not null from platform_private.outbox_events where id=${sql(eventId)}::uuid),'eventCount',(select count(*) from platform_private.outbox_events where id=${sql(eventId)}::uuid));`,
  );
  assert(
    acknowledged.claimState === 'completed' &&
      acknowledged.deadLettered === true &&
      acknowledged.eventCount === 1,
    'replay acknowledgement changed durable DLQ state or event cardinality',
  );
  const evidence = {
    sessions: 'committed-independent-psql',
    cursor: 0,
    recovery: 'expired-lease-takeover',
    activationRace: 'same-response-one-event',
    dlq: 'single-fenced-replay-owner',
  };
  console.log(
    'ok - [P2-S09-AC-217] independent committed psql sessions: expired-lease takeover, one fenced DLQ replay owner, one activation event and an exactly-once switch',
  );
  console.log(JSON.stringify({ status: 'passed', evidence }));
};

main().catch((error) => {
  console.error(`AC217 independent-session harness failed: ${error.message}`);
  process.exitCode = 1;
});
