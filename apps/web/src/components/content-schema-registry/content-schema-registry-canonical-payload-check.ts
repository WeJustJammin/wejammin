import type { ContentSchemaRegistryProjectionState } from './content-schema-registry-canonical-projection-state';
import {
  ContractValidatorsNotLoadedError,
  loadedContractValidators,
  type ContractValidators,
} from './content-schema-registry-contract-validators';

/**
 * Strict contract check of the resource payloads inside a canonical
 * projection (list page, detail, review). The server already validated every
 * payload with these schemas before rendering it, so a payload byte-identical
 * to the one the island already holds needs no second validation: that is the
 * common case on the mount read and on every unchanged refresh, and it keeps
 * zod out of the route's initial JavaScript (AC261). Any payload that differs
 * from what is held is validated strictly with the zod schemas, which are
 * loaded on that first need.
 */
export interface CanonicalPayloadCheck {
  readonly list: (data: unknown) => boolean;
  readonly detail: (data: unknown) => boolean;
  readonly review: (data: unknown) => boolean;
}

type Slot = { readonly status: string; readonly data?: unknown } | null;

const heldJson = (slot: Slot | undefined): string | null => {
  if (slot === null || slot === undefined) return null;
  const data = slot.data;
  return data === null || data === undefined ? null : JSON.stringify(data);
};

/**
 * Build the check for one projection. `held` is the projection state the
 * island currently renders; `validators` is whatever is already loaded. A
 * changed payload with no validators loaded throws
 * `ContractValidatorsNotLoadedError`, never a verdict, so the caller loads them
 * and repeats the identical check.
 */
export const createCanonicalPayloadCheck = (
  held: ContentSchemaRegistryProjectionState | null,
  validators: ContractValidators | null = loadedContractValidators(),
): CanonicalPayloadCheck => {
  const verdict = (
    holding: string | null,
    data: unknown,
    parse: (loaded: ContractValidators, value: unknown) => boolean,
  ): boolean => {
    if (holding !== null && JSON.stringify(data) === holding) return true;
    if (validators === null) throw new ContractValidatorsNotLoadedError();
    return parse(validators, data);
  };
  const list = heldJson(held?.initialList);
  const detail = heldJson(held?.initialDetail);
  const review = heldJson(held?.initialReview);
  return {
    list: (data) =>
      verdict(
        list,
        data,
        (loaded, value) =>
          loaded.ContentSchemaRegistryListPageSchema.safeParse(value).success,
      ),
    detail: (data) =>
      verdict(
        detail,
        data,
        (loaded, value) =>
          loaded.ContentSchemaRegistryDetailSchema.safeParse(value).success,
      ),
    review: (data) =>
      verdict(
        review,
        data,
        (loaded, value) =>
          loaded.SchemaReviewResourceSchema.safeParse(value).success,
      ),
  };
};
