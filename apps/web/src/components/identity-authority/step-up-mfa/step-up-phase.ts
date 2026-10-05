import type { MfaFactorsResource } from '@wejammin/contracts';

export type MfaFactorSummary = MfaFactorsResource['factors'][number];

export type StepUpState = Readonly<{
  fresh: boolean;
  freshUntil: string | null;
}>;

export type StepUpPhase =
  | 'no-factor'
  | 'choosing-factor'
  | 'creating-challenge'
  | 'awaiting-code'
  | 'verifying'
  | 'verified'
  | 'challenge-expired'
  | 'locked'
  | 'degraded'
  | 'signed-out';

export type StepUpFactorChoice = Pick<MfaFactorSummary, 'friendlyName' | 'id'>;

/** The verified factors only, reduced to what the island needs. */
export const verifiedFactors = (
  factors: readonly MfaFactorSummary[],
): readonly StepUpFactorChoice[] =>
  factors
    .filter((factor) => factor.state === 'verified')
    .map(({ friendlyName, id }) => ({ friendlyName, id }));

/** FE01 phases: none, one (challenge on mount) or several (choose first). */
export const initialStepUpPhase = (
  factors: readonly MfaFactorSummary[],
): StepUpPhase => {
  const count = verifiedFactors(factors).length;
  if (count === 0) return 'no-factor';
  return count === 1 ? 'creating-challenge' : 'choosing-factor';
};
