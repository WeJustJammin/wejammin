import { useCallback, useEffect, useRef, useState } from 'react';

import { useCmsTemplateRateWait } from '../cms-composition/cms-template-rate-wait';
import type { PatternFormStatus } from './CmsPatternStatus';
import type { PatternVersionFactsProps } from './CmsPatternVersionFacts';
import {
  buildPatternVersionRequest,
  unavailableTypeIds,
  type PatternDesignerContext,
} from './pattern-designer-request';
import { PATTERN_RESULT_HEADING_ID } from './pattern-designer-ids';
import { submitPatternVersion } from './pattern-designer-submit';
import {
  readLatestPatternVersion,
  type PatternLatestDetail,
} from './pattern-latest-read';
import { fromWireTree } from './pattern-tree-state';
import {
  usePatternConflict,
  type PatternBaseIdentity,
} from './use-pattern-conflict';
import { usePatternBlurValidation } from './use-pattern-blur-validation';
import { usePatternTreeEditor } from './use-pattern-tree-editor';
import { usePatternUnknownOutcome } from './use-pattern-unknown-outcome';

export interface PatternDesignerOptions {
  readonly context: PatternDesignerContext;
  /** The owner's latest version when editing; null for a new key. */
  readonly latest: PatternLatestDetail | null;
  readonly csrfToken: string;
  /** Seams for a test. */
  readonly submit?: typeof submitPatternVersion | undefined;
  readonly readLatest?: typeof readLatestPatternVersion | undefined;
}

const makeId = (): string => crypto.randomUUID();

const identityOf = (detail: PatternLatestDetail): PatternBaseIdentity => ({
  id: detail.id,
  version: detail.version,
  contentHash: detail.contentHash,
});

const factsOf = (detail: PatternLatestDetail): PatternVersionFactsProps => ({
  version: detail.version,
  lifecycle: detail.state,
  nodeCount: detail.nodeCount,
  blockRegistryDigest: detail.blockRegistryDigest,
});

/** All state and commands of the pattern designer; the components only render. */
export const usePatternDesigner = ({
  context,
  latest,
  csrfToken,
  submit = submitPatternVersion,
  readLatest = readLatestPatternVersion,
}: PatternDesignerOptions) => {
  const editor = usePatternTreeEditor(
    latest === null ? [] : fromWireTree(latest.blockTree, makeId),
  );
  const [patternKey, setPatternKey] = useState(latest?.patternKey ?? '');
  const [compatibleTypeIds, setCompatibleTypeIds] = useState<readonly string[]>(
    latest?.compatibleTypeIds ?? [],
  );
  // The types the base version names: a retired one stays listed, so it can be removed.
  const [baseTypeIds, setBaseTypeIds] = useState<readonly string[]>(
    latest?.compatibleTypeIds ?? [],
  );
  const [baseVersion, setBaseVersion] = useState<string | null>(
    latest?.version ?? null,
  );
  const [baseIdentity, setBaseIdentity] = useState<PatternBaseIdentity | null>(
    latest === null ? null : identityOf(latest),
  );
  const [baseFacts, setBaseFacts] = useState<PatternVersionFactsProps | null>(
    latest === null ? null : factsOf(latest),
  );
  const [status, setStatus] = useState<PatternFormStatus>({ kind: 'idle' });
  const summaryRef = useRef<HTMLDivElement>(null);
  const rateWait = useCmsTemplateRateWait();
  const conflict = usePatternConflict(
    patternKey.trim(),
    baseIdentity,
    readLatest,
  );
  const outcome = usePatternUnknownOutcome({
    conflict,
    csrfToken,
    submit,
    setStatus,
    startRateWait: rateWait.start,
  });

  useEffect(() => {
    // The named result heading takes focus (FE03 :1108); the region is the fallback.
    if (status.kind !== 'idle' && status.kind !== 'pending')
      (
        document.getElementById(PATTERN_RESULT_HEADING_ID) ?? summaryRef.current
      )?.focus();
  }, [status]);

  const blur = usePatternBlurValidation(patternKey, editor.tree);
  const noTypes = context.contentTypes.length === 0;
  const done = status.kind === 'created';
  const blocked =
    noTypes ||
    csrfToken.length === 0 ||
    rateWait.waiting ||
    done ||
    outcome.unresolved ||
    conflict.state.kind === 'checking' ||
    conflict.state.kind === 'failed';

  const onSubmit = useCallback(async (): Promise<void> => {
    if (blocked || !outcome.canSubmit()) return;
    const prepared = buildPatternVersionRequest(
      {
        patternKey,
        compatibleTypeIds,
        tree: editor.tree,
        expectedVersion: baseVersion,
      },
      context,
    );
    if (!prepared.ok) {
      setStatus({
        kind: 'invalid',
        items: prepared.issues.map(({ message, target }) => ({
          message,
          target,
        })),
      });
      return;
    }
    await outcome.send({ prepared, base: baseIdentity, tree: editor.tree });
  }, [
    baseIdentity,
    baseVersion,
    blocked,
    compatibleTypeIds,
    context,
    editor.tree,
    outcome,
    patternKey,
  ]);

  const toggleType = useCallback((id: string): void => {
    setCompatibleTypeIds((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  }, []);

  const loaded = conflict.verified;
  const rebase = useCallback((): void => {
    if (loaded === null) return;
    outcome.resolve();
    setPatternKey(loaded.patternKey);
    setBaseVersion(loaded.version);
    setBaseFacts(factsOf(loaded));
    setBaseIdentity(identityOf(loaded));
    setBaseTypeIds(loaded.compatibleTypeIds);
    conflict.clear();
    setStatus({ kind: 'idle' });
  }, [conflict, loaded, outcome]);
  const discard = useCallback((): void => {
    if (loaded === null) return;
    outcome.resolve();
    setPatternKey(loaded.patternKey);
    editor.setTree(fromWireTree(loaded.blockTree, makeId));
    setCompatibleTypeIds(loaded.compatibleTypeIds);
    setBaseTypeIds(loaded.compatibleTypeIds);
    setBaseVersion(loaded.version);
    setBaseFacts(factsOf(loaded));
    setBaseIdentity(identityOf(loaded));
    conflict.clear();
    setStatus({ kind: 'idle' });
  }, [conflict, editor, loaded, outcome]);

  return {
    editor,
    patternKey,
    setPatternKey,
    compatibleTypeIds,
    unavailableTypeIds: unavailableTypeIds(
      [...baseTypeIds, ...compatibleTypeIds],
      context,
    ),
    toggleType,
    baseVersion,
    baseFacts,
    status,
    summaryRef,
    blocked,
    blurItems: blur.items,
    onBlur: blur.onBlur,
    pending: status.kind === 'pending',
    done,
    rateWaiting: rateWait.waiting,
    onSubmit,
    conflict: { ...conflict, check: outcome.check, rebase, discard },
    showConflict:
      outcome.checking ||
      (status.kind === 'result' &&
        (status.result.kind === 'conflict' ||
          status.result.kind === 'uncertain')),
  };
};
