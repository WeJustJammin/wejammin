-- Slice 11 lane S11-3a (DEC-158(b), BE03b CMS-03B-18 field matrix; tracker P2-S11-AC-068):
-- the assignment reason bound is 1..256 Unicode CODE POINTS, the API rule, not 256 octets.
--
-- 20261005017020 created cms_editorial_review_assignments with the foundation Database Schema
-- text `octet_length(reason) BETWEEN 1 AND 256`, which refuses a valid 256-code-point reason
-- written in any non-ASCII script (two bytes per code point).  The same defect was fixed for the
-- decision reason by 20261005017030 under DEC-158(a); DEC-158(b) rules the assignment reason the
-- same way ("1..256 Unicode code points and must already be NFC (refused, never normalized) -
-- nothing else").  The NFC rule is enforced by the command (cms_editorial_reason_valid), not by
-- the table.  Both bounds are kept.  No row can predate this migration: the only writer is the
-- command this lane ships.  Forward-only.
begin;

set local lock_timeout = '5s';

do $body$
begin
  if exists (select 1 from platform_private.cms_editorial_review_assignments row_item) then
    raise exception 'CMS editorial review assignments pre-date the code-point reason bound'
      using errcode = 'P0001';
  end if;
end;
$body$;

alter table platform_private.cms_editorial_review_assignments
  drop constraint cms_editorial_review_assignments_reason_check;

alter table platform_private.cms_editorial_review_assignments
  add constraint cms_editorial_review_assignments_reason_check
    check (reason is null or pg_catalog.char_length(reason) between 1 and 256);

commit;
