# DEC-193 expanded choice writer boundary

TEST ONLY; native `gpt-6.1-sol` / `ultra`; author execution UNRUN.
Driver: `supabase/tests/phase_02_slice_12_dec193_writer_boundaries.sql`.
Stage `pattern-updates,dec193`, including all seven frozen writer WIPs, before
the driver. Root owns parser/formatting, isolated staging, actual RED, review
and any later separately released GREEN. No production or old tests change.

The signed registry and governed pattern/placement producers are reused from
the existing common fixture chain. Seven inner block keys of 64 characters,
one nested namespace of 64 characters and `/short` produce one 526-character,
nine-segment descendant address. The actual stored root is only six bytes.
Only the deepest registered block version changes 1 -> 2, producing one real
structural collision without a local override. The public reader is checked
against an independent literal NodeValue; public accepts must honor yours and
theirs, append exactly once and preserve history/position/root/provenance rules.
The detached canonical expectation uses an independent ordinal model, not any
production expander, typed-diff expected builder or resolver output.

Private request-checker cases guard exact function/signature availability within
each case, then dynamically invoke it. Missing/wrong signature is TAP FAIL, not
setup abort, skip or fake result. Cases include 526 and exactly 4680/72 accepted,
73 short segments refused, 4681 refused, segment/grammar controls and duplicate
paths. A 4681-character address cannot independently satisfy both 72 segments
and 64 characters per segment: this case extends the final segment to65. The
73-short-segment case isolates the segment-count bound without a size violation.
Every helper case captures full stores before/after. Public long-unknown,
over-72, foreign-owner, missing-author and actual anon/authenticated role cases
also require no effects. No artificial full 128-path diff is required.

Stored override keys remain a separate contract: store-free placement checker
accepts exactly512 and refuses513; the 512 positive does not assert reachability.
An actual placement refuses the 526-character override at `/overrides`.
A separate real active nested forest has a 260-byte expanded block ROOT; actual
placement must refuse at `/slotPath` with no effects. This exercises the existing
248-octet producer cap, not an invented DB CHECK (the DB path bound remains512).

Expected pre-fix RED: the existing update checker rejects 526/4680 choices and
actual long-path accepts at `/instances/0/choices/0/path`; it also admits a
73-short-segment path because it lacks the expanded segment-count check. Those
are expectations from source inspection, not executed results. Deep graph,
registry, generic protected-props proof, full writer regression and receiving
acceptance remain separate gates. Exact manifest is in the owned handoff report.
