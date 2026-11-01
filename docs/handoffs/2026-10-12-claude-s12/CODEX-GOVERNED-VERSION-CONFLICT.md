# Governed definition version conflict — owner approved DEC-188

## Evidence

- BE03c `Governed activation, retirement and scheduled activation`, line 1321: activation and
  supersession advance the subject's version; retirement changes the same subject row.
- BE03c `Outbox identity of the activation and taxonomy events`, line 1555: activation, scheduled
  execution and retirement emit aggregateVersion equal to the subject version row's `version`
  after each command advances it. DEC-180 G3 names this subject row as the event aggregate.
- `20260927200000_cms_template_authority.sql`: `version` is the immutable definition number used
  by uniqueness and by template successor creation; `templateVersion` returns that number.
- `20260927290000_cms_composition_authority.sql`, lines 108–110: composition instances pin
  `(pattern_id, pattern_version)` to `cms_pattern_versions(id, version)` via a foreign key.
  Incrementing the referenced definition version either fails that FK or changes historical pins.
- Preserved, unaccepted `20261013300000_cms_governed_subject_lifecycle.sql` introduces
  `lifecycle_version` while freezing definition `version`, and uses the new counter for events.
  This avoids the storage collision but contradicts the locked event wording. No separate-counter
  owner ruling was found in DEC-180–187.

## Decision needed

Root recommends preserving immutable definition numbers and pins, with a separate lifecycle CAS
counter for governed transitions and event dedupe versions. This requires an explicit correction
and cascade of the locked source wording; it must not be silently attributed to DEC-180 G3.
The alternative is a wider version-model migration that separates an immutable definition number
from a mutable public CAS version and updates every pin/lookup/uniqueness consumer accordingly.

The owner explicitly replied “approve both and resume” on 2026-10-13. DEC-188 records the approved
separate internal lifecycle counter; the originating wording and downstream cascade are being
corrected before affected GREEN integration. Approval is not acceptance of the preserved SQL or
proof that activation gates pass. Review-version CAS and public definition pins remain unchanged.
Expired-verifying recovery remains an optional, unapproved extension, not a completion gate.
