import {
  EntryWorkflowQuerySchema,
  EntryWorkflowResourceSchema,
  type EntryWorkflowQuery,
  type EntryWorkflowResource,
  type PreflightEvidence,
} from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import { invalid, issues } from './admission-common';
import { registerWorkflowRead } from './workflow-read';
import {
  accessibilityEvidence,
  closedQuery,
  policyFor,
  representationDigest,
  uuidParam,
} from './workflow-support';
import {
  CMS_EDITORIAL_WORKFLOW_OPERATION_ID,
  type CmsEditorialDependencies,
  type CmsEditorialWorkflowPortInput,
} from './types';

const policy = policyFor(CMS_EDITORIAL_WORKFLOW_OPERATION_ID);
const QUERY_KEYS: ReadonlySet<string> = new Set(['revisionId']);

/**
 * CMS-03B-15 workflow and submission preparation. The preparation is recomputed
 * on every read, never stored, and grants no authority. The accessibility
 * category is evaluated by the in-process checker immediately before the read
 * RPC (the preparation budget includes the 2,000 ms checker), and an
 * unavailable provider is reported inside the preflight report, never as a
 * failure of the read. The strong validator binds the entry, revision, latest
 * review, schedule and publication versions through the caller-scoped digest of
 * the exact representation.
 */
export const registerCmsEditorialWorkflowReadRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void =>
  registerWorkflowRead<
    E,
    Readonly<{ entryId: string }>,
    EntryWorkflowQuery,
    EntryWorkflowResource,
    CmsEditorialWorkflowPortInput,
    PreflightEvidence | null
  >(app, dependencies, {
    policy,
    honoPath: '/api/v1/cms/entries/:entryId/workflow',
    path: uuidParam('entryId'),
    query: (request, path) => {
      const members = closedQuery(request, QUERY_KEYS);
      if (!members.ok) return members;
      const parsed = EntryWorkflowQuerySchema.safeParse({
        entryId: path.entryId,
        ...members.value,
      });
      return parsed.success
        ? { ok: true, value: parsed.data }
        : invalid(
            'The workflow query failed validation.',
            issues(parsed.error),
          );
    },
    port: (ports) => ports.getEntryWorkflow,
    prepare: (context) =>
      accessibilityEvidence(context, {
        phase: 'workflow_read',
        entryId: context.path.entryId,
        revisionId: context.body.revisionId ?? null,
      }),
    build: (base, path, query, evidence) => ({
      operationId: CMS_EDITORIAL_WORKFLOW_OPERATION_ID,
      ...base,
      path,
      query,
      evidence,
    }),
    resourceSchema: EntryWorkflowResourceSchema,
    accept: async (workflow, path, query, session) => {
      if (
        workflow.entry.id !== path.entryId ||
        (query.revisionId !== undefined &&
          workflow.revision.id !== query.revisionId)
      )
        return null;
      const digest = await representationDigest(
        session,
        JSON.stringify(workflow),
      );
      const review = workflow.review;
      return {
        etag: `"${workflow.entry.id}:${workflow.entry.version}:${workflow.revision.id}:${review?.id ?? '0'}:${review?.version ?? '0'}:${digest}"`,
        entryId: workflow.entry.id,
        counts: {
          schedules_returned: workflow.schedules.length,
          publications_returned: workflow.publications.length,
        },
        preflight:
          workflow.preparation?.preflight.results.map(
            ({ category, outcome }) => ({ category, outcome }),
          ) ?? [],
      };
    },
  });
