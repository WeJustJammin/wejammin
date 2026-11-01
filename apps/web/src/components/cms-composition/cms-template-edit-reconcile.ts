import type { TemplateVersionDetail } from '@wejammin/contracts';

import { startReadDeadline } from '../../lib/read-deadline';
import { withinDeadline } from '../../lib/read-within-deadline';
import {
  rateLimitWaitSeconds,
  retryingSafeRead,
} from '../../lib/safe-read-retry';
import {
  loadCmsValidators,
  loadedCmsValidators,
  type CmsValidators,
} from '../../lib/cms-contract-validators';

export type CmsTemplateLatestResult =
  | { readonly kind: 'loaded'; readonly detail: TemplateVersionDetail }
  | {
      readonly kind: 'rejected';
      readonly status: 401 | 403 | 404 | 429;
      /** A 429's stated wait in whole seconds (FE03 :1172); absent when none was stated. */
      readonly retryAfterSeconds?: number;
    }
  | { readonly kind: 'unavailable' };

/** Recheck the authoritative preimage without carrying mutation authority. */
export const readLatestCmsTemplateVersion = async (
  templateKey: string,
  fetcher: typeof fetch = fetch,
): Promise<CmsTemplateLatestResult> => {
  // The schemas load on this first read; if they cannot be fetched the latest
  // version is unverifiable, exactly like an unreachable service.
  let validators: CmsValidators;
  try {
    validators = loadedCmsValidators() ?? (await loadCmsValidators());
  } catch {
    return { kind: 'unavailable' };
  }
  const key = validators.CmsTemplateKeySchema.safeParse(templateKey);
  if (!key.success) return { kind: 'unavailable' };
  // The shared read deadline covers the fetch, its safe retries and the body (DEC-246(1)).
  const deadline = startReadDeadline();
  try {
    let response: Response;
    try {
      // FE03 :1173: a 502/503/504 the BE declares safe is retried twice (250 ms, 750 ms).
      response = await withinDeadline(
        deadline,
        retryingSafeRead(() =>
          fetcher(`/api/v1/cms/templates/${key.data}`, {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'error',
            signal: deadline.signal,
          }),
        ),
      );
    } catch {
      return { kind: 'unavailable' };
    }
    if (!(response instanceof Response)) return { kind: 'unavailable' };
    if ([401, 403, 404, 429].includes(response.status)) {
      const wait =
        response.status === 429
          ? await withinDeadline(deadline, rateLimitWaitSeconds(response))
          : null;
      return {
        kind: 'rejected',
        status: response.status as 401 | 403 | 404 | 429,
        ...(wait === null ? {} : { retryAfterSeconds: wait }),
      };
    }
    if (response.status !== 200) return { kind: 'unavailable' };
    let candidate: unknown;
    try {
      candidate = await withinDeadline(deadline, response.json());
    } catch {
      return { kind: 'unavailable' };
    }
    const detail = validators.TemplateVersionDetailSchema.safeParse(candidate);
    if (
      !detail.success ||
      detail.data.templateKey !== key.data ||
      detail.data.version !== String(detail.data.templateVersion) ||
      response.headers.get('etag') !== `"${detail.data.version}"`
    )
      return { kind: 'unavailable' };
    return { kind: 'loaded', detail: detail.data };
  } catch {
    return { kind: 'unavailable' };
  } finally {
    deadline.clear();
  }
};
