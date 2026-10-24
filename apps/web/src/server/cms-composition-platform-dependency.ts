/**
 * BE00 line 172: a `DEPENDENCY_UNAVAILABLE` (502/503/504) carries
 * `{ dependencyClass: string, retryable: true }`. Every Composition relay (CMS-03C-01, -02, -04, -05)
 * projects exactly this member on a relayed upstream refusal and on a relay-local one, so a 502 is never
 * advertised as non-retryable and a local refusal never goes out with empty details.
 */
export type CompositionDependencyDetails = Readonly<{
  dependencyClass: 'cms_composition';
  retryable: true;
}>;

export const isCompositionDependencyStatus = (status: number): boolean =>
  status === 502 || status === 503 || status === 504;

export const compositionDependencyDetails =
  (): CompositionDependencyDetails => ({
    dependencyClass: 'cms_composition',
    retryable: true,
  });
