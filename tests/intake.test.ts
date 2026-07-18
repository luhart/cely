import { describe, expect, test } from "bun:test";

import {
  ConcernSchema,
  ConfirmedIntakeSchema,
  IntakeInterpretationSchema,
  RunInputSchema,
  UrgentIntakeSchema,
} from "../src/lib/workflow/contracts";
import { getScenario } from "../src/lib/demo/fixtures";
import { interpretationValidationError } from "../src/lib/workflow/interpretation";
import { evaluateIntakeSafety } from "../src/lib/workflow/policy";

describe("confirmed intake contract", () => {
  const valid = {
    preferredLanguage: "Tagalog" as const,
    chiefComplaint: "Masakit at kumikirot ang dibdib ko.",
    clarificationQuestion: "Saan at anong uri ng sakit ang nararamdaman mo?",
    clarificationResponse: "Sa dibdib; parang pressure at hirap akong huminga.",
    englishInterpretation: "Aching chest pressure with difficulty breathing.",
    interpretationConfirmed: true as const,
    confidence: "high" as const,
  };

  test("accepts a bounded, explicitly confirmed interpretation", () => {
    expect(ConfirmedIntakeSchema.parse(valid)).toEqual(valid);
  });

  test("accepts patient-confirmed concerns and an optional top concern", () => {
    const confirmedConcerns = [
      {
        id: "headache",
        nativeSummary: "Pananakit ng ulo sa umaga",
        englishSummary: "Morning headaches",
        mentionOrder: 1,
      },
      {
        id: "hearing",
        nativeSummary: "Pagbabago sa pandinig",
        englishSummary: "Change in hearing",
        mentionOrder: 2,
      },
    ];
    const parsed = ConfirmedIntakeSchema.parse({
      ...valid,
      confirmedConcerns,
      topConcernId: "hearing",
      priorityConfirmed: true,
    });

    expect(parsed.confirmedConcerns).toEqual(confirmedConcerns);
    expect(parsed.topConcernId).toBe("hearing");
  });

  test("preserves the persistent foot-pain example as four attributed concerns", () => {
    const parsed = ConfirmedIntakeSchema.parse({
      preferredLanguage: "Tagalog",
      chiefComplaint:
        "Doc, anim na buwan na pong masakit ang kaliwa kong paa, at parang hindi po gumagana ang gamot ko. Lagi pong sinasabi ng doktor na arthritis ito dahil masakit tuwing umaga, pero hindi naman po gumagaling. Napansin ko po na mas masakit siya tuwing kumakain ako ng baboy.",
      clarificationQuestion:
        "Saan nagsisimula ang sakit, at paano mo ilalarawan ang sakit kapag pinakamalala?",
      clarificationResponse:
        "Oo, matalas at matinding sakit po ito sa mga binti ko pero nagsisimula sa hinlalaki ng paa ko.",
      nativeInterpretation:
        "Anim na buwan nang masakit ang kaliwang paa. Pakiramdam ng pasyente ay hindi nakatutulong ang gamot. Sinabi raw ng doktor na arthritis dahil masakit sa umaga, ngunit hindi gumagaling. Napapansin niyang mas sumasakit pagkatapos kumain ng baboy. Matalas at matindi ang sakit sa mga binti at nagsisimula sa hinlalaki ng paa.",
      englishInterpretation:
        "Left foot pain for six months; the patient feels the current medication is not helping. A previous doctor has called it arthritis because it hurts in the morning, but it has not improved. The patient reports worse pain after eating pork. The pain is sharp and severe in the legs and starts at the big toe.",
      interpretationMethod: "deterministic",
      ambiguities: [
        "The medication name, dose, adherence, and indication are not specified.",
        "The extent and timing of pain described as involving the legs but starting at the big toe require clinician clarification.",
        "Worsening after eating pork is a patient-observed association and is not presented as a confirmed cause.",
      ],
      interpretationConfirmed: true,
      confidence: "medium",
      confirmedConcerns: [
        {
          id: "foot-pain",
          nativeSummary: "Anim na buwang matalas at matinding sakit sa kaliwang paa na nagsisimula sa hinlalaki",
          englishSummary: "Six months of sharp, severe left-foot pain starting at the big toe",
          mentionOrder: 1,
        },
        {
          id: "medication-effect",
          nativeSummary: "Pakiramdam na hindi nakatutulong ang kasalukuyang gamot",
          englishSummary: "Concern that the current medication is not helping",
          mentionOrder: 2,
        },
        {
          id: "prior-arthritis",
          nativeSummary: "Naunang paliwanag na arthritis ngunit hindi gumagaling ang sakit",
          englishSummary: "Prior arthritis explanation with persistent symptoms",
          mentionOrder: 3,
        },
        {
          id: "pork-association",
          nativeSummary: "Napapansing mas sumasakit pagkatapos kumain ng baboy",
          englishSummary: "Patient-observed worsening after eating pork",
          mentionOrder: 4,
        },
      ],
      topConcernId: "foot-pain",
      priorityConfirmed: true,
    });

    expect(parsed.confirmedConcerns).toHaveLength(4);
    expect(parsed.confirmedConcerns?.[2]?.englishSummary).toStartWith("Prior arthritis explanation");
    expect(parsed.confirmedConcerns?.[3]?.englishSummary).toStartWith("Patient-observed");
    expect(parsed.ambiguities?.[0]).toContain("medication name");
    expect(evaluateIntakeSafety(`${parsed.chiefComplaint} ${parsed.clarificationResponse}`)).toEqual({ branch: "standard" });
  });

  test("accepts an explicit no-preference priority confirmation", () => {
    const parsed = ConfirmedIntakeSchema.safeParse({
      ...valid,
      confirmedConcerns: [{
        id: "headache",
        nativeSummary: "Pananakit ng ulo",
        englishSummary: "Headache",
        mentionOrder: 1,
      }],
      topConcernId: null,
      priorityConfirmed: true,
    });

    expect(parsed.success).toBe(true);
  });

  test("rejects duplicate confirmed-concern IDs", () => {
    const parsed = ConfirmedIntakeSchema.safeParse({
      ...valid,
      confirmedConcerns: [
        { id: "same", nativeSummary: "Una", englishSummary: "First", mentionOrder: 1 },
        { id: "same", nativeSummary: "Ikalawa", englishSummary: "Second", mentionOrder: 2 },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  test.each([
    ["duplicate", [1, 1]],
    ["gap", [1, 3]],
  ])("rejects %s confirmed-concern mention order", (_case, mentionOrders) => {
    const parsed = ConfirmedIntakeSchema.safeParse({
      ...valid,
      confirmedConcerns: mentionOrders.map((mentionOrder, index) => ({
        id: `concern-${index + 1}`,
        nativeSummary: `Paksa ${index + 1}`,
        englishSummary: `Topic ${index + 1}`,
        mentionOrder,
      })),
    });

    expect(parsed.success).toBe(false);
  });

  test("rejects a top concern that is absent from the confirmed concern list", () => {
    const parsed = ConfirmedIntakeSchema.safeParse({
      ...valid,
      confirmedConcerns: [{
        id: "headache",
        nativeSummary: "Pananakit ng ulo",
        englishSummary: "Headache",
        mentionOrder: 1,
      }],
      topConcernId: "not-supplied",
      priorityConfirmed: true,
    });

    expect(parsed.success).toBe(false);
  });

  test("keeps patient preference separate from clinical priority", () => {
    const concern = ConcernSchema.parse({
      id: "headache",
      patientWords: "Masakit ang ulo ko",
      translated: "I have a headache",
      duration: null,
      severity: null,
      mentionOrder: 2,
      patientPriority: "top",
      priority: "routine",
    });

    expect(concern.patientPriority).toBe("top");
    expect(concern.priority).toBe("routine");
  });

  test("rejects an interpretation the patient did not confirm", () => {
    const parsed = ConfirmedIntakeSchema.safeParse({ ...valid, interpretationConfirmed: false });
    expect(parsed.success).toBe(false);
  });

  test("accepts common intake languages and rejects malformed language metadata or oversized input", () => {
    expect(ConfirmedIntakeSchema.safeParse({
      ...valid,
      preferredLanguage: "French",
      languageCode: "fr",
      languageProvenance: "detected",
    }).success).toBe(true);
    expect(ConfirmedIntakeSchema.safeParse({ ...valid, languageCode: "not a code" }).success).toBe(false);
    expect(ConfirmedIntakeSchema.safeParse({ ...valid, chiefComplaint: "x".repeat(1001) }).success).toBe(false);
  });

  test("requires patient confirmation for the standard workflow at the API contract", () => {
    expect(RunInputSchema.safeParse({ scenarioId: "maya-previsit" }).success).toBe(false);
    expect(RunInputSchema.safeParse({ scenarioId: "maya-previsit", intake: valid }).success).toBe(true);
  });

  test("keeps the isolated red-flag replay available without patient intake", () => {
    expect(RunInputSchema.safeParse({ scenarioId: "luis-escalation" }).success).toBe(true);
  });

  test("accepts a pre-confirmation urgent branch only after guidance was displayed", () => {
    const urgent = {
      preferredLanguage: "Spanish" as const,
      chiefComplaint: "Tengo presión en el pecho y me falta el aire.",
      safetyRuleId: "chest-pain-with-dyspnea" as const,
      guidanceDisplayed: true as const,
    };
    expect(UrgentIntakeSchema.safeParse(urgent).success).toBe(true);
    expect(RunInputSchema.safeParse({ scenarioId: "maya-previsit", urgentIntake: urgent }).success).toBe(true);
    expect(UrgentIntakeSchema.safeParse({ ...urgent, guidanceDisplayed: false }).success).toBe(false);
  });

  test("rejects ambiguous submissions containing both routine and urgent intake", () => {
    const urgent = {
      preferredLanguage: "Spanish" as const,
      chiefComplaint: "Tengo presión en el pecho y me falta el aire.",
      safetyRuleId: "chest-pain-with-dyspnea" as const,
      guidanceDisplayed: true as const,
    };
    expect(RunInputSchema.safeParse({ scenarioId: "maya-previsit", intake: valid, urgentIntake: urgent }).success).toBe(false);
  });
});

describe("deterministic intake safety gate", () => {
  test.each([
    ["English", "I have chest pressure and shortness of breath since this morning."],
    ["Spanish", "Siento presión en el pecho y me falta el aire desde esta mañana."],
    ["Tagalog", "May paninikip ng dibdib ako at hirap huminga mula kaninang umaga."],
  ])("escalates active chest symptoms with dyspnea in %s", (_language, text) => {
    expect(evaluateIntakeSafety(text)).toMatchObject({
      branch: "escalated",
      ruleId: "chest-pain-with-dyspnea",
    });
  });

  test("requires the cardiopulmonary combination", () => {
    expect(evaluateIntakeSafety("I have chest pressure but I am breathing normally.")).toEqual({ branch: "standard" });
    expect(evaluateIntakeSafety("I am short of breath but have no chest pain.")).toEqual({ branch: "standard" });
  });

  test("escalates when a red-flag combination is completed in clarification", () => {
    const complaint = "Masakit ang dibdib ko.";
    const clarification = "Hirap din akong huminga.";
    expect(evaluateIntakeSafety(complaint)).toEqual({ branch: "standard" });
    expect(evaluateIntakeSafety(`${complaint} ${clarification}`)).toMatchObject({
      branch: "escalated",
      ruleId: "chest-pain-with-dyspnea",
    });
  });

  test.each([
    ["English", "My face is drooping and my speech is slurred."],
    ["Spanish", "Tengo debilidad de un lado y habla arrastrada."],
    ["Tagalog", "Biglang tabingi ang mukha ko at bulol magsalita."],
  ])("escalates specific stroke signs in %s", (_language, text) => {
    expect(evaluateIntakeSafety(text)).toMatchObject({ branch: "escalated", ruleId: "stroke-signs" });
  });

  test.each([
    ["English", "The wound will not stop bleeding."],
    ["Spanish", "La herida no para de sangrar."],
    ["Tagalog", "Hindi tumitigil ang pagdurugo ng sugat."],
  ])("escalates severe bleeding in %s", (_language, text) => {
    expect(evaluateIntakeSafety(text)).toMatchObject({ branch: "escalated", ruleId: "severe-bleeding" });
  });

  test.each([
    ["English", "I want to kill myself."],
    ["Spanish", "Quiero matarme."],
    ["Tagalog", "Gusto kong magpakamatay."],
  ])("escalates self-harm language in %s", (_language, text) => {
    expect(evaluateIntakeSafety(text)).toMatchObject({ branch: "escalated", ruleId: "self-harm" });
  });

  test("does not escalate negated symptoms", () => {
    expect(evaluateIntakeSafety("I do not have chest pain or shortness of breath.")).toEqual({ branch: "standard" });
    expect(evaluateIntakeSafety("No tengo dolor de pecho ni falta de aire.")).toEqual({ branch: "standard" });
    expect(evaluateIntakeSafety("Wala akong sakit sa dibdib o hirap huminga.")).toEqual({ branch: "standard" });
    expect(evaluateIntakeSafety("I am not thinking about suicide.")).toEqual({ branch: "standard" });
  });

  test("does not escalate clearly historical or resolved symptoms", () => {
    expect(evaluateIntakeSafety("I had chest pain and shortness of breath last year, but it resolved.")).toEqual({
      branch: "standard",
    });
    expect(evaluateIntakeSafety("Antecedente de dolor de pecho y falta de aire; ya pasó.")).toEqual({
      branch: "standard",
    });
  });

  test("the red-flag replay is classified by the same deterministic evaluator", () => {
    const fixtureText = getScenario("luis-escalation").conversation
      .filter((message) => message.speaker === "patient")
      .map((message) => message.text)
      .join(" ");
    expect(evaluateIntakeSafety(fixtureText)).toMatchObject({
      branch: "escalated",
      ruleId: "chest-pain-with-dyspnea",
    });
  });
});

describe("intake interpretation guard", () => {
  const request = {
    preferredLanguage: "Tagalog" as const,
    chiefComplaint: "Masakit ang ulo ko ngayon. Parang wala na akong marinig.",
    clarificationQuestion: "Maaari mo bang ilarawan ito sa ibang salita?",
    clarificationResponse: "Parang may bumubugbog sa ulo ko.",
  };

  test("accepts a bounded English interpretation that differs from the source", () => {
    const interpretation = IntakeInterpretationSchema.parse({
      patientInterpretation: "Masakit ang ulo ngayon at parang wala nang marinig; parang may bumubugbog sa ulo.",
      englishInterpretation: "The patient reports a current headache, reduced hearing, and a sensation as if someone were hitting their head.",
      visitTopics: [
        { nativeSummary: "Pananakit ng ulo", englishSummary: "Headache" },
        { nativeSummary: "Pagbabago sa pandinig", englishSummary: "Change in hearing" },
      ],
      confidence: "medium",
      ambiguities: ["It is unclear whether hearing is completely absent or reduced."],
    });
    expect(interpretationValidationError(request, interpretation)).toBeNull();
  });

  test("rejects source-language text presented as an English interpretation", () => {
    const interpretation = IntakeInterpretationSchema.parse({
      patientInterpretation: request.chiefComplaint,
      englishInterpretation: `Patient report in Tagalog: ${request.chiefComplaint}`,
      visitTopics: [{ nativeSummary: "Masakit ang ulo", englishSummary: "Headache" }],
      confidence: "low",
      ambiguities: [],
    });
    expect(interpretationValidationError(request, interpretation)).toContain("source-language");
  });

  test("allows same-language confirmation when the intake itself is English", () => {
    const englishRequest = {
      preferredLanguage: "English",
      languageCode: "en",
      chiefComplaint: "My left foot has hurt for six months.",
      clarificationQuestion: "Where does the pain start?",
      clarificationResponse: "It starts in my big toe.",
    };
    const interpretation = IntakeInterpretationSchema.parse({
      patientInterpretation: "My left foot has hurt for six months, starting in my big toe.",
      englishInterpretation: "My left foot has hurt for six months, starting in my big toe.",
      visitTopics: [{
        nativeSummary: "Six months of left-foot pain starting in the big toe",
        englishSummary: "Six months of left-foot pain starting in the big toe",
      }],
      confidence: "medium",
      ambiguities: [],
    });
    expect(interpretationValidationError(englishRequest, interpretation)).toBeNull();
  });

  test("rejects Tagalog leakage even when the claimed language label is wrong", () => {
    const mislabeledRequest = { ...request, preferredLanguage: "French", languageCode: "fr" };
    const interpretation = IntakeInterpretationSchema.parse({
      patientInterpretation: request.chiefComplaint,
      englishInterpretation: "Masakit ang ulo ko at parang wala akong marinig ngayon.",
      visitTopics: [{ nativeSummary: "Masakit ang ulo", englishSummary: "Masakit ang ulo" }],
      confidence: "low",
      ambiguities: [],
    });
    expect(interpretationValidationError(mislabeledRequest, interpretation)).toContain("source language");
  });

  test("rejects French text presented as the English clinician view", () => {
    const frenchRequest = {
      preferredLanguage: "French",
      languageCode: "fr",
      chiefComplaint: "Bonjour docteur, j’ai mal au pied gauche depuis six mois et mon médicament ne fonctionne pas.",
      clarificationQuestion: "Où la douleur commence-t-elle ?",
      clarificationResponse: "La douleur commence dans le gros orteil.",
    };
    const interpretation = IntakeInterpretationSchema.parse({
      patientInterpretation: "J’ai mal au pied gauche depuis six mois, avec une douleur qui commence dans le gros orteil.",
      englishInterpretation: "La douleur au pied gauche dure depuis six mois et commence dans le gros orteil.",
      visitTopics: [{ nativeSummary: "Douleur au pied gauche", englishSummary: "Douleur au pied gauche" }],
      confidence: "low",
      ambiguities: [],
    });
    expect(interpretationValidationError(frenchRequest, interpretation)).toContain("source language");
  });

  test("rejects short French leakage in the English clinician view", () => {
    const frenchRequest = {
      preferredLanguage: "French",
      languageCode: "fr",
      chiefComplaint: "Bonjour docteur, j’ai mal au pied gauche depuis six mois.",
      clarificationQuestion: "Où la douleur commence-t-elle ?",
      clarificationResponse: "La douleur commence dans le gros orteil.",
    };
    const interpretation = IntakeInterpretationSchema.parse({
      patientInterpretation: "J’ai mal au pied gauche depuis six mois et la douleur commence dans le gros orteil.",
      englishInterpretation: "Mal au pied gauche",
      visitTopics: [{ nativeSummary: "Douleur au pied gauche", englishSummary: "Douleur au pied gauche" }],
      confidence: "low",
      ambiguities: [],
    });
    expect(interpretationValidationError(frenchRequest, interpretation)).toContain("source language");
  });

  test("rejects Japanese text presented as the English clinician view", () => {
    const japaneseRequest = {
      preferredLanguage: "Japanese",
      languageCode: "ja",
      chiefComplaint: "左足が六か月前から痛くて、薬が効いていないようです。",
      clarificationQuestion: "痛みはどこから始まりますか？",
      clarificationResponse: "足の親指から始まります。",
    };
    const interpretation = IntakeInterpretationSchema.parse({
      patientInterpretation: "左足が六か月痛く、痛みは足の親指から始まります。",
      englishInterpretation: "左足の痛みが六か月続き、足の親指から始まります。",
      visitTopics: [{ nativeSummary: "左足の痛み", englishSummary: "左足の痛み" }],
      confidence: "low",
      ambiguities: [],
    });
    expect(interpretationValidationError(japaneseRequest, interpretation)).toContain("source-language");
  });

  test("accepts a real English interpretation of French intake", () => {
    const frenchRequest = {
      preferredLanguage: "French",
      languageCode: "fr",
      chiefComplaint: "Bonjour docteur, j’ai mal au pied gauche depuis six mois.",
      clarificationQuestion: "Où la douleur commence-t-elle ?",
      clarificationResponse: "La douleur commence dans le gros orteil.",
    };
    const interpretation = IntakeInterpretationSchema.parse({
      patientInterpretation: "J’ai mal au pied gauche depuis six mois et la douleur commence dans le gros orteil.",
      englishInterpretation: "The patient has had left foot pain for six months, starting in the big toe.",
      visitTopics: [{ nativeSummary: "Douleur au pied gauche", englishSummary: "Left foot pain" }],
      confidence: "medium",
      ambiguities: [],
    });
    expect(interpretationValidationError(frenchRequest, interpretation)).toBeNull();
  });

  test("rejects a native restatement in the wrong language", () => {
    const frenchRequest = {
      preferredLanguage: "French",
      languageCode: "fr",
      chiefComplaint: "Bonjour docteur, j’ai mal au pied gauche depuis six mois.",
      clarificationQuestion: "Où la douleur commence-t-elle ?",
      clarificationResponse: "La douleur commence dans le gros orteil.",
    };
    const interpretation = IntakeInterpretationSchema.parse({
      patientInterpretation: "The patient has had left foot pain for six months and it starts in the big toe.",
      englishInterpretation: "The patient has had left foot pain for six months, starting in the big toe.",
      visitTopics: [{ nativeSummary: "Left foot pain", englishSummary: "Left foot pain" }],
      confidence: "low",
      ambiguities: [],
    });
    expect(interpretationValidationError(frenchRequest, interpretation)).toContain("Native-language");
  });

  test("does not allow a model-generated high-confidence translation", () => {
    expect(IntakeInterpretationSchema.safeParse({
      patientInterpretation: "Masakit ang ulo.",
      englishInterpretation: "The patient has a headache.",
      visitTopics: [{ nativeSummary: "Masakit ang ulo", englishSummary: "Headache" }],
      confidence: "high",
      ambiguities: [],
    }).success).toBe(false);
  });

  test("requires one to eight structured visit topics", () => {
    const base = {
      patientInterpretation: "Masakit ang ulo.",
      englishInterpretation: "The patient has a headache.",
      confidence: "medium" as const,
      ambiguities: [],
    };
    const topic = { nativeSummary: "Masakit ang ulo", englishSummary: "Headache" };

    expect(IntakeInterpretationSchema.safeParse({ ...base, visitTopics: [] }).success).toBe(false);
    expect(IntakeInterpretationSchema.safeParse({ ...base, visitTopics: Array.from({ length: 8 }, () => topic) }).success).toBe(true);
    expect(IntakeInterpretationSchema.safeParse({ ...base, visitTopics: Array.from({ length: 9 }, () => topic) }).success).toBe(false);
  });
});
