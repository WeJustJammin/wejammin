# Slice 11 preview RPC pgTAP fragments (lane S11-3c)

Fragments (`*.sqlinc`) shared by the preview suites of `cms_mint_preview` (CMS-03B-08),
`cms_verify_preview_token` (CMS-03B-19) and `cms_revoke_preview_tokens`, and by the independent-session race
fixture. They are includes, not discovered tests: each executable `../phase_02_slice_11_rpc_preview_*.sql` opens one
transaction, includes the fragments with psql `\ir`, and rolls back.

| Fragment                  | Content                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `000-world.sqlinc`        | token builders (`r11p_token`, `r11p_revoke`, `r11p_revoke_hash`: rows written through the real guards for a given actor, age and binding), the CMS-03B-19 request builder and probe (`r11p_vreq`, `r11p_vcall`, `r11p_denial`), the CMS-03B-08 builders (`r11p_vs`, `r11p_mreq`, `r11p_mcall`, `r11p_derive`) and the Vault key (`r11p_key`) |
| `090-race-fixture.sqlinc` | the committed entries and Vault key of `../phase_02_slice_11_races/020-preview-mint-race.mjs` (included by `infra/database-races/preview-kit.mjs`, never by a pgTAP file)                                                                                                                                                                    |

| Entrypoint                                           | Covers                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `../phase_02_slice_11_rpc_preview_verify.sql`        | CMS-03B-19: the valid result, byte-identical denials, `revoked` for the bound owner only, scopes, zero writes |
| `../phase_02_slice_11_rpc_preview_mint.sql`          | CMS-03B-08 contract, derivation, hash-only persistence, audit without outbox, replay, key rotation, scopes    |
| `../phase_02_slice_11_rpc_preview_mint_refusals.sql` | CMS-03B-08 structure, route grammar, concealment, 403, CAS, stale version set, missing key, no partial effect |
| `../phase_02_slice_11_rpc_preview_revoke.sql`        | the private revocation seam: closed request, by entry / person / both, idempotence, no side effects           |

## Adding a test

Include the prelude in this order: `support/jwt-claims.sqlinc`, `phase_02_slice_10_rpc/000-helpers.sqlinc`,
`phase_02_slice_10_remaining_schema/000-helpers.sqlinc`, `phase_02_slice_10_rpc/001-fixtures.sqlinc`, the three
`phase_02_slice_11_schema` fragments, `phase_02_slice_11_helpers/{000-helpers,001-world,002-reviews}.sqlinc`,
`phase_02_slice_11_rpc_review/{000-world,030-submit}.sqlinc` (`r11_entry` builds an entry with a draft revision), then
`000-world.sqlinc` here.

## Conventions

- A mint test creates the Vault key first (`select pg_temp.r11p_key();`): the token is derived under it.
- A grant lapse that a test does not mean as an authority-loss event goes through `pg_temp.h11_raw_exec` (the eager
  revocation triggers would otherwise revoke the token), and the grant is restored before later calls of the same
  person are judged.
- Keep each file below 400 lines.

## Related paths

- `../../migrations/20261005017850_cms_verify_preview_token.sql` .. `20261005017870_cms_revoke_preview_tokens.sql`
- `../phase_02_slice_11_races/README.md`, `../../../infra/database-races/preview-kit.mjs`
