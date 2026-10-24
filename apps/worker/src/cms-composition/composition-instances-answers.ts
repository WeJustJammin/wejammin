import {
  compositionInstancesPageHonours,
  CompositionInstancePageSchema,
  type CompositionInstancePage,
} from '@wejammin/contracts';

/**
 * cmsCompositionInstancesRead (DEC-206): a dependency answer is accepted only when it honours the request that asked for
 * it: the strict contract (which also holds every row to the page revision, one row per id and path, and to the live
 * states) and the request binding of `compositionInstancesPageHonours`. An answer that breaks either is an invalid
 * dependency answer (a local 502 at the route), never a body shown to the caller.
 */
export const validInstancesPage = (
  value: unknown,
  request: Readonly<{
    cursor?: string | null | undefined;
    limit?: number | undefined;
  }>,
): value is CompositionInstancePage => {
  const parsed = CompositionInstancePageSchema.safeParse(value);
  return (
    parsed.success && compositionInstancesPageHonours(parsed.data, request)
  );
};
