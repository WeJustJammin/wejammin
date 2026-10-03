#!/usr/bin/env node
// Cross-runtime progress consistency verifier.
//
// Reads `.memory/pipeline/progress/` and `.memory/pipeline/progress/spec-pipeline.md`
// and reports drift between slice files, phase files, the master index, and the
// spec-pipeline tracker. Exits non-zero on drift so it can be wired into hooks,
// CI, or session-start drift scans across all runtimes.
//
// Usage:
//   node scripts/check-progress-consistency.mjs            # current cwd
//   node scripts/check-progress-consistency.mjs --root DIR # explicit project root
//   node scripts/check-progress-consistency.mjs --json     # machine-readable
//   node scripts/check-progress-consistency.mjs --quiet    # only print on drift
//
// Exit codes:
//   0 = consistent (or no progress files yet — fresh project)
//   1 = drift detected
//   2 = malformed/unreadable progress files

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const rootArgIdx = args.indexOf('--root');
const ROOT = resolve(rootArgIdx >= 0 ? args[rootArgIdx + 1] : process.cwd());
const JSON_OUT = args.includes('--json');
const QUIET = args.includes('--quiet');

const PROGRESS_DIR = join(ROOT, '.memory', 'pipeline', 'progress');
const INDEX_PATH = join(PROGRESS_DIR, 'index.md');
const SPEC_PIPELINE_PATH = join(PROGRESS_DIR, 'spec-pipeline.md');
const PHASES_DIR = join(PROGRESS_DIR, 'phases');
const SLICES_DIR = join(PROGRESS_DIR, 'slices');

const drift = [];
const malformed = [];

function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    malformed.push({ file: path, reason: `cannot read: ${err.message}` });
    return null;
  }
}

function listDir(path) {
  try {
    return readdirSync(path).filter((n) => n.endsWith('.md'));
  } catch {
    return [];
  }
}

// Fresh project: nothing to verify.
if (!existsSync(PROGRESS_DIR) || !existsSync(INDEX_PATH)) {
  if (!QUIET) {
    if (JSON_OUT) {
      process.stdout.write(
        JSON.stringify({ status: 'no-progress', drift: [], malformed: [] }) +
          '\n',
      );
    } else {
      process.stdout.write('No progress files yet — nothing to verify.\n');
    }
  }
  process.exit(0);
}

// ----- Parse phase files -----
// Each phase file has:
//   **Progress**: X/Y slices
//   - [x] **Slice N**: ...
//   - [/] **Slice N**: ...
//   - [ ] **Slice N**: ...
const SLICE_LINE_RE = /^\s*-\s*\[([ x/!])\]\s+\*\*Slice\s+(\d+)\*\*/i;
const PROGRESS_RE = /\*\*Progress\*\*:\s*(\d+)\s*\/\s*(\d+)/i;
const STATUS_RE =
  /\*\*Status\*\*:\s*(not-started|in-progress|complete|blocked)/i;

const phaseSummary = new Map(); // phase number → { declared, computed, statuses }

for (const fileName of listDir(PHASES_DIR)) {
  const m = fileName.match(/^phase-(\d+)\.md$/);
  if (!m) continue;
  const phaseNum = parseInt(m[1], 10);
  const text = read(join(PHASES_DIR, fileName));
  if (text == null) continue;

  const declared = (() => {
    const pm = text.match(PROGRESS_RE);
    return pm
      ? { done: parseInt(pm[1], 10), total: parseInt(pm[2], 10) }
      : null;
  })();

  const slices = new Map(); // slice num → checkbox char
  for (const line of text.split('\n')) {
    const sm = line.match(SLICE_LINE_RE);
    if (!sm) continue;
    slices.set(parseInt(sm[2], 10), sm[1]);
  }

  const computedDone = [...slices.values()].filter((c) => c === 'x').length;
  const computedTotal = slices.size;

  if (!declared) {
    malformed.push({
      file: fileName,
      reason: 'missing **Progress**: X/Y header',
    });
  } else {
    if (declared.done !== computedDone) {
      drift.push({
        kind: 'phase-fraction-mismatch',
        file: `phases/${fileName}`,
        message: `Header says ${declared.done}/${declared.total} done, but ${computedDone} slices are marked [x]`,
      });
    }
    if (declared.total !== computedTotal && computedTotal > 0) {
      drift.push({
        kind: 'phase-total-mismatch',
        file: `phases/${fileName}`,
        message: `Header says total=${declared.total}, but ${computedTotal} **Slice N** entries found`,
      });
    }
  }

  phaseSummary.set(phaseNum, {
    declared,
    computedDone,
    computedTotal,
    slices,
    fileName,
  });
}

// ----- Cross-check slice files -----
// slices/phase-NN-slice-MM.md must agree with phase file's checkbox.
//   Status: complete  ⇔  [x] in phase file
//   Status: in-progress ⇔ [/] in phase file
const sliceFiles = listDir(SLICES_DIR);

for (const fileName of sliceFiles) {
  const m = fileName.match(/^phase-(\d+)-slice-(\d+)\.md$/);
  if (!m) {
    malformed.push({
      file: `slices/${fileName}`,
      reason: 'filename does not match phase-NN-slice-MM.md',
    });
    continue;
  }
  const phaseNum = parseInt(m[1], 10);
  const sliceNum = parseInt(m[2], 10);
  const text = read(join(SLICES_DIR, fileName));
  if (text == null) continue;

  const sm = text.match(STATUS_RE);
  if (!sm) {
    malformed.push({
      file: `slices/${fileName}`,
      reason: 'missing **Status**: line',
    });
    continue;
  }
  const sliceStatus = sm[1];

  const phase = phaseSummary.get(phaseNum);
  if (!phase) {
    drift.push({
      kind: 'orphan-slice',
      file: `slices/${fileName}`,
      message: `Slice file references phase ${phaseNum} but phases/phase-${String(phaseNum).padStart(2, '0')}.md does not exist`,
    });
    continue;
  }

  const checkbox = phase.slices.get(sliceNum);
  if (checkbox === undefined) {
    drift.push({
      kind: 'missing-slice-row',
      file: `slices/${fileName}`,
      message: `Slice file exists but phase file has no **Slice ${sliceNum}** row`,
    });
    continue;
  }

  const expected =
    sliceStatus === 'complete'
      ? 'x'
      : sliceStatus === 'in-progress'
        ? '/'
        : sliceStatus === 'blocked'
          ? '!'
          : ' ';
  if (checkbox !== expected) {
    drift.push({
      kind: 'slice-status-checkbox-mismatch',
      file: `slices/${fileName}`,
      message: `Slice file Status=${sliceStatus} but phase row checkbox=[${checkbox}] (expected [${expected}])`,
    });
  }

  // Depth ratio sanity (only enforce when slice is complete).
  if (sliceStatus === 'complete') {
    const depthBlock = text.match(/##\s+Depth Ratio[\s\S]*?(?=\n##\s|$)/i);
    if (!depthBlock) {
      drift.push({
        kind: 'missing-depth-ratio',
        file: `slices/${fileName}`,
        message:
          'Slice marked complete but no `## Depth Ratio` section recorded',
      });
    } else {
      const ratioMatch = depthBlock[0].match(
        /ratio[^0-9]*([0-9]+(?:\.[0-9]+)?)/i,
      );
      if (ratioMatch && parseFloat(ratioMatch[1]) < 1.0) {
        drift.push({
          kind: 'depth-ratio-below-floor',
          file: `slices/${fileName}`,
          message: `Slice marked complete but Depth Ratio = ${ratioMatch[1]} (must be >= 1.0)`,
        });
      }
    }
  }
}

// ----- Cross-check index.md -----
const indexText = read(INDEX_PATH);
if (indexText != null) {
  const overallMatch = indexText.match(
    /\*\*Overall\*\*:\s*(\d+)\s*\/\s*(\d+)/i,
  );
  let totalDone = 0;
  let totalTotal = 0;
  for (const phase of phaseSummary.values()) {
    totalDone += phase.computedDone;
    totalTotal += phase.computedTotal;
  }
  if (!overallMatch) {
    malformed.push({
      file: 'index.md',
      reason: 'missing **Overall**: X/Y line',
    });
  } else {
    const declaredDone = parseInt(overallMatch[1], 10);
    const declaredTotal = parseInt(overallMatch[2], 10);
    if (declaredDone !== totalDone) {
      drift.push({
        kind: 'index-overall-done-mismatch',
        file: 'index.md',
        message: `Overall says ${declaredDone} slices done, but phase files sum to ${totalDone}`,
      });
    }
    if (declaredTotal !== totalTotal && totalTotal > 0) {
      drift.push({
        kind: 'index-overall-total-mismatch',
        file: 'index.md',
        message: `Overall says total=${declaredTotal}, but phase files sum to ${totalTotal}`,
      });
    }
  }

  // Per-phase row in index table: "| Phase N: ... | status | X/Y | ..."
  const rowRe =
    /\|\s*Phase\s+(\d+)[^|]*\|\s*([a-z-]+)\s*\|\s*(\d+)\s*\/\s*(\d+)\s*\|/gi;
  let r;
  while ((r = rowRe.exec(indexText)) !== null) {
    const phaseNum = parseInt(r[1], 10);
    const indexStatus = r[2];
    const indexDone = parseInt(r[3], 10);
    const indexTotal = parseInt(r[4], 10);
    const phase = phaseSummary.get(phaseNum);
    if (!phase) {
      drift.push({
        kind: 'index-row-orphan',
        file: 'index.md',
        message: `index.md lists Phase ${phaseNum} but phases/phase-${String(phaseNum).padStart(2, '0')}.md does not exist`,
      });
      continue;
    }
    if (
      indexDone !== phase.computedDone ||
      (phase.computedTotal > 0 && indexTotal !== phase.computedTotal)
    ) {
      drift.push({
        kind: 'index-row-fraction-mismatch',
        file: 'index.md',
        message: `Phase ${phaseNum} row says ${indexDone}/${indexTotal} but phase file has ${phase.computedDone}/${phase.computedTotal}`,
      });
    }
    const phaseFileText = read(join(PHASES_DIR, phase.fileName));
    const phaseStatusMatch = phaseFileText && phaseFileText.match(STATUS_RE);
    if (phaseStatusMatch && phaseStatusMatch[1] !== indexStatus) {
      drift.push({
        kind: 'index-row-status-mismatch',
        file: 'index.md',
        message: `Phase ${phaseNum} row status=${indexStatus} but phase file status=${phaseStatusMatch[1]}`,
      });
    }
  }
}

// ----- Cross-check spec-pipeline.md (only that the file isn't truncated) -----
if (existsSync(SPEC_PIPELINE_PATH)) {
  const specText = read(SPEC_PIPELINE_PATH);
  if (specText && !/\|\s*[0-9]{2}\s*\|/.test(specText)) {
    malformed.push({
      file: 'spec-pipeline.md',
      reason:
        'no shard rows found (expected | NN | shard-name | path | status | status | status |)',
    });
  }
}

// ----- Cross-check the active Phase 2 completion policy -----
// Slice 09 keeps all 1239 authored IDs for traceability. AC266 (DEC-101),
// AC209/AC211 (DEC-104), and AC265 (DEC-105) remain unchecked acceptance gates
// outside the 1235-item Slice 09 and 2974-item Phase 2 implementation denominators.
// The 2026-09-30 activation re-audit reopened 17 active Slice 09 criteria,
// which remain open. The separately reopened AC250 (a disclosure clause, not
// private-binding proof) was Chrome-verified on 2026-10-01 and closed. The
// 2026-10-02 DEC-108 depth-floor cascade added 956 open criteria and reopened
// AC019, AC039, AC043, AC054, AC100, AC143, AC181, AC196, AC215, AC222, AC259, AC264 and AC273, so the current claim is the checked-row count over 1235 (19 held criteria are unchecked pending owner ratification). Keep it distinct from
// historical 262/279, 261/279 and 279/279 evidence, and never label the 17-item
// activation set as 18 criteria.
const policySection = (text, heading, nextHeading = /^##\s/imu) => {
  const start = text.search(heading);
  if (start < 0) return '';
  const remainder = text.slice(start + text.match(heading)[0].length);
  const end = remainder.search(nextHeading);
  return end < 0 ? remainder : remainder.slice(0, end);
};

const assertPolicy = (file, text, checks) => {
  if (text == null) return;
  for (const { pattern, message } of checks) {
    if (!pattern.test(text)) {
      drift.push({
        kind: 'phase-2-completion-policy-mismatch',
        file,
        message,
      });
    }
  }
};

// Slice 09 active criteria verified now: the checked P2-S09 rows of the tracker
// (the held criteria are unchecked, so the claim is never hard-coded).
const slice09TrackerPath = join(SLICES_DIR, 'phase-02-slice-09.md');
const SLICE09_VERIFIED = existsSync(slice09TrackerPath)
  ? [
      ...readFileSync(slice09TrackerPath, 'utf8').matchAll(
        /^- \[x\] \*\*P2-S09-AC-(\d{3,4})\*\*/gmu,
      ),
    ].filter(([, id]) => ![209, 211, 265, 266].includes(Number(id))).length
  : 0;
const withVerified = (pattern) =>
  new RegExp(
    pattern.source.replaceAll('__V__', String(SLICE09_VERIFIED)),
    pattern.flags,
  );

const checkPhaseTwoCompletionPolicy = () => {
  const phasePath = join(PHASES_DIR, 'phase-02.md');
  const slicePath = join(SLICES_DIR, 'phase-02-slice-09.md');
  const phaseText = existsSync(phasePath) ? read(phasePath) : null;
  const sliceText = existsSync(slicePath) ? read(slicePath) : null;
  const phaseUpdatedDate = phaseText?.match(
    /^\*\*Updated\*\*:\s*(\d{4}-\d{2}-\d{2})/mu,
  )?.[1];
  const indexHeader = indexText?.split('\n').slice(0, 12).join('\n');
  const phaseHeader = phaseText?.split('\n').slice(0, 16).join('\n');
  const phaseRows =
    phaseText
      ?.split('\n')
      .filter((line) => /\|\s*09\s+Content schemas/iu.test(line))
      .join('\n') ?? '';
  const sliceHeader = sliceText?.split('\n').slice(0, 40).join('\n');
  const sliceBlocking = sliceText
    ? policySection(
        sliceText,
        /^##\s+Blocking release evidence\s+\(current\b/imu,
      )
    : '';

  assertPolicy('index.md', indexHeader, [
    {
      pattern:
        /\*\*Phase 2 criteria\*\*:\s*2,974\s+active\s*\/\s*2,978\s+authored/iu,
      message:
        'index.md must publish the 2,974 active / 2,978 authored Phase 2 denominator',
    },
    {
      pattern: withVerified(
        /Slice 09 is __V__\/1235\s+active\s+with\s+1239\s+authored IDs/iu,
      ),
      message:
        'index.md must publish Slice 09 as <verified>/1235 active with 1239 authored IDs',
    },
    {
      pattern:
        /AC265 remains a mandatory pre-release gate; Slice 10 is implementation-blocked again on the reopened Slice 09 activation criteria/iu,
      message:
        'index.md must classify AC265 as mandatory pre-release and Slice 09 as the renewed Slice 10 implementation blocker',
    },
  ]);

  assertPolicy('phases/phase-02.md', phaseHeader, [
    {
      pattern:
        /\*\*Criteria[^:]*\*\*:\s*2,974\s+active\s*\/\s*2,978\s+authored/iu,
      message:
        'phase-02.md must publish the 2,974 active / 2,978 authored Phase 2 denominator',
    },
    {
      pattern: withVerified(
        /Slice 09 is \*\*__V__\/1235\s+active\*\* \(\*\*1239\s+authored IDs\*\*\)/iu,
      ),
      message:
        'phase-02.md current gate must publish Slice 09 as <verified>/1235 active with 1239 authored IDs',
    },
    {
      pattern:
        /AC265[^\n]*mandatory pre-release[^\n]*Slice 10 (?:is|remains) implementation-blocked/iu,
      message:
        'phase-02.md must classify AC265 as mandatory pre-release while Slice 09 blocks Slice 10 implementation',
    },
    {
      pattern:
        /AC209[\s\S]{0,400}production-rollout\/post-deployment evidence gate[\s\S]{0,400}before alerting is declared ready/iu,
      message:
        'phase-02.md must classify AC209 as a production-rollout/post-deployment gate that gates alerting readiness, not launch',
    },
    {
      pattern:
        /AC211[\s\S]{0,400}post-launch operational SLO acceptance[\s\S]{0,400}mandatory after initial launch/iu,
      message:
        'phase-02.md must classify AC211 as post-launch operational SLO acceptance',
    },
    {
      pattern:
        /AC266[\s\S]{0,400}pre-release[\s\S]{0,400}production-readiness\/release gate/iu,
      message:
        'phase-02.md must retain AC266 as the pre-release production-readiness/release gate',
    },
    {
      pattern: /never passed, waived, simulated, or inferred/iu,
      message:
        'phase-02.md must keep the deferred criteria free of pass/waiver claims',
    },
  ]);

  assertPolicy('phases/phase-02.md#slice-09', phaseRows, [
    {
      pattern: withVerified(
        /\|\s*09\s+Content schemas[^|]*\|\s*in progress\s*\|\s*__V__\/1235\s+active\s*\(1239\s+authored\)\s*\|/iu,
      ),
      message:
        'phase-02.md Slice 09 row must use in progress, <verified>/1235 active, and 1239 authored notation',
    },
  ]);

  assertPolicy('slices/phase-02-slice-09.md', sliceHeader, [
    {
      pattern: /\*\*Acceptance criteria \(authored\)\*\*:\s*1239\b/iu,
      message: 'Slice 09 must retain all 1239 authored acceptance IDs',
    },
    {
      pattern: /\*\*Active release denominator\*\*:\s*1235\b/iu,
      message: 'Slice 09 must declare a 1235-item active release denominator',
    },
    {
      pattern: withVerified(
        /\*\*Current active verification\*\*:\s*__V__\/1235\s+verified;\s*17\s+CMS-03A-04 activation-chain criteria reopened 2026-09-30,\s*plus AC250 separately reopened 2026-09-30 and Chrome-reverified and closed 2026-10-01/iu,
      ),
      message:
        'Slice 09 must publish <verified>/1235 active evidence (17 activation-chain criteria, AC019, AC039, AC043, AC054, AC100, AC143, AC181, AC196, AC215, AC222, AC259, AC264, AC273 and 956 amendment criteria are verified by the evidence index except those it lists open; separately reopened AC250 Chrome-verified and closed 2026-10-01) while retaining 1239 authored IDs',
    },
    {
      pattern:
        /AC209[\s\S]{0,300}production-rollout\/post-deployment evidence gate/iu,
      message:
        'Slice 09 must classify AC209 as a production-rollout/post-deployment evidence gate',
    },
    {
      pattern: /AC211[\s\S]{0,300}post-launch operational SLO acceptance/iu,
      message:
        'Slice 09 must classify AC211 as post-launch operational SLO acceptance',
    },
    {
      pattern:
        /AC266[\s\S]{0,300}owner-deferred pre-release gate[\s\S]{0,300}not passed, accepted, waived, simulated, or inferred/iu,
      message:
        'Slice 09 must keep AC266 unchecked, owner-deferred, pre-release, and free of pass/waiver claims',
    },
  ]);

  assertPolicy(
    'slices/phase-02-slice-09.md#blocking-release-evidence',
    sliceBlocking,
    [
      {
        pattern:
          /AC265[^\n]*mandatory pre-release[^\n]*does not (?:block|gate) Slice 10 implementation/iu,
        message:
          'Slice 09 blocker section must classify AC265 as mandatory pre-release and not a Slice 10 implementation gate',
      },
      {
        pattern:
          /AC209 is a\s+production-rollout\/post-deployment gate that must pass before alerting is\s+declared ready/iu,
        message:
          'Slice 09 blocker section must classify AC209 as a post-deployment alerting-readiness gate',
      },
      {
        pattern:
          /AC211 is post-launch operational SLO acceptance that is\s+mandatory after initial launch/iu,
        message:
          'Slice 09 blocker section must classify AC211 as post-launch operational SLO acceptance',
      },
      {
        pattern: /AC266 remains the pre-release real-device\s+gate/iu,
        message:
          'Slice 09 blocker section must retain AC266 as the pre-release real-device gate',
      },
      {
        pattern: /Each remains authored and unchecked/iu,
        message:
          'Slice 09 blocker section must keep every deferred criterion authored and unchecked',
      },
    ],
  );

  // The live `- **NEXT:**` block in spec-pipeline.md is current guidance, unlike
  // the dated checkpoint bullets above it. Keep it aligned with the active
  // policy so it cannot keep instructing superseded production evidence.
  const nextSpecText = existsSync(SPEC_PIPELINE_PATH)
    ? read(SPEC_PIPELINE_PATH)
    : null;
  if (nextSpecText != null) {
    const nextStart = nextSpecText.lastIndexOf('- **NEXT:**');
    const nextBlock = nextStart < 0 ? '' : nextSpecText.slice(nextStart);
    assertPolicy('spec-pipeline.md#next', nextBlock, [
      {
        pattern: /AC265\*\* pre-release hosted route and matrix/iu,
        message:
          'spec-pipeline.md NEXT must retain AC265 pre-release hosted route and matrix work',
      },
      {
        pattern: withVerified(/Slice 09 at __V__\/1235\s+active/iu),
        message:
          'spec-pipeline.md NEXT must publish Slice 09 as <verified>/1235 active',
      },
      {
        pattern: /2,974 active criteria/iu,
        message:
          'spec-pipeline.md NEXT must publish the 2,974 active Phase 2 criteria count',
      },
      {
        pattern: /Slice 10\s+implementation is blocked/iu,
        message:
          'spec-pipeline.md NEXT must state that Slice 10 implementation is blocked by reopened Slice 09 criteria',
      },
      {
        pattern: /AC209 must pass before alerting is declared\s+ready/iu,
        message:
          'spec-pipeline.md NEXT must keep AC209 on its post-deployment alerting window',
      },
      {
        pattern: /AC211 is mandatory after initial launch/iu,
        message:
          'spec-pipeline.md NEXT must keep AC211 on its post-launch window',
      },
    ]);
    // A dated `CURRENT IMPLEMENTATION` label reads as present-tense guidance.
    // Once the policy moves on it must be relabelled a superseded checkpoint.
    const datedCurrentLabel =
      /\*\*CURRENT IMPLEMENTATION \(\d{4}-\d{2}-\d{2}\)/u.test(nextSpecText);
    assertPolicy('spec-pipeline.md#current-implementation', nextSpecText, [
      {
        pattern: datedCurrentLabel ? /a^/u : /superseded by DEC-104/iu,
        message: datedCurrentLabel
          ? 'spec-pipeline.md still labels a dated checkpoint CURRENT IMPLEMENTATION; relabel it as superseded history'
          : 'spec-pipeline.md must carry a DEC-104 supersession marker for the 2026-09-21 checkpoint',
      },
    ]);
    const header = nextSpecText.split('\n').slice(0, 6).join('\n');
    assertPolicy('spec-pipeline.md#header', header, [
      {
        pattern: /\*\*Last updated\*\*:\s*2026-10-02/iu,
        message:
          'spec-pipeline.md header must carry the current 2026-10-02 last-updated date',
      },
    ]);
  }

  if (indexText != null) {
    const header = indexText.split('\n').slice(0, 6).join('\n');
    assertPolicy('index.md#header', header, [
      {
        pattern: phaseUpdatedDate
          ? new RegExp(`\\*\\*Last updated\\*\\*:\\s*${phaseUpdatedDate}`, 'iu')
          : /a^/u,
        message: 'index.md header must match the current Phase 2 updated date',
      },
    ]);
  }
};

checkPhaseTwoCompletionPolicy();

// ----- Report -----
const status =
  malformed.length > 0
    ? 'malformed'
    : drift.length > 0
      ? 'drift'
      : 'consistent';
const report = {
  status,
  drift,
  malformed,
  phases: [...phaseSummary.entries()].map(([n, p]) => ({
    phase: n,
    done: p.computedDone,
    total: p.computedTotal,
  })),
};

if (JSON_OUT) {
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} else if (status === 'consistent') {
  if (!QUIET) process.stdout.write('Progress files consistent.\n');
} else {
  process.stdout.write(`Progress drift detected (status=${status}):\n`);
  for (const item of malformed) {
    process.stdout.write(`  [malformed] ${item.file}: ${item.reason}\n`);
  }
  for (const item of drift) {
    process.stdout.write(`  [${item.kind}] ${item.file}: ${item.message}\n`);
  }
  process.stdout.write(
    '\nResolution: re-run /implement-slice progress update (Protocol 3) for the affected slice, ' +
      'or hand-edit the file noted above so the four targets (slice file, phase file, index.md, spec-pipeline.md) agree.\n',
  );
}

process.exit(status === 'consistent' ? 0 : status === 'drift' ? 1 : 2);
