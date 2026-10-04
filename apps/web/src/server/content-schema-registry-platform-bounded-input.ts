import { JSON_VALUE_MAX_BYTES } from '@wejammin/contracts';

import {
  readBoundedRequestBody,
  type BoundedRequestBody,
} from './bounded-request-body';
import { CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS } from './content-schema-registry-platform-shared';
import type { ContentSchemaRegistryMutationOperationId } from './content-schema-registry-platform-shared';

/*
 * Bounded byte reads for the CMS registry browser mutation boundary.
 *
 * BE03a fixes the registry mutation maxBodyBytes at the shared JSON value
 * ceiling. Every browser mutation and every native page probe reads the body
 * at most once, through this module, so the facade and the operation probe can
 * share a single read of a cookie-bearing request instead of parsing a second
 * clone. A refusal (declared oversize, headerless oversize, unreadable) is a
 * non-ok bounded result that callers map onto their own locked status.
 */

/** BE03a maxBodyBytes for the CMS registry browser mutation boundary. */
export const CMS_REGISTRY_MAX_BODY_BYTES = JSON_VALUE_MAX_BYTES;

/**
 * A bounded deadline for the whole body read. An incoming request abort
 * (disconnect, runtime timeout) also ends the read.
 */
const REGISTRY_READ_DEADLINE_MS = 5000;

/** The one bounded read of a request, keyed by the request it belongs to. */
const boundedReads = new WeakMap<Request, Promise<BoundedRequestBody>>();

/**
 * Read the request body once, under the registry ceiling, memoized per request
 * so the facade and the operation probe never tee or re-read the same bytes.
 * The ceiling is the locked registry maximum.
 */
export const readBoundedMutationBody = (
  request: Request,
): Promise<BoundedRequestBody> => {
  const cached = boundedReads.get(request);
  if (cached !== undefined) return cached;
  const read = readBoundedRequestBody(request, {
    maxBytes: CMS_REGISTRY_MAX_BODY_BYTES,
    signal: request.signal,
    deadlineMs: REGISTRY_READ_DEADLINE_MS,
  });
  boundedReads.set(request, read);
  return read;
};

/** The bounded bytes of a request together with the content type to parse it as. */
export type BoundedMutationInput = Readonly<{
  readonly read: BoundedRequestBody;
  readonly contentType: string | null;
}>;

const JSON_CONTENT_TYPE = /^application\/json(?:\s*;|$)/iu;

export const isJsonMutationContentType = (
  contentType: string | null,
): boolean => JSON_CONTENT_TYPE.test(contentType ?? '');

/** Acquire the single memoized bounded read, with the locked ceiling. */
const boundedRequestInputs = new WeakMap<
  Request,
  Promise<BoundedMutationInput>
>();

export const boundedMutationInput = (
  request: Request,
): Promise<BoundedMutationInput> => {
  const cached = boundedRequestInputs.get(request);
  if (cached !== undefined) return cached;
  const input = readBoundedMutationBody(request).then(
    (read): BoundedMutationInput => ({
      read,
      contentType: request.headers.get('content-type'),
    }),
  );
  boundedRequestInputs.set(request, input);
  return input;
};

/**
 * Parse the bounded bytes as a form using a fresh Request built from the same
 * bytes and the original content type. A non-ok read or an unparsable body
 * answers null; the caller maps that onto its own locked input error.
 */
const boundedInputForms = new WeakMap<
  BoundedMutationInput,
  Promise<FormData | null>
>();

export const boundedFormData = (
  input: BoundedMutationInput,
): Promise<FormData | null> => {
  const cached = boundedInputForms.get(input);
  if (cached !== undefined) return cached;
  const form = (async (): Promise<FormData | null> => {
    if (!input.read.ok) return null;
    try {
      return await new Request('https://bounded-mutation.invalid/', {
        method: 'POST',
        headers: { 'content-type': input.contentType ?? '' },
        body: input.read.bytes,
      }).formData();
    } catch {
      return null;
    }
  })();
  boundedInputForms.set(input, form);
  return form;
};

/** Decode the bounded bytes as JSON text, or null when the read was refused. */
export const boundedJsonText = (input: BoundedMutationInput): string | null =>
  input.read.ok ? new TextDecoder().decode(input.read.bytes) : null;

const isMutationOperationId = (
  value: unknown,
): value is ContentSchemaRegistryMutationOperationId =>
  typeof value === 'string' &&
  Object.hasOwn(CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS, value);

/**
 * Read only the operation discriminator from an already-bounded JSON value.
 * The value may be the payload object itself or the discriminator alone, the
 * same tolerance the pre-refactor clone-based probe had.
 */
export const contentSchemaRegistryMutationOperationFromJsonText = (
  text: string,
): ContentSchemaRegistryMutationOperationId | null => {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  const operationId =
    typeof value === 'object' && value !== null
      ? (value as { readonly operationId?: unknown }).operationId
      : value;
  return isMutationOperationId(operationId) ? operationId : null;
};

/**
 * Read only the operation discriminator from one bounded input, so Astro can
 * keep native POST flows. JSON is decoded from the bounded text; a form body
 * is parsed from a Request built out of the same bounded bytes.
 */
export const contentSchemaRegistryMutationOperationFromBoundedInput = async (
  input: BoundedMutationInput,
): Promise<ContentSchemaRegistryMutationOperationId | null> => {
  if (!input.read.ok) return null;
  if (isJsonMutationContentType(input.contentType)) {
    const text = boundedJsonText(input);
    return text === null
      ? null
      : contentSchemaRegistryMutationOperationFromJsonText(text);
  }
  const form = await boundedFormData(input);
  if (form === null) return null;
  const value = form.get('operationId');
  return isMutationOperationId(value) ? value : null;
};
