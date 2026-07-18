import { describe, expect, test } from "bun:test";

import type { IntakeInterpretationRequest } from "../src/lib/workflow/contracts";
import {
  runIntakeInterpretationPipeline,
  type IntakeInterpreter,
} from "../src/lib/workflow/interpretation-pipeline";

const routineRequest: IntakeInterpretationRequest = {
  preferredLanguage: "French",
  languageCode: "fr",
  chiefComplaint: "Bonjour docteur, j’ai mal au pied gauche depuis six mois.",
  clarificationQuestion: "Où la douleur commence-t-elle ?",
  clarificationResponse: "La douleur commence dans le gros orteil.",
};

function interpreterWithEnglish(englishInterpretation: string): IntakeInterpreter {
  return async () => ({
    model: "test-sonnet",
    interpretation: {
      patientInterpretation: "J’ai mal au pied gauche depuis six mois et la douleur commence dans le gros orteil.",
      englishInterpretation,
      visitTopics: [{ nativeSummary: "Douleur au pied gauche", englishSummary: "Left foot pain" }],
      confidence: "medium",
      ambiguities: [],
    },
  });
}

describe("intake interpretation safety pipeline", () => {
  test("does not call Sonnet when raw English, Spanish, or Tagalog text matches a red flag", async () => {
    for (const chiefComplaint of [
      "I have chest pressure and shortness of breath since this morning.",
      "Siento presión en el pecho y me falta el aire desde esta mañana.",
      "May paninikip ng dibdib ako at hirap huminga mula kaninang umaga.",
    ]) {
      let calls = 0;
      const outcome = await runIntakeInterpretationPipeline(
        { ...routineRequest, chiefComplaint, clarificationResponse: "This is happening now." },
        async () => {
          calls += 1;
          throw new Error("The interpreter must not be called.");
        },
      );
      expect(outcome).toMatchObject({ kind: "escalated", phase: "raw" });
      expect(calls).toBe(0);
    }
  });

  test("screens another language's English interpretation before confirmation", async () => {
    let calls = 0;
    const interpreter = interpreterWithEnglish("The patient has chest pressure and cannot breathe right now.");
    const outcome = await runIntakeInterpretationPipeline(routineRequest, async (request) => {
      calls += 1;
      return interpreter(request);
    });

    expect(calls).toBe(1);
    expect(outcome).toMatchObject({
      kind: "escalated",
      phase: "english-interpretation",
      safety: { ruleId: "chest-pain-with-dyspnea" },
      englishSafetyTranslation: "The patient has chest pressure and cannot breathe right now.",
    });
  });

  test("returns a routine interpretation when neither deterministic screen matches", async () => {
    const outcome = await runIntakeInterpretationPipeline(
      routineRequest,
      interpreterWithEnglish("The patient has had left foot pain for six months, starting in the big toe."),
    );
    expect(outcome).toMatchObject({ kind: "success", result: { model: "test-sonnet" } });
  });
});
