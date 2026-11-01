import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  TemplateVersionDetail,
  TemplateVersionRequest,
  TemplateVersionResource,
} from '@wejammin/contracts';

import { rateLimitMessage } from '../../lib/rate-limit-message';
import {
  readLatestCmsTemplateVersion,
  type CmsTemplateLatestResult,
} from './cms-template-edit-reconcile';
import { reconcileUnknownCreate } from './cms-template-create-reconcile';
import { useCmsTemplateRateWait } from './cms-template-rate-wait';

export type CreateReadState =
  | { readonly kind: 'none' }
  | { readonly kind: 'checking' }
  /** A verified 404 for the key after an unknown outcome: nothing committed. */
  | { readonly kind: 'absent' }
  /** The key holds a template; the comparison is shown beside the unsent values. */
  | { readonly kind: 'existing'; readonly latest: TemplateVersionDetail }
  | {
      readonly kind: 'failed';
      readonly message: string;
      readonly rateLimited: boolean;
    };

const failure = (result: CmsTemplateLatestResult): CreateReadState => {
  if (result.kind === 'rejected' && result.status === 429)
    return {
      kind: 'failed',
      message: rateLimitMessage(result.retryAfterSeconds ?? null),
      rateLimited: true,
    };
  return {
    kind: 'failed',
    rateLimited: false,
    message:
      result.kind === 'rejected' && result.status === 401
        ? 'Your session expired. Sign in again.'
        : result.kind === 'rejected' && result.status === 403
          ? 'Template designer access is required for this acting context.'
          : result.kind === 'rejected' && result.status === 404
            ? 'This template is unavailable to the current acting context.'
            : 'The latest version is unavailable. Wait and try again.',
  };
};

interface Options {
  /** The request of the last attempt (the key and definition to reconcile): a read only follows a send. */
  readonly attempt: () => TemplateVersionRequest;
  /** The read says the unknown write committed: announce it as created. */
  readonly onCreated: (resource: TemplateVersionResource) => void;
}

/**
 * The create designer's automatic read of the template KEY after a 409 or an unknown outcome (FE03 1048,
 * DEC-242 item 3). Reading changes nothing in the form; only a verified answer lifts the hold on a retry.
 */
export const useCmsTemplateCreateReconcile = ({
  attempt,
  onCreated,
}: Options) => {
  const [state, setState] = useState<CreateReadState>({ kind: 'none' });
  const sequence = useRef(0);
  const mounted = useRef(true);
  const wait = useCmsTemplateRateWait();
  const startWait = wait.start;

  // Re-armed on every mount: React.StrictMode runs the cleanup once and mounts again in development.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      sequence.current += 1;
    };
  }, []);

  const check = useCallback(
    async (mode: 'conflict' | 'unknown'): Promise<void> => {
      const request = attempt();
      const mine = ++sequence.current;
      setState({ kind: 'checking' });
      const read = await readLatestCmsTemplateVersion(request.templateKey);
      if (!mounted.current || sequence.current !== mine) return;
      if (read.kind === 'rejected' && read.status === 429) {
        if (read.retryAfterSeconds !== undefined)
          startWait(read.retryAfterSeconds);
        setState(failure(read));
        return;
      }
      if (mode === 'unknown') {
        const verdict = reconcileUnknownCreate(request, read);
        if (verdict.kind === 'created') {
          setState({ kind: 'none' });
          onCreated(verdict.resource);
        } else if (verdict.kind === 'absent') setState({ kind: 'absent' });
        else if (verdict.kind === 'existing')
          setState({ kind: 'existing', latest: verdict.latest });
        else setState(failure(read));
        return;
      }
      setState(
        read.kind === 'loaded'
          ? { kind: 'existing', latest: read.detail }
          : failure(read),
      );
    },
    [attempt, onCreated, startWait],
  );

  const clear = useCallback((): void => {
    sequence.current += 1;
    setState({ kind: 'none' });
  }, []);

  return { state, check, clear, waiting: wait.waiting };
};
