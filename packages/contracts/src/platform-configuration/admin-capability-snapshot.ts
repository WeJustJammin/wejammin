import { z } from 'zod';

/**
 * CFG-05B-07 acting-party-bound capability snapshot (BE05b).
 *
 * A protected, service-binding-only read of the named `admin.*` and
 * `settings.*` capabilities the Worker already derives for the verified
 * session and acting party. `admin.*` gates the admin workspace tabs and
 * `settings.*` is the namespace the BE05a command RPCs authorize against
 * (`settings.approve`, `settings.release`, `settings.rollback`, and each
 * definition's owner capability). Both only select UI affordances; the
 * Worker and database re-check authority on every command. The
 * route takes no body, query or path input: actor, party and capability keys
 * are server-derived and never accepted from the caller. The response carries
 * capability names only; no person, party, session, grant or provider
 * identifier crosses it.
 */
export const AdminCapabilityKeySchema = z
  .string()
  .regex(
    /^(?:admin|settings)\.[a-z][a-z0-9_.-]{0,90}$/u,
    'admin_capability_invalid',
  );

export const Cfg05b07CapabilitySnapshotResponseSchema = z.strictObject({
  capabilities: z
    .array(AdminCapabilityKeySchema)
    .max(32)
    .refine((values) => new Set(values).size === values.length, {
      message: 'capabilities_duplicate',
    }),
});

export type Cfg05b07CapabilitySnapshotResponse = z.infer<
  typeof Cfg05b07CapabilitySnapshotResponseSchema
>;
