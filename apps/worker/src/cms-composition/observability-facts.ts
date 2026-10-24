import {
  CanonicalDomainSchema,
  CmsSlice12ReasonCodeSchema,
  type CanonicalDomain,
  type CmsSlice12ReasonCode,
  type GovernedSubjectKind,
} from '@wejammin/contracts';

/**
 * The closed facts a Slice 12 request leaves for its one telemetry event, kept per `Request` (the same
 * mechanism as the Slice 11 `route-stages`): a route notes a fact where it learns it and never has to carry an
 * object to the event builder. Every member is a closed value; nothing here can hold an identifier, a label,
 * a locale, a hash, a message or a person.
 */

/** A refusal as it was PUBLISHED (after the operation's catalog projection), reduced to closed members. */
export type PublishedRefusal = Readonly<{
  status: number;
  /** The catalog error code as published, only when it has the catalog shape. */
  code?: string;
  reasonCode?: CmsSlice12ReasonCode;
  domain?: CanonicalDomain;
}>;

export type RequestFacts = {
  /** CMS-03C-06: the decoded body's subject kind. */
  subjectKind?: GovernedSubjectKind;
  /** CMS-03C-07: the decoded body's decision. */
  decision?: 'approve' | 'reject';
  /** CMS-03C-15: the decoded body's action. */
  updateAction?: 'accept' | 'detach';
  refusal?: PublishedRefusal;
  /** Stage names (`observability-registry` trace vocabulary) the request really entered, in entry order. */
  stages: string[];
  /** The verified session's acting context: a party, or none. */
  actingContext?: 'none' | 'party';
};

const store = new WeakMap<Request, RequestFacts>();

export const factsOf = (request: Request): RequestFacts => {
  const existing = store.get(request);
  if (existing !== undefined) return existing;
  const created: RequestFacts = { stages: [] };
  store.set(request, created);
  return created;
};

export const noteFacts = (
  request: Request,
  patch: Partial<Omit<RequestFacts, 'stages' | 'refusal'>>,
): void => {
  Object.assign(factsOf(request), patch);
};

const record = (value: unknown): Readonly<Record<string, unknown>> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;

const ERROR_CODE = /^[A-Z][A-Z_]{2,59}$/u;

/**
 * Notes the refusal a route published. Only the status, the catalog `code`, a `reasonCode` from the closed
 * Slice 12 token list and a `domain` from the closed canonical domains survive; the message, violations,
 * canonical id and every other member are dropped here, so a later reader cannot leak them.
 */
export const noteRefusal = (
  request: Request,
  status: number,
  details: unknown,
  code?: string,
): void => {
  const source = record(details);
  const reason = CmsSlice12ReasonCodeSchema.safeParse(source?.reasonCode);
  const domain = CanonicalDomainSchema.safeParse(source?.domain);
  factsOf(request).refusal = {
    status,
    ...(code !== undefined && ERROR_CODE.test(code) ? { code } : {}),
    ...(reason.success ? { reasonCode: reason.data } : {}),
    ...(domain.success ? { domain: domain.data } : {}),
  };
};

export const noteStage = (request: Request, stage: string): void => {
  const stages = factsOf(request).stages;
  if (!stages.includes(stage)) stages.push(stage);
};
