/**
 * The linked-update operations the Worker transports (BE03c 175-177): the author-facing pattern selector
 * (CMS-03C-13), the three-way diff of one instance (CMS-03C-14), the accept/detach command (CMS-03C-15) and, beside
 * them, the composition-instance list read of the same page (cmsCompositionInstancesRead, DEC-206).
 * One table names the `platform_api` RPC, the transport class, the ceilings and the registry rate row of each, so the
 * route layer, the production adapter and the registry pin test read the same facts.
 */
export type PatternUpdateOperation =
  'CMS-03C-13' | 'CMS-03C-14' | 'CMS-03C-15' | 'cmsCompositionInstancesRead';

export type PatternUpdateOperationSpec = Readonly<{
  /** The named `platform_api` function; the browser never supplies it. */
  rpc: string;
  /** A command carries the Idempotency-Key and the strong If-Match; a safe read carries neither. */
  write: boolean;
  /** Registry deadline: reads 8,000 ms (Tier 1), the command 15,000 ms (Tier 2). */
  deadlineMs: 8_000 | 15_000;
  rateClass:
    | 'cms-pattern-selector-read'
    | 'cms-composition-read'
    | 'cms-composition-instances-read'
    | 'cms-composition-update';
  /** Per-minute ceilings of the user bucket and of the acting-party bucket. */
  user: number;
  party: number;
  /**
   * The largest RPC answer text the transport reads. Every answer but the diff keeps the ordinary 256 KiB ceiling. The
   * diff resource is bounded to 262,144 octets as compact JSON (CMS_UPDATE_DIFF_MAX_BYTES); PostgreSQL relays `jsonb`
   * text with a space after every `:` and `,`, which can double a dense resource, so its wire text may be read up to
   * twice that. The Worker re-serializes compactly and the strict schema re-enforces the 262,144 bound before it answers.
   */
  wireBytes: number;
}>;

export const PATTERN_UPDATE_OPERATIONS: Readonly<
  Record<PatternUpdateOperation, PatternUpdateOperationSpec>
> = {
  'CMS-03C-13': {
    rpc: 'cms_list_pattern_selector',
    write: false,
    deadlineMs: 8_000,
    rateClass: 'cms-pattern-selector-read',
    user: 300,
    party: 600,
    wireBytes: 262_144,
  },
  'CMS-03C-14': {
    rpc: 'cms_get_instance_update_diff',
    write: false,
    deadlineMs: 8_000,
    rateClass: 'cms-composition-read',
    user: 300,
    party: 600,
    wireBytes: 524_288,
  },
  cmsCompositionInstancesRead: {
    rpc: 'cms_list_composition_instances',
    write: false,
    deadlineMs: 8_000,
    rateClass: 'cms-composition-instances-read',
    user: 300,
    party: 600,
    wireBytes: 262_144,
  },
  'CMS-03C-15': {
    rpc: 'cms_apply_pattern_update',
    write: true,
    deadlineMs: 15_000,
    rateClass: 'cms-composition-update',
    user: 60,
    party: 120,
    wireBytes: 262_144,
  },
};
