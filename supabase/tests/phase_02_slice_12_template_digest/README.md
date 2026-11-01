# Slice 12 template-digest test support

Suite: `../phase_02_slice_12_template_digest.sql`. Lane `claude_s12_template_digest`, forward migration
`supabase/migrations/20261014180000_cms_define_template_digest_mismatch.sql` (anchored patch of
`platform_private.cms_define_template`: a well-formed caller `blockRegistryDigest` that differs from the recomputed one raises
`block_registry_digest_mismatch`, `P0001`, DETAIL `["/blockRegistryDigest"]`, BE03c 323-327, 1273, DEC-186 item 2; every other
conflict keeps the generic `CONFLICT`). The oracle in `../phase_02_slice_12_template_authority.sql` asserts the same token.

- `010-refusals.sqlinc`: the refusal through the named RPC with SQLSTATE, message and DETAIL captured (the Slice 10 helper keeps no
  DETAIL): mismatch writes nothing and rolls its reservation back (the same idempotency key then succeeds with the matching digest);
  an absent digest is derived; malformed digests (text, upper case, short, long, number, null, empty) are `VALIDATION_FAILED`, never
  the token (the 422 pointer `/blockRegistryDigest` of BE03c 373 is the contract layer's, not asserted here); a taken key and a stale `expectedVersion` stay `CONFLICT`; an unauthorized caller gets `FORBIDDEN`, never the token.
- `020-identity.sqlinc`: the typed raise occurs once; with that one statement reversed the body md5 equals the applied
  `20261013100200` body (md5 computed by script); language, SECURITY DEFINER, volatility, search_path, owner and signature are
  unchanged; the private function stays inaccessible to API roles and the wrapper stays `service_role` only.
- `030-replay.sqlinc`: byte-identical copies of the migration's `do $amend$` block: idempotent on the patched body, patches the
  pre-patch body exactly once, 55000 on a body with neither anchor nor replacement. Regenerate it if the migration changes.

Adding a case: append to `010-refusals.sqlinc` (keep each file under 300 lines). Never weaken an oracle.
