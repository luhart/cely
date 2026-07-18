import { describe, expect, test } from "bun:test";

import { getScenario } from "../src/lib/demo/fixtures";
import { deriveTraceMetrics } from "../src/lib/workflow/metrics";
import type { RunResult } from "../src/lib/workflow/contracts";

const scenario = getScenario("maya-previsit");

function makeRun(overrides: Partial<RunResult> = {}): RunResult {
  return {
    runId: "run_metrics",
    workflowId: "previsit-intake-v1",
    scenarioId: scenario.id,
    startedAt: "2026-07-18T12:00:00.000Z",
    completedAt: "2026-07-18T12:00:01.250Z",
    patient: scenario.patient,
    concerns: scenario.concerns,
    evidence: scenario.evidence,
    handoff: scenario.handoff,
    execution: { athena: "fixture", model: "fixture", safetyBranch: "standard" },
    approval: { required: true, status: "pending" },
    ...overrides,
  };
}

describe("trace metrics", () => {
  test("derives only values present in a completed run trace", () => {
    expect(deriveTraceMetrics(makeRun())).toEqual({
      handoffDurationMs: 1_250,
      concernCount: 2,
      athenaEvidenceCount: 2,
      unresolvedAmbiguityCount: 0,
      agendaEvidenceCoverage: { resolved: 4, total: 4, percent: 100 },
      autonomousWrites: 0,
    });
  });

  test("counts recorded interpretation ambiguities without inferring any", () => {
    const ambiguityEvidence = {
      id: "derived-interpretation-ambiguities",
      label: "Interpretation ambiguities requiring review",
      value: "Whether hearing is reduced or absent; Whether the phrase describes pain quality",
      source: "derived" as const,
    };
    expect(deriveTraceMetrics(makeRun({ evidence: [...scenario.evidence, ambiguityEvidence] })).unresolvedAmbiguityCount).toBe(2);
  });

  test("reports citation resolution rather than assuming agenda support", () => {
    const handoff = {
      ...scenario.handoff,
      agenda: scenario.handoff.agenda.map((item, index) => index === 0
        ? { ...item, evidenceIds: [...item.evidenceIds, "missing-evidence"] }
        : item),
      evidenceIds: [...scenario.handoff.evidenceIds, "missing-evidence"],
    };
    expect(deriveTraceMetrics(makeRun({ handoff })).agendaEvidenceCoverage).toEqual({
      resolved: 4,
      total: 5,
      percent: 80,
    });
  });

  test("returns null for an invalid or reversed duration", () => {
    expect(deriveTraceMetrics(makeRun({ completedAt: "not-a-date" })).handoffDurationMs).toBeNull();
    expect(deriveTraceMetrics(makeRun({ completedAt: "2026-07-18T11:59:59.000Z" })).handoffDurationMs).toBeNull();
  });
});
