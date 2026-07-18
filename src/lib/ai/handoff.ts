import "server-only";

import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";

import type { ConversationMessage, DemoScenario } from "@/lib/demo/fixtures";
import {
  HandoffSchema,
  type ClinicalHandoff,
  type Concern,
  type Evidence,
} from "@/lib/workflow/contracts";

export type HandoffGeneration = {
  handoff: ClinicalHandoff;
  mode: "live" | "fixture" | "degraded";
};

export async function generateClinicalHandoff(input: {
  patient: DemoScenario["patient"];
  conversation: ConversationMessage[];
  concerns: Concern[];
  evidence: Evidence[];
  fallback: ClinicalHandoff;
  deterministicDisposition: ClinicalHandoff["disposition"];
  preferLive: boolean;
}): Promise<HandoffGeneration> {
  if (!input.preferLive || process.env.AGENT_MODE !== "live" || !process.env.ANTHROPIC_API_KEY) {
    return { handoff: input.fallback, mode: "fixture" };
  }

  try {
    const { output } = await generateText({
      model: anthropic(process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5"),
      abortSignal: AbortSignal.timeout(20_000),
      maxOutputTokens: 1_600,
      providerOptions: {
        anthropic: {
          thinking: { type: "disabled" },
          structuredOutputMode: "outputFormat",
        },
      },
      output: Output.object({
        schema: HandoffSchema,
        name: "ClinicalHandoff",
        description: "A concise, evidence-linked pre-visit handoff for clinician review",
      }),
      system: `You prepare a pre-visit handoff, not a diagnosis or treatment plan.
Preserve the patient's own words. Never infer facts that are not in evidence.
Call out contradictions instead of resolving them. Keep the agenda to what fits in one visit.
The supplied concerns may include patientPriority="top". Treat that as the patient's preference, not clinical urgency, and never let it override the deterministic safety disposition.
When five or fewer confirmed concerns are supplied, keep each one visible in the agenda; you may reorder them for safety or chart reconciliation when the rationale and evidence support doing so.
For every agenda item, provide a concise label, a short clinical rationale, and one to three supporting evidence IDs.
Every agenda evidence ID must be supplied evidence and must also appear in the handoff-level evidence IDs.
Use emergency-guidance only when the supplied safety branch already escalated.
Only mention chart resources represented in the supplied evidence; never claim an unqueried resource is absent.
Never claim an alert, outreach, emergency-service contact, or external escalation action occurred unless evidence records it.
Every clinical statement must be supported by an evidence ID.
Confidence must be no higher than "${input.fallback.confidence}", the deterministic ceiling. Human review is always required.`,
      prompt: JSON.stringify(
        {
          patient: input.patient,
          conversation: input.conversation,
          concerns: input.concerns,
          evidence: input.evidence,
          deterministicSafetyDisposition: input.deterministicDisposition,
        },
        null,
        2,
      ),
    });
    const allowedEvidenceIds = new Set(input.evidence.map((item) => item.id));
    if (output.evidenceIds.some((id) => !allowedEvidenceIds.has(id))) {
      throw new Error("Model returned an evidence ID that was not supplied.");
    }
    const globalEvidenceIds = new Set(output.evidenceIds);
    const agendaEvidenceIds = output.agenda.flatMap((item) => item.evidenceIds);
    if (agendaEvidenceIds.some((id) => !allowedEvidenceIds.has(id))) {
      throw new Error("Model returned agenda evidence that was not supplied.");
    }
    if (agendaEvidenceIds.some((id) => !globalEvidenceIds.has(id))) {
      throw new Error("Model omitted agenda evidence from the handoff evidence IDs.");
    }
    const requiredPatientEvidenceIds = input.evidence
      .filter((item) => item.id === "patient-chief-complaint" || item.id === "patient-confirmed-interpretation")
      .map((item) => item.id);
    if (requiredPatientEvidenceIds.some((id) => !output.evidenceIds.includes(id))) {
      throw new Error("Model omitted required patient evidence from the handoff.");
    }
    if (output.disposition !== input.deterministicDisposition) {
      throw new Error("Model attempted to override the deterministic safety disposition.");
    }
    const confidenceRank = { low: 0, medium: 1, high: 2 } as const;
    const boundedOutput = confidenceRank[output.confidence] > confidenceRank[input.fallback.confidence]
      ? HandoffSchema.parse({ ...output, confidence: input.fallback.confidence })
      : output;
    return { handoff: boundedOutput, mode: "live" };
  } catch (error) {
    console.warn(
      "Clinical handoff generation degraded to the evidence-linked fallback:",
      error instanceof Error ? error.message : "unknown generation error",
    );
    return { handoff: input.fallback, mode: "degraded" };
  }
}
