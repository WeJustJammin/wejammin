# AC209 Cloudflare Email Sending follow-up — 2026-10-01

**Scope:** provider and mailbox inspection plus a redacted case follow-up through
the owner-authorized Chrome session; no token rotation, permission change,
payment, deployment, or acceptance claim. This record does not change the Slice
09 denominator or mark AC209 complete.

## Verified state

- The Cloudflare user token named `WeJammin Production Observability Alerts` is
  active and its summary includes `Zone Analytics:Read` scoped to `wejamm.in`.
  GitHub's production `CLOUDFLARE_EMAIL_ZONE_ID` matches the zone ID displayed
  by Cloudflare. The previously observed `provider_graphql_error` did not
  reproduce in the protected exact-hour diagnostic
  [36069837542](https://github.com/WeJustJammin/wejammin/actions/runs/36069837542):
  the Email Sending settings query succeeded, but `emailSendingAdaptive` returned
  zero rows. No token or secret value was read or copied.
- Cloudflare's Email Sending dashboard shows `alerts.wejamm.in` as **Enabled**
  with DNS **Configured**. Its Activity log shows **No activity found** for
  **Last 30 days** as viewed on 2026-10-01. The controlled email sent on
  2026-09-22 is inside that window.
- Gmail retains the controlled `[WeJammin] dlq_nonempty` message. Its original
  headers show `Date: 2026-09-22T20:22:07Z`, Gmail receipt at
  `2026-09-22T20:22:14Z`, and SPF, DKIM, and DMARC pass for the sending domain.
  The exact bracketed RFC `Message-ID` hashes to
  `eab9b7e93aae4154046bcb5539b4ab3cdc23eff8808d24d8050f562adc4875fa`,
  identical to the sole complete `messageIdDigests` value in Cloudflare's
  per-event Email Routing artifact from protected run
  [36083336932](https://github.com/WeJustJammin/wejammin/actions/runs/36083336932)
  (artifact `10842447346`, schema `ac209-email-routing-event-v2`, JSON
  `sha256:914c65bf537cfa7c3ed8e10a77bde1fa86370de3904ef915c051c9f3f278dac2`,
  expiring 2026-10-02T01:46:02Z) for the 2026-09-22 20:00–20:59 UTC hour.
  This newly attributes that Routing event to the alert and supersedes the
  earlier non-attribution conclusion in
  the [2026-09-24 diagnostic](2026-09-24-ac209-ac211-protected-run-evidence.md).
  It does not byte-prove the value returned by the Worker's `send()` call,
  because production retains only a one-way digest of that value, and it does
  not substitute Routing telemetry for missing Email Sending telemetry. The
  raw identifier, recipient, and body are not stored in this record.
- Production code uses the Email Service `send_email` Worker binding, not an
  Email Routing reply path. The binding's `destination_address` is a valid
  recipient restriction under
  [Cloudflare's send-binding documentation](https://developers.cloudflare.com/email-service/configuration/send-bindings/),
  not a configuration error.

## Provider case and remaining gate

[Cloudflare case 02343626](https://www.support.cloudflare.com/support/s/case/500Nv00000jYwsWIAS)
was marked **Resolved** on 2026-09-30 without a diagnosis of the absent event.
Support asked whether the sending subdomain is onboarded, which API is used,
and for the exact UTC time and `messageId`. The first two questions are
answered above; the mailbox supplies an exact time and an RFC identifier
digest-matched to Cloudflare's own per-event Routing record. A redacted
follow-up was sent on 2026-10-01 without the raw identifier; sharing that
identifier remains pending owner confirmation.
Provider-side investigation is still needed to explain why the delivered send
is absent from the parent-zone `emailSendingAdaptive` dataset and dashboard
Activity log.

## Reopened case and redacted follow-up — 2026-10-01

Chrome showed case 02343626 still Resolved with no reply newer than September
26. The case was reopened to **Open**, and the case feed confirmed a new
customer post ([feed item](https://www.support.cloudflare.com/support/s/feed/0D5Nv00001pnatSKAQ))
as shared. It answered Support's first two questions: `alerts.wejamm.in` is
Enabled with DNS Configured in Email Sending, and the Worker uses the Email
Service `send_email` binding rather than an Email Routing reply/send method.
The post gave only the already-disclosed approximate 2026-09-22 20:22 UTC
control time and asked for a provider investigation of the 30-day empty
Activity log and parent-zone dataset. The recipient, body, raw `Message-ID`,
and credentials were not sent. The dashboard still displayed **No activity
found** for Last 30 days after the case reopened. No new provider diagnosis
or acceptance evidence has yet appeared.

**Verdict:** AC209 remains authored, unchecked, and outside the active Slice 09
implementation denominator under DEC-104. Neither mailbox delivery nor a
queryable-but-empty provider dataset satisfies the correlated Email Sending
evidence gate. The account also displays a separate overdue $5 invoice notice;
no payment or plan change was made, and no causal link to this telemetry gap is
established.
