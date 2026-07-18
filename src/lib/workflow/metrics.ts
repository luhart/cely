import type { RunResult } from "@/lib/workflow/contracts";

export type AgendaEvidenceCoverage = {
  resolved: number;
  total: number;
  percent: number;
};

export type TraceMetrics = {
  handoffDurationMs: number | null;
  concernCount: number;
  athenaEvidenceCount: number;
  unresolvedAmbiguityCount: number;
  agendaEvidenceCoverage: AgendaEvidenceCoverage;
  autonomousWrites: 0;
};

function handoffDurationMs(run: RunResult): number | null {
  const startedAt = Date.parse(run.startedAt);
  const completedAt = Date.parse(run.completedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(completedAt) || completedAt < startedAt) return null;
  return completedAt - startedAt;
}

function unresolvedAmbiguityCount(run: RunResult): number {
  const ambiguityEvidence = run.evidence.find(
    (item) => item.id === "derived-interpretation-ambiguities" && item.source === "derived",
  );
  if (!ambiguityEvidence) return 0;
  return ambiguityEvidence.value
    .split(";")
    .map((ambiguity) => ambiguity.trim())
    .filter(Boolean).length;
}

function agendaEvidenceCoverage(run: RunResult): AgendaEvidenceCoverage {
  const suppliedEvidenceIds = new Set(run.evidence.map((item) => item.id));
  const citedEvidenceIds = run.handoff.agenda.flatMap((item) => item.evidenceIds);
  const resolved = citedEvidenceIds.filter((evidenceId) => suppliedEvidenceIds.has(evidenceId)).length;
  const total = citedEvidenceIds.length;
  return {
    resolved,
    total,
    percent: total === 0 ? 0 : Math.round((resolved / total) * 100),
  };
}

export function deriveTraceMetrics(run: RunResult): TraceMetrics {
  return {
    handoffDurationMs: handoffDurationMs(run),
    concernCount: run.concerns.length,
    athenaEvidenceCount: run.evidence.filter((item) => item.source === "athena").length,
    unresolvedAmbiguityCount: unresolvedAmbiguityCount(run),
    agendaEvidenceCoverage: agendaEvidenceCoverage(run),
    autonomousWrites: 0,
  };
}
