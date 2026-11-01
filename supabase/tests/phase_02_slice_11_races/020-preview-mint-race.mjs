#!/usr/bin/env node

/**
 * Slice 11 N-session race evidence for CMS-03B-08 `cms_mint_preview` and the preview-token revocation seams (BE03b
 * "Preview token and verification", "Concurrent same-key/same-body commands produce one effect and exact replay",
 * global lock order positions 0 and 1, DEC-143 authority-loss revocation; tracker P2-S11-AC-026, AC-117, AC-118).
 *
 *   M1  the same mint sent twice at once: both answer the SAME token (the second waits on the idempotency
 *       reservation and replays it), one token row and one audit record exist, and the token verifies.
 *   M2  one Idempotency-Key with two different bodies: exactly one commits, the other is IDEMPOTENCY_MISMATCH.
 *   M3  a mint parked after taking its locks (right before the token insert) BLOCKS the revoking UPDATE of the
 *       minter's actor grant; once the mint commits the revocation proceeds and revokes the NEW token in its
 *       transaction (state revoked, version 2): no stale live token, no deadlock; the verifier then reports it
 *       revoked for its owner.
 *   M4  a grant revocation holding its row locks BLOCKS a mint; when it commits the mint is refused
 *       capability_missing and no token row exists.
 *   M5  a mint parked before its insert BLOCKS the archiving of its entry (the entry row is held FOR SHARE); once
 *       the mint commits the archive revokes the token.
 *
 * Run only against the disposable local database right after `pnpm db:reset`.
 */
import * as kit from '../../../infra/database-races/preview-kit.mjs';

const { check } = kit;
const ids = kit.buildPreviewFixture();
kit.installPreviewGate();
const MINT = 'cms_mint_preview';
const GRANT_GATE = 7701;
const HOLD_GATE = 7702;
const ARCHIVE_GATE = 7703;
const tokens = (outcomes) =>
  outcomes.map((outcome) => outcome.token ?? 'ok').join(',');

try {
  // ------------------------------------------------------------ M1 ----
  const same = 'race-pv-same';
  const request = kit.mintRequest(ids, same);
  const twins = [
    kit.callAsync(ids, MINT, 'owner', request, 's11race-m1-x'),
    kit.callAsync(ids, MINT, 'owner', request, 's11race-m1-y'),
  ];
  const [x, y] = await Promise.all(twins.map((entry) => entry.done));
  check(
    x.code === 0 &&
      y.code === 0 &&
      /^[A-Za-z0-9_-]{43}$/u.test(x.response?.token ?? '') &&
      x.response.token === y.response.token,
    `M1: the same mint sent twice at once answers the identical token to both (${tokens([x, y])})`,
  );
  check(
    kit.tokenRows(ids.entries[same]) === 1 &&
      kit.mintAudits(ids.entries[same]) === 1,
    'M1: one token row and one audit record exist',
  );
  check(
    kit.verify(ids, x.response.token).valid === true,
    'M1: the minted token verifies for its owner',
  );

  // ------------------------------------------------------------ M2 ----
  const mismatch = 'race-pv-mismatch';
  const base = kit.mintRequest(ids, mismatch);
  const racers = [
    kit.callAsync(ids, MINT, 'owner', base, 's11race-m2-x'),
    kit.callAsync(
      ids,
      MINT,
      'owner',
      { ...base, route: '/preview/other' },
      's11race-m2-y',
    ),
  ];
  const [p, q] = await Promise.all(racers.map((entry) => entry.done));
  check(
    [p, q].filter((outcome) => outcome.code === 0).length === 1 &&
      [p, q].some((outcome) => outcome.token === 'IDEMPOTENCY_MISMATCH'),
    `M2: one key with two bodies commits exactly one; the other is IDEMPOTENCY_MISMATCH (${tokens([p, q])})`,
  );
  check(kit.tokenRows(ids.entries[mismatch]) === 1, 'M2: one token row exists');

  // ------------------------------------------------------------ M3 ----
  const grant = 'race-pv-grant';
  const grantRequest = kit.mintRequest(ids, grant);
  await kit.closeGate(GRANT_GATE);
  const parked = kit.callAsync(
    ids,
    MINT,
    'owner',
    grantRequest,
    `s11race-pvgated-${GRANT_GATE}-m3`,
  );
  await kit.waitParked(parked.app);
  const revoker = kit.spawnSession(
    's11race-m3-revoker',
    kit.revokerScript(kit.REVOKERS.grant.apply(ids)),
  );
  check(
    (await kit.blockedOrCompleted('s11race-m3-revoker', revoker)) === 'blocked',
    'M3: the grant revocation waits on the share locks the parked mint holds',
  );
  await kit.openGate(GRANT_GATE);
  const [minted] = await Promise.all([parked.done, revoker.done]);
  check(
    minted.code === 0 &&
      kit.tokenRows(ids.entries[grant]) === 1 &&
      kit.tokenState(minted.response.token) === 'revoked/2',
    `M3: the mint commits, then the revocation revokes the NEW token in its transaction (${minted.token ?? kit.tokenState(minted.response?.token ?? '')})`,
  );
  const afterGrant = kit.verify(ids, minted.response.token);
  check(
    afterGrant.valid === false && afterGrant.revoked === true,
    'M3: the verifier reports the token revoked for its owner',
  );
  kit.restoreAuthority(kit.REVOKERS.grant, ids, {});
  kit.restoreAssignments(ids);

  // ------------------------------------------------------------ M4 ----
  const held = 'race-pv-held';
  const heldRequest = kit.mintRequest(ids, held);
  await kit.closeGate(HOLD_GATE);
  const holdingRevoker = kit.spawnSession(
    's11race-m4-revoker',
    kit.revokerScript(kit.REVOKERS.grant.apply(ids), HOLD_GATE),
  );
  await kit.waitParked('s11race-m4-revoker');
  const blockedMint = kit.callAsync(
    ids,
    MINT,
    'owner',
    heldRequest,
    's11race-m4-mint',
  );
  check(
    (await kit.blockedOrCompleted('s11race-m4-mint', blockedMint.session)) ===
      'blocked',
    'M4: the mint waits on the authority rows the uncommitted revocation holds',
  );
  await kit.openGate(HOLD_GATE);
  const [refused] = await Promise.all([blockedMint.done, holdingRevoker.done]);
  check(
    refused.token === 'capability_missing' &&
      kit.tokenRows(ids.entries[held]) === 0,
    `M4: a revocation that commits first wins: the mint is refused capability_missing and no token exists (${refused.token ?? 'ok'})`,
  );
  kit.restoreAuthority(kit.REVOKERS.grant, ids, {});
  kit.restoreAssignments(ids);

  // ------------------------------------------------------------ M5 ----
  const archive = 'race-pv-archive';
  const archiveRequest = kit.mintRequest(ids, archive);
  await kit.closeGate(ARCHIVE_GATE);
  const parkedArchive = kit.callAsync(
    ids,
    MINT,
    'owner',
    archiveRequest,
    `s11race-pvgated-${ARCHIVE_GATE}-m5`,
  );
  await kit.waitParked(parkedArchive.app);
  const archiver = kit.spawnSession(
    's11race-m5-archiver',
    kit.revokerScript(
      `update platform_private.cms_content_entries set lifecycle = 'archived', version = version + 1, updated_at = clock_timestamp() where id = ${kit.sql(ids.entries[archive])}::uuid;`,
    ),
  );
  check(
    (await kit.blockedOrCompleted('s11race-m5-archiver', archiver)) ===
      'blocked',
    'M5: archiving the entry waits on the entry row the parked mint holds FOR SHARE',
  );
  await kit.openGate(ARCHIVE_GATE);
  const [mintedArchive] = await Promise.all([
    parkedArchive.done,
    archiver.done,
  ]);
  check(
    mintedArchive.code === 0 &&
      kit.tokenState(mintedArchive.response.token) === 'revoked/2',
    'M5: the mint commits, then the archive revokes the token of the entry that left `active`',
  );
  console.log(
    '# all preview mint race assertions passed; run `pnpm db:reset` before the pgTAP suite',
  );
} finally {
  await kit.openAllGates();
}
