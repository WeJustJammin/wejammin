/** Tier 2 command budget shared by every 03b mutation (p95 under 1,200ms). */
export const tier2Slo = {
  tier: 2,
  commandP95Ms: 1_200,
  protectedRpcP95Ms: 300,
  acceptanceP99Ms: 1_000,
} as const;

/** Tier 1 read budget shared by 03b safe reads (p95 under 750ms). */
export const tier1Slo = {
  tier: 1,
  commandP95Ms: 750,
  protectedRpcP95Ms: 300,
  acceptanceP99Ms: 1_000,
} as const;
