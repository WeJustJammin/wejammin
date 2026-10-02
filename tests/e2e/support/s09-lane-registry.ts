import type { ContentSchemaRegistryPorts } from '../../../apps/worker/src/content-schema-registry/types';

import { fixtureHash } from './s09-lane-hash';
import {
  detailFor,
  dryRunResource,
  typeResource,
  versionResource,
} from './s09-lane-registry-views';
import {
  conflict,
  fail,
  invalid,
  notFound,
  ok,
  unavailable,
  versionMismatch,
} from './s09-lane-result';
import { createLaneReviewPorts } from './s09-lane-review';
import { bodyOf, laneContext, touch, versionFor } from './s09-lane-support';
import { ID_KIND, iso, nextId, type VersionRecord, type World } from './s09-lane-world';

const newVersion = (
  world: World,
  base: Pick<VersionRecord, 'typeId' | 'typeKey' | 'label' | 'locale'>,
  versionNo: number,
): VersionRecord => {
  const now = iso(Date.now());
  const version: VersionRecord = {
    ...base,
    id: nextId(world, ID_KIND.version),
    artifactId: nextId(world, ID_KIND.artifact),
    versionNo,
    rev: 1,
    state: 'draft',
    dryRunId: null,
    reviewId: null,
    activatedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  world.versions.push(version);
  return version;
};

const createTypeDraft: ContentSchemaRegistryPorts['createTypeDraft'] = async (input) => {
  const lane = laneContext(input);
  if (lane === null) return unavailable();
  const { world } = lane;
  const body = bodyOf(input);
  const key = String(body.typeKey);
  if (world.types.some((entry) => entry.key === key))
    return conflict('type_key_exists');
  const type = {
    id: nextId(world, ID_KIND.type),
    key,
    createdAt: iso(Date.now()),
  };
  world.types.push(type);
  const version = newVersion(
    world,
    {
      typeId: type.id,
      typeKey: key,
      label: String(body.label),
      locale: {
        sourceLocale: String(body.sourceLocale),
        defaultLocale: String(body.defaultLocale),
        supportedLocales: [...(body.supportedLocales as string[])],
        fallbackChains: structuredClone(body.fallbackChains) as Record<string, string[]>,
      },
    },
    1,
  );
  return ok(versionResource(world, version)) as never;
};

const listContentTypes: ContentSchemaRegistryPorts['listContentTypes'] = async (input) => {
  const lane = laneContext(input);
  if (lane === null) return unavailable();
  const { world } = lane;
  const items = world.types.flatMap((type) => [
    typeResource(world, type.id),
    ...world.versions
      .filter((entry) => entry.typeId === type.id)
      .map((entry) => versionResource(world, entry)),
  ]);
  return ok({ items, nextCursor: null }) as never;
};

const getContentTypeVersion: ContentSchemaRegistryPorts['getContentTypeVersion'] = async (input) => {
  const lane = laneContext(input);
  if (lane === null) return unavailable();
  const version = versionFor(lane.world, input);
  return version === null
    ? notFound()
    : (ok(detailFor(lane.world, version)) as never);
};

const startSchemaDryRun: ContentSchemaRegistryPorts['startSchemaDryRun'] = async (input) => {
  const lane = laneContext(input);
  if (lane === null) return unavailable();
  const { world, claim } = lane;
  const version = versionFor(world, input);
  if (version === null) return notFound();
  if (bodyOf(input).expectedVersion !== String(version.rev))
    return versionMismatch();
  if (version.state !== 'draft') return conflict('not_a_draft');
  const current = world.dryRuns.find((entry) => entry.id === version.dryRunId);
  if (current !== undefined && current.state !== 'completed')
    return conflict('dry_run_in_progress');
  const now = iso(Date.now());
  const run = {
    id: nextId(world, ID_KIND.dryRun),
    jobId: nextId(world, ID_KIND.job),
    versionId: version.id,
    attemptId: nextId(world, ID_KIND.attempt),
    planId: nextId(world, ID_KIND.plan),
    version: 1,
    state: 'queued' as const,
    result: null,
    createdAt: now,
    updatedAt: now,
    sourceCount: null,
    targetCount: null,
    rowErrorCount: null,
    sourceHash: null,
    targetHash: null,
    reportHash: null,
  };
  world.dryRuns.push(run);
  world.jobs.push({
    id: run.jobId,
    actor: claim.role,
    dryRunId: run.id,
    reads: 0,
    createdAt: now,
  });
  version.dryRunId = run.id;
  touch(version);
  return ok(dryRunResource(run, version)) as never;
};

const createSchemaSuccessor: ContentSchemaRegistryPorts['createSchemaSuccessor'] = async (input) => {
  const lane = laneContext(input);
  if (lane === null) return unavailable();
  const { world } = lane;
  const source = versionFor(world, input);
  if (source === null) return notFound();
  const body = bodyOf(input);
  if (body.expectedVersion !== String(source.rev)) return versionMismatch();
  if (source.state !== 'active') return conflict('source_not_active');
  const replacing = body.supportedLocales !== null;
  const locale = replacing
    ? {
        sourceLocale: source.locale.sourceLocale,
        defaultLocale: source.locale.defaultLocale,
        supportedLocales: [...(body.supportedLocales as string[])],
        fallbackChains: structuredClone(body.fallbackChains) as Record<string, string[]>,
      }
    : structuredClone(source.locale);
  if (
    !locale.supportedLocales.includes(locale.sourceLocale) ||
    !locale.supportedLocales.includes(locale.defaultLocale)
  )
    return invalid('inherited_locale_unsupported');
  const next = newVersion(
    world,
    { typeId: source.typeId, typeKey: source.typeKey, label: source.label, locale },
    source.versionNo + 1,
  );
  return ok(versionResource(world, next)) as never;
};

const activateSchema: ContentSchemaRegistryPorts['activateSchema'] = async (input) => {
  const lane = laneContext(input);
  if (lane === null) return unavailable();
  const { world } = lane;
  const version = versionFor(world, input);
  if (version === null) return notFound();
  const body = bodyOf(input);
  if (body.expectedVersion !== String(version.rev)) return versionMismatch();
  const review = world.reviews.find((entry) => entry.id === version.reviewId);
  if (version.state !== 'approved' || review?.state !== 'approved')
    return conflict('review_not_approved');
  if (body.dryRunId !== version.dryRunId) return conflict('dry_run_mismatch');
  const approvals = review.decisions
    .filter((entry) => entry.decision === 'approve')
    .map((entry) => entry.id);
  const given = body.approvalIds as string[];
  if (given.length !== approvals.length || !given.every((id) => approvals.includes(id)))
    return conflict('approval_set_mismatch');
  for (const entry of world.versions)
    if (entry.typeId === version.typeId && entry.state === 'active') {
      entry.state = 'superseded';
      touch(entry);
    }
  version.state = 'active';
  version.activatedAt = iso(Date.now());
  touch(version);
  const resource = versionResource(world, version);
  return ok({
    id: version.id,
    version: String(version.rev),
    contentHash: fixtureHash(`activation:${version.id}`),
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    state: 'active' as const,
    contentTypeVersionId: version.id,
    activatedAt: version.activatedAt,
    migrationPlanId: (body.migrationPlanId as string | null) ?? null,
    localeConfigHash: resource.localeConfigHash,
    activationEvidence: resource.activationEvidence,
    jobId: null,
    eventType: 'cms.schema.activated.v1' as const,
  }) as never;
};

const refused = async () => lanePlaceholderRefusal();
const lanePlaceholderRefusal = () =>
  fail(503, 'DEPENDENCY_UNAVAILABLE', 'This producer is not part of the Slice 09 lane.', {
    dependencyClass: 'cms_registry',
    retryable: false,
  });

export const laneRegistryPorts = {
  createTypeDraft,
  listContentTypes,
  getContentTypeVersion,
  startSchemaDryRun,
  createSchemaSuccessor,
  activateSchema,
  ...createLaneReviewPorts(),
  addFieldDefinition: refused,
  bindRelation: refused,
  registerBlock: refused,
  advanceBlockLifecycle: refused,
} as unknown as Partial<ContentSchemaRegistryPorts>;

