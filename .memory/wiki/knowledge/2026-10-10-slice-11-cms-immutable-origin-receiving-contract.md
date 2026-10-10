---
id: 2026-10-10-s11-cms-immutable-origin-receiving
type: knowledge
agent: gpt-6.1-sol
source: docs/handoffs/2026-10-08-phase2-codex-handoff/s11/lane-s11-native-cms-origin-receiving-tdd-2026-10-10.md
timestamp: 2026-10-10T10:55:34.248Z
---

# Slice 11 CMS immutable-origin receiving contract

**Tags**: phase-02, slice-11, native, origin, receiving, tdd

Current generic asyncreceiver reads canonicalJob thenconsumer re-read/fence/claim; coredispatch244–251 skipsold immutableCMSorigin afterqueued/reclaim. Select private verifyCmsSchemaDryRunOrigin callback usingexistingstrictprotected originverifier+one-keyreader, noRPC/grant/schema/wireflag/GUC. NonterminalactualCMS missing/unavailable callbackretry beforeeffects; exactfalseACKuntrustedorigin/noJobprocessedwrites; literaltrue privateverifiedImmutableJobOrigin skips onlyevent/currentversioncomparison foractualboundCMStype. OtherJobtypesstale/future unchanged, grammar/binding/duplicate/terminal/restore/activelease/claim/outcome/processedACK preserved. CoreCASactualcanonical/claimreceipt notoriginversion; oldenvelopeunchanged. Newnative sole QA async-entrypoint-cms-origin-admission.test.ts queuedredelivery+originfalse/currentreceipt/barriers/controls overprotectedRPCfakefetch; structuralfuturehook makescompile-beforeproducerpossible. QAproducerUNRUNbeforecleanpushedcheckpoint; independentcontractrefutationpending. EnduringSQLauthority/heartbeat/recoverymapping/productionCMScallback/publiclifecycle/fullgates/acceptance0/122 separateopen. Independentboundedcontractreview identifies inheritedAsyncRpcManualReviewErrorACK trap and cancellationfalse ambiguity; amended localreader catch inclraw malformedJSON/nonboolean productionport validation and reader-ownednonabortedsignal/checks, decisive terminalCMSno-originRPCcontrol. Source-only refutation ongoing. Primarylockedarchitecture257 serverloadedentity/currentversion andIA00INF05 canonicalstateretry/Jobqueuedtransition source support narrowregisteredimmutableorigin consistencyclarification inBE00+BE03a, no newJobtype/businessretrypolicy/authority. Amended QA trueverifier→wrongid/type reread clamp andnonCMSfuture control. Independent source recommendations incorporated before author. Final source/log-only contract review found no bounded defect. The equal-incoming-version second-read wrong-type witness requires the existing eventJobType clamp; no private flag can authorize another Job type.
