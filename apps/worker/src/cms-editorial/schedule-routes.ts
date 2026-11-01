import {
  CmsPublicationScheduleHeadersSchema,
  PublicationScheduleRequestSchema,
  PublicationScheduleResourceSchema,
  type PreflightEvidence,
  type PublicationScheduleRequest,
  type PublicationScheduleResource,
} from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import { dependencyUnavailable } from './admission-deadline';
import { registerWorkflowCommand } from './workflow-command';
import { accessibilityEvidence, policyFor } from './workflow-support';
import { timeAuthorityOf, timeRefusal } from './workflow-time-authority';
import {
  CMS_EDITORIAL_SCHEDULE_OPERATION_ID,
  type CmsEditorialDependencies,
  type CmsEditorialSchedulePortInput,
} from './types';

const policy = policyFor(CMS_EDITORIAL_SCHEDULE_OPERATION_ID);

/**
 * CMS-03B-07 schedule a publication action. The Worker owns the time rules
 * (E8): the zone, pinned tzdb version, gap/fold, resolved instant and horizon
 * are verified over the pinned snapshot before the RPC, which re-checks only
 * what needs no tz rules. `202` means scheduled, never published.
 */
export const registerCmsEditorialScheduleRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void =>
  registerWorkflowCommand<
    E,
    Record<never, never>,
    PublicationScheduleRequest,
    PublicationScheduleResource,
    CmsEditorialSchedulePortInput,
    PreflightEvidence | null
  >(app, dependencies, {
    policy,
    honoPath: '/api/v1/cms/publication-schedules',
    bodySchema: PublicationScheduleRequestSchema,
    headersSchema: CmsPublicationScheduleHeadersSchema,
    path: () => ({ ok: true, value: {} }),
    agree: () => null,
    expectedVersion: (body) => body.expectedVersion,
    port: (ports) => ports.schedulePublication,
    prepare: async (context) => {
      const authority = await timeAuthorityOf(context.dependencies);
      if (authority === null) return dependencyUnavailable();
      const resolution = authority.resolveSchedule(context.body, context.nowMs);
      if (!resolution.ok) return timeRefusal(resolution);
      return accessibilityEvidence(context, {
        phase: 'schedule',
        entryId: null,
        revisionId: context.body.revisionId,
      });
    },
    build: (base, _path, body, evidence) => ({
      operationId: CMS_EDITORIAL_SCHEDULE_OPERATION_ID,
      ...base,
      body,
      evidence,
    }),
    resourceSchema: PublicationScheduleResourceSchema,
    accept: (schedule, _path, body) =>
      schedule.state === 'pending' &&
      schedule.revisionId === body.revisionId &&
      schedule.action === body.action &&
      schedule.localDateTime === body.localDateTime &&
      schedule.timezone === body.timezone &&
      schedule.resolvedUtc === body.resolvedUtc &&
      schedule.tzdbVersion === body.tzdbVersion &&
      schedule.disambiguation === body.disambiguation &&
      schedule.audience === body.audience
        ? {
            status: 202,
            etag: `"${schedule.version}"`,
            location: `/api/v1/cms/publication-schedules/${schedule.id}`,
            entryId: schedule.entryId,
          }
        : null,
  });
