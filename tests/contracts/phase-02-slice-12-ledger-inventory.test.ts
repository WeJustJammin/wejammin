import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { S12_EVIDENCE_LEDGER } from './phase-02-slice-12-evidence-ledger';

// Slice 12 evidence ledger INVENTORY fidelity only.
//
// These tests compare the aggregate ledger's criterion identities and claim text
// with the authoritative tracker
// (.memory/pipeline/progress/slices/phase-02-slice-12.md). They deliberately do
// NOT assert acceptance, evidence depth, citation freshness, receipt validity or
// clause coverage: a criterion can be inventory-exact and still be unproven, so
// nothing here may be read as a completeness or evidence guarantee.
//
// No file hash or source token is pinned, so future legitimate citations and
// clause edits stay free to change; only the ID list and the claim bytes are
// frozen against the tracker.

type TrackerCriterion = {
  criterion: string;
  number: number;
  checked: boolean;
  claim: string;
};
type LedgerLib = {
  trackerCriteria: (markdown: string, slice: string) => TrackerCriterion[];
};

const ledgerLib =
  (await import('../../scripts/evidence/ledger-lib.mjs')) as LedgerLib;

const ROOT = resolve(import.meta.dirname, '../..');
const TRACKER_PATH = '.memory/pipeline/progress/slices/phase-02-slice-12.md';
const SLICE = '12';
const DECLARED_CRITERIA = 296;
const BOOTSTRAP_AC: readonly string[] = [
  'P2-S12-AC-286',
  'P2-S12-AC-287',
  'P2-S12-AC-288',
  'P2-S12-AC-289',
  'P2-S12-AC-290',
  'P2-S12-AC-291',
  'P2-S12-AC-292',
  'P2-S12-AC-293',
  'P2-S12-AC-294',
  'P2-S12-AC-295',
  'P2-S12-AC-296',
];

const trackerText = readFileSync(resolve(ROOT, TRACKER_PATH), 'utf8');
const tracker = ledgerLib.trackerCriteria(trackerText, SLICE);
const trackerIds = tracker.map((criterion) => criterion.criterion);
const ledgerIds = S12_EVIDENCE_LEDGER.map((entry) => entry.criterion);
const trackerClaimById = new Map(
  tracker.map((criterion) => [criterion.criterion, criterion.claim]),
);
const ledgerTextById = new Map(
  S12_EVIDENCE_LEDGER.map((entry) => [entry.criterion, entry.text]),
);

describe('Slice 12 ledger inventory: criterion identity', () => {
  it('parses a non-vacuous tracker of 296 distinct criteria, each with a non-empty claim', () => {
    expect(tracker.length).toBe(DECLARED_CRITERIA);
    expect(new Set(trackerIds).size).toBe(tracker.length);
    expect(
      tracker.every((criterion) => criterion.claim.trim().length > 0),
    ).toBe(true);
    expect(trackerIds.at(0)).toBe('P2-S12-AC-001');
    expect(trackerIds.at(-1)).toBe('P2-S12-AC-296');
  });

  it('lists exactly the tracker criterion IDs, in the same order, once each', () => {
    expect(ledgerIds).toEqual(trackerIds);
    expect(new Set(ledgerIds).size).toBe(ledgerIds.length);
  });
});

describe('Slice 12 ledger inventory: claim fidelity', () => {
  it('copies every tracker claim byte for byte across the whole ledger, not just the new criteria', () => {
    expect(
      S12_EVIDENCE_LEDGER.map((entry) => ({
        criterion: entry.criterion,
        text: entry.text,
      })),
    ).toEqual(
      tracker.map((criterion) => ({
        criterion: criterion.criterion,
        text: criterion.claim,
      })),
    );
  });

  it('matches each entry to its tracker claim by exact identity, not a prefix or normalisation', () => {
    expect(S12_EVIDENCE_LEDGER.length).toBe(tracker.length);
    for (const entry of S12_EVIDENCE_LEDGER) {
      expect(trackerClaimById.get(entry.criterion), entry.criterion).toBe(
        entry.text,
      );
      expect(entry.text.length, entry.criterion).toBe(
        trackerClaimById.get(entry.criterion)?.length,
      );
    }
  });
});

describe('Slice 12 ledger inventory: approved bootstrap AC-286..AC-296', () => {
  it('enumerates exactly eleven newly approved criteria', () => {
    expect(BOOTSTRAP_AC.length).toBe(11);
    expect(new Set(BOOTSTRAP_AC).size).toBe(11);
  });

  it.each(BOOTSTRAP_AC)(
    '%s exists in the ledger with its exact tracker claim',
    (id) => {
      expect(trackerClaimById.has(id), `${id} missing from tracker`).toBe(true);
      expect(ledgerTextById.has(id), `${id} missing from ledger`).toBe(true);
      expect(ledgerTextById.get(id), id).toBe(trackerClaimById.get(id));
    },
  );
});
