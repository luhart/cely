import type {
  IntakeInterpretation,
  IntakeInterpretationRequest,
} from "@/lib/workflow/contracts";
import { evaluateIntakeSafety, type IntakeSafetyDecision } from "@/lib/workflow/policy";

export type IntakeInterpreterResult = {
  interpretation: IntakeInterpretation;
  model: string;
};

export type IntakeInterpreter = (
  request: IntakeInterpretationRequest,
) => Promise<IntakeInterpreterResult>;

export type IntakeInterpretationPipelineResult =
  | { kind: "success"; result: IntakeInterpreterResult }
  | {
      kind: "escalated";
      phase: "raw" | "english-interpretation";
      safety: IntakeSafetyDecision;
      englishSafetyTranslation?: string;
    };

export async function runIntakeInterpretationPipeline(
  request: IntakeInterpretationRequest,
  interpret: IntakeInterpreter,
): Promise<IntakeInterpretationPipelineResult> {
  const rawSafety = evaluateIntakeSafety(`${request.chiefComplaint} ${request.clarificationResponse}`);
  if (rawSafety.branch === "escalated") {
    return { kind: "escalated", phase: "raw", safety: rawSafety };
  }

  const result = await interpret(request);
  const translatedSafety = evaluateIntakeSafety(
    `${request.chiefComplaint} ${request.clarificationResponse} ${result.interpretation.englishInterpretation}`,
  );
  if (translatedSafety.branch === "escalated") {
    return {
      kind: "escalated",
      phase: "english-interpretation",
      safety: translatedSafety,
      englishSafetyTranslation: result.interpretation.englishInterpretation,
    };
  }

  return { kind: "success", result };
}
