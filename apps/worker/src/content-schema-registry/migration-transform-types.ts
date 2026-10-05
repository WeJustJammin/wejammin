/** Types of the code-owned migration transform registry (BE03a "transform registry"). */

/** A JSON document read from one affected source row. */
export type SourceDocument = Readonly<Record<string, unknown>>;

/**
 * One changed or added target field a scan evaluates, supplied by the
 * source-read RPC (never by the plan or a caller). `defaultValue` is
 * meaningful only when
 * `defaultMode` is `literal`. `constraints` is the compiled target constraint
 * object for the field (`null` when the page carried none), validated by
 * `migration-target-validator.ts`.
 */
export type TargetFieldSpec = Readonly<{
  fieldKey: string;
  kind: string;
  required: boolean;
  defaultMode: string;
  defaultValue: unknown;
  constraints: Readonly<Record<string, unknown>> | null;
}>;

/**
 * Per-page scan context from the source-read RPC. `targetFields` are every
 * changed/added field of the candidate (transforms apply per field);
 * `retiredFields` are field keys the successor removes or deprecates, whose
 * values are carried unvalidated.
 */
export type TransformContext = Readonly<{
  targetFields: readonly TargetFieldSpec[];
  retiredFields: readonly string[];
}>;

/**
 * One registry member. `apply` is a pure function of one source row with no
 * I/O, clock or randomness; it throws an error carrying a
 * `^[A-Z][A-Z0-9_]{0,63}$` `code` for a row it cannot transform.
 * `carriesSourceHash` marks an identity member whose `output_hash` equals the
 * row `source_hash`.
 */
export type TransformRegistryEntry = Readonly<{
  key: string;
  version: number;
  digest: string;
  sourceConstraints: Readonly<Record<string, unknown>>;
  targetConstraints: Readonly<Record<string, unknown>>;
  acceptedFieldKinds: readonly string[];
  carriesSourceHash?: boolean;
  apply: (document: SourceDocument, context: TransformContext) => unknown;
}>;

export type TransformRegistry = readonly TransformRegistryEntry[];

/** Per-row evidence posted on the batch RPCs; exactly these five keys. */
export type RowEvidenceEntry = Readonly<{
  sourceTable: string;
  sourceRowId: string;
  sourceHash: string;
  outputHash: string | null;
  errorCode: string | null;
}>;

export type SourceRow = Readonly<{
  sourceTable: string;
  sourceRowId: string;
  sourceHash: string;
  document: SourceDocument;
}>;

export type SourcePage = Readonly<{
  rows: readonly SourceRow[];
  nextCursor: string;
  done: boolean;
  targetFields: readonly TargetFieldSpec[];
  retiredFields: readonly string[];
}>;
