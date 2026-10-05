import * as React from 'react';

import {
  reviewFlashMessage,
  takeReviewFlash,
  type ReviewFlash,
} from './content-schema-registry-review-flash';
import type { SchemaReviewResource } from './content-schema-registry-types';

const sessionStorageOrNull = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const subscribeNever = (): (() => void) => () => undefined;
const serverSnapshot = (): null => null;

/**
 * Polite announcement of the command that just redirected back to this review:
 * the exact decision with the updated recorded and required counts, or the
 * assignment state with its expiry. It reads a one-shot, identifier-free note
 * only on the client (the server snapshot is empty, so hydration matches), so a
 * plain reload announces nothing and a later refetch never repeats it.
 */
export default function ContentSchemaRegistryReviewFlash({
  review,
}: {
  readonly review: SchemaReviewResource;
}): React.ReactElement | null {
  const taken = React.useRef<{ value: ReviewFlash | null } | null>(null);
  const clientSnapshot = (): ReviewFlash | null => {
    taken.current ??= { value: takeReviewFlash(sessionStorageOrNull()) };
    return taken.current.value;
  };
  const flash = React.useSyncExternalStore(
    subscribeNever,
    clientSnapshot,
    serverSnapshot,
  );
  if (flash === null) return null;
  return (
    <p role="status" aria-live="polite" aria-atomic="true" data-review-flash>
      {reviewFlashMessage(flash, review)}
    </p>
  );
}
