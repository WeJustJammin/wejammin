import {
  CmsTemplateKeySchema,
  TemplateVersionDetailSchema,
} from '@wejammin/contracts';

import {
  cmsEditorialContextFor,
  correlationFor,
} from './cms-editorial-production-session';
import {
  invalidResponse,
  mapCmsEditorialRpcFailure,
  unavailable,
} from './cms-editorial-production-errors';
import {
  createDeadline,
  fetchWithDeadline,
  parseJsonResponse,
  readRpcError,
} from './cms-editorial-production-transport';
import type {
  CmsEditorialProductionConfiguration,
  CmsEditorialServerSessionContext,
} from './cms-editorial-production-types';
import type { CmsTemplateDependencies } from './cms-composition/template-routes';
import { supabaseRpcHeaders } from './supabase-rpc-headers';

/** Only the Worker selects this private read RPC and verified acting context. */
export const createTemplateDetailReader =
  (
    configuration: CmsEditorialProductionConfiguration,
    contexts: WeakMap<Request, CmsEditorialServerSessionContext>,
    deadlineMs: number,
    maxResponseBytes: number,
  ): CmsTemplateDependencies['readLatest'] =>
  async (input, signal) => {
    if (
      input.operationId !== 'cmsTemplateLatestRead' ||
      !CmsTemplateKeySchema.safeParse(input.templateKey).success
    )
      return {
        ok: false,
        status: 400,
        code: 'REJECTED',
        message: 'Template request rejected.',
      };
    if (
      input.session.actingPartyId === null ||
      !input.session.capabilities.includes('cms.template_designer')
    )
      return {
        ok: false,
        status: 403,
        code: 'REJECTED',
        message: 'Template request rejected.',
      };
    const context = cmsEditorialContextFor(input, contexts, configuration.now);
    if (
      context.authUserId !== input.session.userId ||
      context.actingPartyId !== input.session.actingPartyId
    )
      return {
        ok: false,
        status: 401,
        code: 'REJECTED',
        message: 'Template request rejected.',
      };

    const deadline = createDeadline(signal, deadlineMs);
    try {
      const response = await fetchWithDeadline(
        configuration,
        `${configuration.baseUrl}/rest/v1/rpc/cms_template_latest`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Profile': 'platform_api',
            ...supabaseRpcHeaders(configuration.secret),
            'Content-Profile': 'platform_api',
            'Content-Type': 'application/json',
            'X-Operation-Id': 'cmsTemplateLatestRead',
            'X-Request-Id': input.requestId,
            'X-Correlation-Id': correlationFor(input),
          },
          body: JSON.stringify({
            p_request: { templateKey: input.templateKey, context },
          }),
        },
        deadline,
      );
      if (!response.ok) return response;
      if (!response.value.ok) {
        const error = mapCmsEditorialRpcFailure(
          response.value.status,
          await readRpcError(response.value, maxResponseBytes, deadline.signal),
        );
        return deadline.expired()
          ? {
              ok: false,
              status: 504,
              code: 'DEADLINE',
              message: 'Deadline exceeded.',
            }
          : error;
      }
      const parsed = await parseJsonResponse(
        response.value,
        maxResponseBytes,
        deadline.signal,
      );
      if (deadline.expired())
        return {
          ok: false,
          status: 504,
          code: 'DEADLINE',
          message: 'Deadline exceeded.',
        };
      if (!parsed.ok) return parsed;
      const resource = TemplateVersionDetailSchema.safeParse(parsed.value);
      return resource.success && resource.data.templateKey === input.templateKey
        ? { ok: true, value: resource.data }
        : invalidResponse();
    } catch {
      return unavailable('cms_composition');
    } finally {
      deadline.dispose();
    }
  };
