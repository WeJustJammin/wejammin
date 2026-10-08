import type { JsonValue } from '@wejammin/contracts';
import type { CmsEditorialResultSummary } from './cms-editorial-result-handoff';

import type { CmsFieldDescriptor } from '../cms-editorial-fields/cms-field-descriptor';
import type {
  CmsEditorialConflictChoice,
  CmsEditorialConflictResolveInit,
  CmsEditorialConflictState,
} from './cms-editorial-conflict-state';

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface CmsEditorialConflictControllerDeps {
  readonly init: CmsEditorialConflictResolveInit;
  readonly fetcher?: Fetcher;
  readonly csrfToken?: () => string | null;
  readonly newKey?: () => string;
  /**
   * Called once after a verified resolution with the APP route of the entry
   * and its canonical result (null only if the verified body carried none).
   */
  readonly onResolved: (
    entryPath: string,
    result: CmsEditorialResultSummary | null,
  ) => void;
}

export interface CmsEditorialConflictController {
  readonly descriptors: ReadonlyMap<string, CmsFieldDescriptor>;
  readonly getState: () => CmsEditorialConflictState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly choose: (
    fieldId: string,
    choice: CmsEditorialConflictChoice,
  ) => void;
  readonly setExplicit: (fieldId: string, value: JsonValue | null) => void;
  readonly setInputError: (fieldId: string, message: string | null) => void;
  readonly submit: () => Promise<void>;
  readonly retryReconcile: () => Promise<void>;
}
