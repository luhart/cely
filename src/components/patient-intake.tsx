"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Bot,
  Check,
  Languages,
  PencilLine,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { type FormEvent, useId, useMemo, useRef, useState } from "react";

import {
  IntakeInterpretationSchema,
  type ConfirmedIntake,
  type IntakeInterpretation,
  type UrgentIntake,
} from "@/lib/workflow/contracts";
import {
  detectIntakeLanguage,
  resolveLanguageOverride,
  type DetectedIntakeLanguage,
} from "@/lib/workflow/language";
import { languageExperience } from "@/lib/workflow/language-profiles";
import { evaluateIntakeSafety, type IntakeSafetyDecision } from "@/lib/workflow/policy";

export type { ConfirmedIntake, UrgentIntake } from "@/lib/workflow/contracts";

type IntakeStage = "complaint" | "language" | "clarification" | "confirmation" | "confirmed" | "urgent";
type PreferredLanguage = ConfirmedIntake["preferredLanguage"];
type InterpretationStatus = "idle" | "loading" | "ready" | "error";
type GeneratedInterpretation = IntakeInterpretation & { model: string };

type AlternateDemo = {
  buttonLabel: string;
  complaint: string;
  clarificationQuestion: string;
  clarificationQuestionEnglish: string;
  clarificationPlaceholder: string;
  clarification: string;
  patientInterpretation: string;
  englishInterpretation: string;
  visitTopics: Array<{ nativeSummary: string; englishSummary: string }>;
  confidence: "medium" | "high";
  ambiguities: string[];
};

type IntakeScript = {
  code: string;
  nativeLabel: string;
  englishLabel: string;
  complaintPrompt: string;
  complaintPromptEnglish: string;
  complaintLabel: string;
  complaintLabelEnglish: string;
  complaintPlaceholder: string;
  demoComplaint: string;
  clarificationQuestion: string;
  clarificationQuestionEnglish: string;
  clarificationLabel: string;
  clarificationLabelEnglish: string;
  clarificationPlaceholder: string;
  demoClarification: string;
  confirmationHeading: string;
  confirmationLead: string;
  demoPatientInterpretation: string;
  demoEnglishInterpretation: string;
  demoVisitTopics: Array<{ nativeSummary: string; englishSummary: string }>;
  alternateDemo?: AlternateDemo;
  confirmLabel: string;
  controls: {
    changeLanguage: string;
    useDemo: string;
    continue: string;
    reviewMeaning: string;
    editAnswers: string;
    back: string;
    meaningHeading: string;
    meaningDetail: string;
    lowConfidence: string;
    priorityHeading: string;
    priorityHelp: string;
    noPreference: string;
    confirmed: string;
  };
};

const scripts: Record<string, IntakeScript> = {
  Tagalog: {
    code: "tl",
    nativeLabel: "Tagalog",
    englishLabel: "Tagalog",
    complaintPrompt: "Bago ang iyong pagbisita, ano-ano ang gusto mong siguraduhing matalakay sa iyong doktor? Ilista ang lahat ng mahalaga sa iyo.",
    complaintPromptEnglish: "Before your visit, tell us everything you want to make sure your doctor addresses.",
    complaintLabel: "Ilarawan sa sarili mong mga salita",
    complaintLabelEnglish: "Describe it in your own words",
    complaintPlaceholder: "Halimbawa: Kumikirot ang kanang balikat ko…",
    demoComplaint:
      "Kumikirot ang kanang balikat ko halos isang buwan na. Nahihilo rin ako tuwing umaga, kaya tumigil ako sa gamot sa presyon dalawang linggo na ang nakalipas.",
    clarificationQuestion:
      "Kapag sinabi mong “kumikirot,” alin ang pinakamalapit: paulit-ulit na pananakit, mahapdi o nasusunog, o ibang pakiramdam?",
    clarificationQuestionEnglish:
      "When you say “kumikirot,” which is closest: an intermittent ache, stinging or burning, or a different feeling?",
    clarificationLabel: "Magdagdag ng kaunting detalye",
    clarificationLabelEnglish: "Add one clarifying detail",
    clarificationPlaceholder: "Sabihin kung ano ang pinakamalapit na pakiramdam…",
    demoClarification: "Paulit-ulit na pananakit, lalo na kapag itinataas ko ang braso.",
    confirmationHeading: "Ito ba ang ibig mong sabihin?",
    confirmationLead: "Nauunawaan namin na",
    demoPatientInterpretation:
      "May paulit-ulit na kirot sa kanang balikat sa loob ng halos isang buwan, mas masakit kapag itinataas ang braso. Dahil sa pagkahilo tuwing umaga, itinigil ang gamot sa presyon mga dalawang linggo na ang nakalipas.",
    demoEnglishInterpretation:
      "Intermittent aching in the right shoulder for nearly one month, worse when raising the arm. Morning dizziness led the patient to stop the blood-pressure medication about two weeks ago.",
    demoVisitTopics: [
      {
        nativeSummary: "Paulit-ulit na kirot sa kanang balikat, lalo na kapag itinataas ang braso",
        englishSummary: "Intermittent right shoulder aching, worse when raising the arm",
      },
      {
        nativeSummary: "Pagkahilo sa umaga at pagtigil sa gamot sa presyon",
        englishSummary: "Morning dizziness and stopping the blood-pressure medication",
      },
    ],
    alternateDemo: {
      buttonLabel: "Halimbawa: pananakit ng paa",
      complaint:
        "Doc, anim na buwan na pong masakit ang kaliwa kong paa, at parang hindi po gumagana ang gamot ko. Lagi pong sinasabi ng doktor na arthritis ito dahil masakit tuwing umaga, pero hindi naman po gumagaling. Napansin ko po na mas masakit siya tuwing kumakain ako ng baboy.",
      clarificationQuestion:
        "Saan nagsisimula ang sakit, at paano mo ilalarawan ang sakit kapag pinakamalala?",
      clarificationQuestionEnglish:
        "Where does the pain start, and how would you describe it when it is at its worst?",
      clarificationPlaceholder: "Sabihin kung saan nagsisimula at kung matalas, mahapdi, pumipintig, o iba…",
      clarification: "Oo, matalas at matinding sakit po ito sa mga binti ko pero nagsisimula sa hinlalaki ng paa ko.",
      patientInterpretation:
        "Anim na buwan nang masakit ang kaliwang paa. Pakiramdam ng pasyente ay hindi nakatutulong ang gamot. Sinabi raw ng doktor na arthritis dahil masakit sa umaga, ngunit hindi gumagaling. Napapansin niyang mas sumasakit pagkatapos kumain ng baboy. Matalas at matindi ang sakit sa mga binti at nagsisimula sa hinlalaki ng paa.",
      englishInterpretation:
        "Left foot pain for six months; the patient feels the current medication is not helping. A previous doctor has called it arthritis because it hurts in the morning, but it has not improved. The patient reports worse pain after eating pork. The pain is sharp and severe in the legs and starts at the big toe.",
      visitTopics: [
        {
          nativeSummary: "Anim na buwang matalas at matinding sakit sa kaliwang paa na nagsisimula sa hinlalaki",
          englishSummary: "Six months of sharp, severe left-foot pain starting at the big toe",
        },
        {
          nativeSummary: "Pakiramdam na hindi nakatutulong ang kasalukuyang gamot",
          englishSummary: "Concern that the current medication is not helping",
        },
        {
          nativeSummary: "Naunang paliwanag na arthritis ngunit hindi gumagaling ang sakit",
          englishSummary: "Prior arthritis explanation with persistent symptoms",
        },
        {
          nativeSummary: "Napapansing mas sumasakit pagkatapos kumain ng baboy",
          englishSummary: "Patient-observed worsening after eating pork",
        },
      ],
      confidence: "medium",
      ambiguities: [
        "The medication name, dose, adherence, and indication are not specified.",
        "The extent and timing of pain described as involving the legs but starting at the big toe require clinician clarification.",
        "Worsening after eating pork is a patient-observed association and is not presented as a confirmed cause.",
      ],
    },
    confirmLabel: "Oo, tama ito",
    controls: {
      changeLanguage: "Palitan ang wika",
      useDemo: "Gamitin ang demo",
      continue: "Magpatuloy",
      reviewMeaning: "Suriin ang kahulugan",
      editAnswers: "Baguhin ang sagot",
      back: "Bumalik",
      meaningHeading: "Kailangang linawin ang kahulugan",
      meaningDetail: "Pinanatili ang di-tiyak na parirala sa halip na hulaan.",
      lowConfidence: "Mababang kumpiyansa",
      priorityHeading: "Ano ang pinakamahalagang matalakay muna?",
      priorityHelp: "Piliin ang pangunahing pakay mo. Maaaring unahin ng care team ang ibang alalahanin para sa kaligtasan.",
      noPreference: "Walang partikular na prayoridad",
      confirmed: "Kinumpirma ng pasyente ang kahulugan at prayoridad · handa para sa care team",
    },
  },
  Spanish: {
    code: "es",
    nativeLabel: "Español",
    englishLabel: "Spanish",
    complaintPrompt: "Antes de su visita, cuéntenos todo lo que quiere asegurarse de hablar con su médico.",
    complaintPromptEnglish: "Before your visit, tell us everything you want to make sure your doctor addresses.",
    complaintLabel: "Descríbalo con sus propias palabras",
    complaintLabelEnglish: "Describe it in your own words",
    complaintPlaceholder: "Por ejemplo: Me mareo por las mañanas…",
    demoComplaint: "Me mareo por las mañanas desde que dejé de tomar la pastilla para la presión.",
    clarificationQuestion:
      "¿Dejó la medicina antes de que empezaran los mareos, o la dejó porque ya se sentía mareada?",
    clarificationQuestionEnglish:
      "Did you stop the medicine before the dizziness began, or because you were already feeling dizzy?",
    clarificationLabel: "Añada un detalle para aclararlo",
    clarificationLabelEnglish: "Add one clarifying detail",
    clarificationPlaceholder: "Cuéntenos qué ocurrió primero…",
    demoClarification: "La dejé porque ya me sentía mareada.",
    confirmationHeading: "¿Esto es lo que quiso decir?",
    confirmationLead: "Entendemos que",
    demoPatientInterpretation:
      "Los mareos por la mañana comenzaron antes de dejar la medicina para la presión; dejó de tomarla porque ya se sentía mareada.",
    demoEnglishInterpretation:
      "Morning dizziness began before the patient stopped the blood-pressure medication; the medication was stopped because of the dizziness.",
    demoVisitTopics: [
      {
        nativeSummary: "Mareos por la mañana y suspensión de la medicina para la presión",
        englishSummary: "Morning dizziness and stopping the blood-pressure medication",
      },
    ],
    confirmLabel: "Sí, es correcto",
    controls: {
      changeLanguage: "Cambiar idioma",
      useDemo: "Usar respuesta de demo",
      continue: "Continuar",
      reviewMeaning: "Revisar el significado",
      editAnswers: "Editar respuestas",
      back: "Volver",
      meaningHeading: "Hay que aclarar el significado",
      meaningDetail: "Conservamos una frase matizada en lugar de adivinar.",
      lowConfidence: "Baja confianza",
      priorityHeading: "¿Qué es lo más importante para hablar primero?",
      priorityHelp: "Elija su prioridad principal. El equipo puede adelantar otro tema por seguridad.",
      noPreference: "Sin preferencia específica",
      confirmed: "Significado y prioridad confirmados · listo para el equipo de atención",
    },
  },
};

function genericScript(languageName: string, languageCode: string): IntakeScript {
  const experience = languageExperience(languageName);
  return {
    code: languageCode,
    nativeLabel: languageName,
    englishLabel: languageName,
    complaintPrompt: "Tell us what you want to make sure is addressed during your visit.",
    complaintPromptEnglish: "Tell us what you want to make sure is addressed during your visit.",
    complaintLabel: "Describe it in your own words",
    complaintLabelEnglish: "Describe it in your own words",
    complaintPlaceholder: "Write naturally in your own language…",
    demoComplaint: "",
    clarificationQuestion: experience.clarificationQuestion,
    clarificationQuestionEnglish: "Can you add one detail about when this started or what it feels like?",
    clarificationLabel: "Add one clarifying detail",
    clarificationLabelEnglish: "Add one clarifying detail",
    clarificationPlaceholder: "Respond in your own language…",
    demoClarification: "",
    confirmationHeading: experience.confirmationHeading,
    confirmationLead: "",
    demoPatientInterpretation: "",
    demoEnglishInterpretation: "",
    demoVisitTopics: [],
    confirmLabel: experience.confirmLabel,
    controls: {
      changeLanguage: experience.changeLanguage,
      useDemo: "Use demo",
      continue: "Continue",
      reviewMeaning: "Review meaning",
      editAnswers: "Edit answers",
      back: "Back",
      meaningHeading: "One detail needs clarification",
      meaningDetail: "We preserve uncertain wording instead of guessing.",
      lowConfidence: "Needs clarification",
      priorityHeading: experience.priorityHeading,
      priorityHelp: "Choose your top priority. The care team may move another concern earlier for safety.",
      noPreference: experience.noPreference,
      confirmed: "Meaning and priority confirmed · ready for the care team",
    },
  };
}

const stageLabels = ["Symptoms", "Language", "Clarify", "Confirm"] as const;

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function urgentGuidance(language: PreferredLanguage, ruleId: IntakeSafetyDecision["ruleId"]): string {
  if (ruleId === "self-harm") {
    if (language === "Tagalog") return "Kailangan mo ng agarang suporta mula sa isang tao. Kung may agarang panganib, tumawag sa lokal na serbisyong pang-emergency ngayon; sa U.S., tumawag o mag-text sa 988.";
    if (language === "Spanish") return "Necesita apoyo humano inmediato. Si hay peligro inmediato, llame ahora a los servicios de emergencia locales; en EE. UU., llame o envíe un mensaje de texto al 988.";
    return "This needs immediate human support. If there is immediate danger, call local emergency services now; in the U.S., call or text 988.";
  }
  if (language === "Tagalog") return "Maaaring emergency ito. Tumawag sa lokal na serbisyong pang-emergency ngayon at huwag hintayin ang appointment.";
  if (language === "Spanish") return "Esto puede ser una emergencia. Llame ahora a los servicios de emergencia locales y no espere a la cita.";
  return "This may be an emergency. Call local emergency services now and do not wait for the appointment.";
}

function confidenceLabel(language: PreferredLanguage, confidence: "low" | "medium" | "high"): string {
  if (language === "Tagalog") {
    if (confidence === "high") return "Mataas na kumpiyansa";
    if (confidence === "medium") return "Katamtamang kumpiyansa";
    return "Mababang kumpiyansa";
  }
  if (language === "Spanish") {
    if (confidence === "high") return "Alta confianza";
    if (confidence === "medium") return "Confianza media";
    return "Baja confianza";
  }
  if (confidence === "high") return "High confidence";
  if (confidence === "medium") return "Medium confidence";
  return "Low confidence";
}

function IntakeMessage({
  speaker,
  patientName,
  patientInitials,
  text,
  translated,
  languageCode,
}: {
  speaker: "behemoth" | "patient";
  patientName: string;
  patientInitials: string;
  text: string;
  translated?: string;
  languageCode: string;
}) {
  return (
    <div className={`message-row ${speaker} is-visible`}>
      <div className="message-avatar" aria-hidden="true">
        {speaker === "behemoth" ? <Bot size={15} /> : patientInitials}
      </div>
      <div className="message-bubble">
        <div className="message-speaker">{speaker === "behemoth" ? "Behemoth" : patientName}</div>
        <p lang={languageCode} dir="auto">{text}</p>
        {translated ? (
          <div className="translation" lang="en">
            <Languages size={12} aria-hidden="true" /> {translated}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PatientIntake({
  patientName = "Maya",
  patientInitials = "MP",
  disabled = false,
  onConfirmed,
  onUrgent,
}: {
  patientName?: string;
  patientInitials?: string;
  disabled?: boolean;
  onConfirmed: (intake: ConfirmedIntake) => void;
  onUrgent: (intake: UrgentIntake) => void;
}) {
  const complaintId = useId();
  const clarificationId = useId();
  const priorityGroupName = useId();
  const confirmedRef = useRef(false);
  const interpretationRequestRef = useRef(0);
  const interpretationAbortRef = useRef<AbortController | null>(null);
  const [stage, setStage] = useState<IntakeStage>("complaint");
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage | null>(null);
  const [languageCode, setLanguageCode] = useState<string | null>(null);
  const [languageProvenance, setLanguageProvenance] = useState<"detected" | "manual" | null>(null);
  const [languageCandidate, setLanguageCandidate] = useState<DetectedIntakeLanguage | null>(null);
  const [manualLanguage, setManualLanguage] = useState("");
  const [languageError, setLanguageError] = useState<string | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [clarificationResponse, setClarificationResponse] = useState("");
  const [safetyDecision, setSafetyDecision] = useState<IntakeSafetyDecision | null>(null);
  const [generatedInterpretation, setGeneratedInterpretation] = useState<GeneratedInterpretation | null>(null);
  const [interpretationStatus, setInterpretationStatus] = useState<InterpretationStatus>("idle");
  const [interpretationError, setInterpretationError] = useState<string | null>(null);
  const [topConcernChoice, setTopConcernChoice] = useState<number | "none" | null>(null);

  const script = useMemo(() => preferredLanguage && languageCode
    ? scripts[preferredLanguage] ?? genericScript(preferredLanguage, languageCode)
    : null, [languageCode, preferredLanguage]);
  const stageIndex = stage === "confirmed" ? stageLabels.length : stage === "urgent" ? 1 : stageLabels.indexOf(
    stage === "complaint" ? "Symptoms" : stage === "language" ? "Language" : stage === "clarification" ? "Clarify" : "Confirm",
  );

  const demoForComplaint = useMemo(() => {
    if (!script) return null;
    if (normalize(chiefComplaint) === normalize(script.demoComplaint)) {
      return {
        buttonLabel: script.controls.useDemo,
        clarificationQuestion: script.clarificationQuestion,
        clarificationQuestionEnglish: script.clarificationQuestionEnglish,
        clarificationPlaceholder: script.clarificationPlaceholder,
        clarification: script.demoClarification,
        patientInterpretation: script.demoPatientInterpretation,
        englishInterpretation: script.demoEnglishInterpretation,
        visitTopics: script.demoVisitTopics,
        confidence: "high" as const,
        ambiguities: [] as string[],
      };
    }
    if (script.alternateDemo && normalize(chiefComplaint) === normalize(script.alternateDemo.complaint)) {
      return script.alternateDemo;
    }
    return null;
  }, [chiefComplaint, script]);

  const clarification = useMemo(() => {
    if (!script || !preferredLanguage) return null;
    if (demoForComplaint) {
      return {
        question: demoForComplaint.clarificationQuestion,
        questionEnglish: demoForComplaint.clarificationQuestionEnglish,
        placeholder: demoForComplaint.clarificationPlaceholder,
      };
    }
    const normalizedComplaint = normalize(chiefComplaint);
    const matchesKnownNuance = preferredLanguage === "Tagalog"
      ? normalizedComplaint.includes("kumikirot")
      : preferredLanguage === "Spanish"
        ? /\b(mareo|mareada|medicina|pastilla|presi[oó]n)\b/i.test(chiefComplaint)
        : false;
    if (matchesKnownNuance) {
      return {
        question: script.clarificationQuestion,
        questionEnglish: script.clarificationQuestionEnglish,
        placeholder: script.clarificationPlaceholder,
      };
    }
    return preferredLanguage === "Tagalog"
      ? {
          question: "Maaari mo bang ilarawan sa ibang salita kung saan at ano ang nararamdaman mo?",
          questionEnglish: "Can you describe in different words where it is and what it feels like?",
          placeholder: "Ilarawan ang lugar at pakiramdam sa ibang salita…",
        }
      : preferredLanguage === "Spanish"
        ? {
          question: "¿Puede describir con otras palabras dónde lo siente y cómo se siente?",
          questionEnglish: "Can you describe in different words where it is and what it feels like?",
          placeholder: "Describa el lugar y la sensación con otras palabras…",
        }
        : {
          question: script.clarificationQuestion,
          questionEnglish: script.clarificationQuestionEnglish,
          placeholder: script.clarificationPlaceholder,
        };
  }, [chiefComplaint, demoForComplaint, preferredLanguage, script]);

  const matchedDemo = demoForComplaint && normalize(clarificationResponse) === normalize(demoForComplaint.clarification)
    ? demoForComplaint
    : null;
  const isDemoResponse = Boolean(matchedDemo);

  const interpretation = useMemo(() => {
    if (!script || !preferredLanguage) return null;
    if (matchedDemo) {
      return {
        patient: matchedDemo.patientInterpretation,
        english: matchedDemo.englishInterpretation,
        confidence: matchedDemo.confidence,
        ambiguities: matchedDemo.ambiguities,
        visitTopics: matchedDemo.visitTopics,
        method: "deterministic" as const,
        model: "Golden-path fixture",
      };
    }
    if (!generatedInterpretation) return null;
    return {
      patient: generatedInterpretation.patientInterpretation,
      english: generatedInterpretation.englishInterpretation,
      confidence: generatedInterpretation.confidence,
      ambiguities: generatedInterpretation.ambiguities,
      visitTopics: generatedInterpretation.visitTopics,
      method: "sonnet" as const,
      model: generatedInterpretation.model,
    };
  }, [generatedInterpretation, matchedDemo, preferredLanguage, script]);

  const resetGeneratedInterpretation = () => {
    interpretationAbortRef.current?.abort();
    interpretationAbortRef.current = null;
    interpretationRequestRef.current += 1;
    setGeneratedInterpretation(null);
    setInterpretationStatus("idle");
    setInterpretationError(null);
    setTopConcernChoice(null);
  };

  const applyLanguage = (language: DetectedIntakeLanguage, provenance: "detected" | "manual") => {
    confirmedRef.current = false;
    resetGeneratedInterpretation();
    setPreferredLanguage(language.languageName);
    setLanguageCode(language.languageCode);
    setLanguageProvenance(provenance);
    setLanguageCandidate(null);
    setManualLanguage(language.languageName);
    setLanguageError(null);
    setClarificationResponse("");
    setSafetyDecision(null);
    setStage("clarification");
  };

  const changeLanguage = () => {
    confirmedRef.current = false;
    resetGeneratedInterpretation();
    setLanguageCandidate(preferredLanguage ? resolveLanguageOverride(preferredLanguage) : null);
    setManualLanguage(preferredLanguage ?? "");
    setLanguageError(null);
    setClarificationResponse("");
    setSafetyDecision(null);
    setStage("language");
  };

  const editFirstMessage = () => {
    confirmedRef.current = false;
    resetGeneratedInterpretation();
    setPreferredLanguage(null);
    setLanguageCode(null);
    setLanguageProvenance(null);
    setLanguageCandidate(null);
    setManualLanguage("");
    setLanguageError(null);
    setClarificationResponse("");
    setSafetyDecision(null);
    setStage("complaint");
  };

  const sendUrgentIntake = (input: {
    safety: IntakeSafetyDecision;
    languageName: string;
    code: string;
    provenance: "detected" | "manual";
    urgentClarification?: string;
    englishSafetyTranslation?: string;
  }) => {
    if (disabled || !input.safety.ruleId) return;
    onUrgent({
      preferredLanguage: input.languageName,
      languageCode: input.code,
      languageProvenance: input.provenance,
      chiefComplaint: chiefComplaint.trim(),
      clarificationResponse: input.urgentClarification?.trim() || undefined,
      englishSafetyTranslation: input.englishSafetyTranslation?.trim() || undefined,
      safetyRuleId: input.safety.ruleId,
      guidanceDisplayed: true,
    });
  };

  const submitComplaint = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || chiefComplaint.trim().length < 3) return;
    const safety = evaluateIntakeSafety(chiefComplaint);
    const detection = detectIntakeLanguage(chiefComplaint);
    if (safety.branch === "escalated" && safety.ruleId) {
      const languageName = detection.status === "detected" ? detection.languageName : "Undetermined";
      const code = detection.status === "detected" ? detection.languageCode : "und";
      confirmedRef.current = true;
      setPreferredLanguage(languageName);
      setLanguageCode(code);
      setLanguageProvenance("detected");
      setSafetyDecision(safety);
      setStage("urgent");
      sendUrgentIntake({ safety, languageName, code, provenance: "detected" });
      return;
    }
    if (detection.status === "detected" && detection.confidence === "high") {
      applyLanguage(detection, "detected");
      return;
    }
    setLanguageCandidate(detection.status === "detected" ? detection : null);
    setManualLanguage(detection.status === "detected" ? detection.languageName : "");
    setLanguageError(detection.status === "detected"
      ? "Please confirm the detected language before we continue."
      : "We could not identify the language confidently. Enter the language without retyping the message.");
    setStage("language");
  };

  const submitManualLanguage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const language = resolveLanguageOverride(manualLanguage);
    if (!language) {
      setLanguageError("Enter a common language name, such as French, Arabic, Hindi, Vietnamese, or Japanese.");
      return;
    }
    applyLanguage(language, "manual");
  };

  const submitClarification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || interpretationStatus === "loading" || clarificationResponse.trim().length < 2 || !preferredLanguage || !languageCode || !clarification) return;
    const safety = evaluateIntakeSafety(`${chiefComplaint} ${clarificationResponse}`);
    if (safety.branch === "escalated" && safety.ruleId) {
      confirmedRef.current = true;
      setSafetyDecision(safety);
      setStage("urgent");
      sendUrgentIntake({
        safety,
        languageName: preferredLanguage,
        code: languageCode,
        provenance: languageProvenance ?? "detected",
        urgentClarification: clarificationResponse,
      });
      return;
    }
    if (isDemoResponse) {
      setInterpretationStatus("ready");
      setStage("confirmation");
      return;
    }

    const requestId = interpretationRequestRef.current + 1;
    interpretationRequestRef.current = requestId;
    interpretationAbortRef.current?.abort();
    const controller = new AbortController();
    interpretationAbortRef.current = controller;
    setGeneratedInterpretation(null);
    setInterpretationError(null);
    setInterpretationStatus("loading");

    try {
      const response = await fetch("/api/intake/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          preferredLanguage,
          languageCode,
          chiefComplaint: chiefComplaint.trim(),
          clarificationQuestion: clarification.question,
          clarificationResponse: clarificationResponse.trim(),
        }),
      });
      const payload = (await response.json()) as {
        interpretation?: unknown;
        model?: string;
        error?: string;
        safety?: IntakeSafetyDecision;
        englishSafetyTranslation?: string;
      };
      if (requestId !== interpretationRequestRef.current) return;
      if (response.status === 409 && payload.safety?.branch === "escalated" && payload.safety.ruleId) {
        confirmedRef.current = true;
        setSafetyDecision(payload.safety);
        setInterpretationStatus("idle");
        setStage("urgent");
        sendUrgentIntake({
          safety: payload.safety,
          languageName: preferredLanguage,
          code: languageCode,
          provenance: languageProvenance ?? "detected",
          urgentClarification: clarificationResponse,
          englishSafetyTranslation: payload.englishSafetyTranslation,
        });
        return;
      }
      if (!response.ok) throw new Error(payload.error ?? "Interpretation failed.");
      const parsedInterpretation = IntakeInterpretationSchema.safeParse(payload.interpretation);
      if (!parsedInterpretation.success) throw new Error("Interpretation response was invalid.");
      setGeneratedInterpretation({
        ...parsedInterpretation.data,
        model: payload.model ?? "claude-sonnet-5",
      });
      setInterpretationStatus("ready");
      setStage("confirmation");
    } catch {
      if (controller.signal.aborted || requestId !== interpretationRequestRef.current) return;
      setInterpretationStatus("error");
      setInterpretationError(preferredLanguage === "Tagalog"
        ? "Hindi makagawa ng ligtas na English interpretation ngayon. Pakisubukang muli o humingi ng kwalipikadong interpreter."
        : preferredLanguage === "Spanish"
          ? "No se pudo generar una interpretación segura en inglés. Inténtelo de nuevo o solicite un intérprete calificado."
          : "A safe English interpretation is not available right now. Please retry or use a qualified interpreter.");
    } finally {
      if (requestId === interpretationRequestRef.current) interpretationAbortRef.current = null;
    }
  };

  const confirmInterpretation = () => {
    if (disabled || confirmedRef.current || !preferredLanguage || !languageCode || !script || !interpretation || !clarification || topConcernChoice === null) return;
    confirmedRef.current = true;
    setStage("confirmed");
    onConfirmed({
      preferredLanguage,
      languageCode,
      languageProvenance: languageProvenance ?? "detected",
      chiefComplaint: chiefComplaint.trim(),
      clarificationQuestion: clarification.question,
      clarificationResponse: clarificationResponse.trim(),
      nativeInterpretation: interpretation.patient,
      englishInterpretation: interpretation.english,
      interpretationMethod: interpretation.method,
      ambiguities: interpretation.ambiguities,
      confirmedConcerns: interpretation.visitTopics.map((topic, index) => ({
        id: `patient-concern-${index + 1}`,
        nativeSummary: topic.nativeSummary,
        englishSummary: topic.englishSummary,
        mentionOrder: index + 1,
      })),
      topConcernId: typeof topConcernChoice === "number" ? `patient-concern-${topConcernChoice + 1}` : null,
      priorityConfirmed: true,
      interpretationConfirmed: true,
      confidence: interpretation.confidence,
    });
  };

  return (
    <section className="patient-intake" aria-label="Guided patient intake">
      <div className="intake-progress" aria-label={`Intake progress: step ${Math.min(stageIndex + 1, 4)} of 4`}>
        {stageLabels.map((label, index) => {
          const complete = index < stageIndex;
          const current = index === stageIndex;
          return (
            <div
              className={`intake-progress-step ${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`}
              key={label}
              aria-current={current ? "step" : undefined}
            >
              <span>{complete ? <Check size={11} aria-hidden="true" /> : index + 1}</span>
              {label}
            </div>
          );
        })}
        {preferredLanguage && stage !== "complaint" && stage !== "language" && stage !== "confirmed" && stage !== "urgent" ? (
          <button className="intake-language-reset" type="button" onClick={changeLanguage} disabled={disabled || interpretationStatus === "loading"}>
            {preferredLanguage} {languageProvenance === "manual" ? "selected" : "detected"} · {script?.controls.changeLanguage ?? "Change language"}
          </button>
        ) : null}
      </div>

      <div className="patient-intake-content" aria-live="polite">
        {stage === "complaint" ? (
          <div className="intake-language-stage">
            <div className="message-row behemoth is-visible">
              <div className="message-avatar" aria-hidden="true"><Bot size={15} /></div>
              <div className="message-bubble">
                <div className="message-speaker">Behemoth</div>
                <p>Tell us what you want your care team to address. Write naturally in any language.</p>
                <div className="translation"><Languages size={12} aria-hidden="true" /> Español · Tagalog · Français · العربية · हिन्दी · 中文 · 日本語 · and more</div>
              </div>
            </div>
            <form className="intake-composer intake-first-message" onSubmit={submitComplaint}>
              <label htmlFor={complaintId}>Your first message — any language</label>
              <span className="intake-label-translation">We detect the language only after you send it.</span>
              <textarea
                id={complaintId}
                value={chiefComplaint}
                onChange={(event) => {
                  resetGeneratedInterpretation();
                  setPreferredLanguage(null);
                  setLanguageCode(null);
                  setLanguageProvenance(null);
                  setLanguageCandidate(null);
                  setLanguageError(null);
                  setChiefComplaint(event.target.value);
                }}
                placeholder="Describe every concern in your own words…"
                maxLength={1000}
                rows={4}
                dir="auto"
                autoFocus
                disabled={disabled}
              />
              <div className="intake-composer-actions">
                <div className="intake-demo-options">
                  <button className="intake-demo-fill" type="button" onClick={() => setChiefComplaint(scripts.Tagalog.demoComplaint)} disabled={disabled}>
                    <Sparkles size={13} aria-hidden="true" /> Tagalog shoulder
                  </button>
                  <button className="intake-demo-fill" type="button" onClick={() => setChiefComplaint(scripts.Tagalog.alternateDemo?.complaint ?? "")} disabled={disabled}>
                    <Sparkles size={13} aria-hidden="true" /> Tagalog foot pain
                  </button>
                  <button className="intake-demo-fill" type="button" onClick={() => setChiefComplaint(scripts.Spanish.demoComplaint)} disabled={disabled}>
                    <Sparkles size={13} aria-hidden="true" /> Spanish dizziness
                  </button>
                </div>
                <button className="button intake-continue" type="submit" disabled={disabled || chiefComplaint.trim().length < 3}>
                  Detect language &amp; continue <Send size={13} aria-hidden="true" />
                </button>
              </div>
            </form>
            <p className="intake-privacy-note"><BadgeCheck size={13} aria-hidden="true" /> The original message stays attached. Detection runs locally and does not change Athena.</p>
          </div>
        ) : null}

        {stage === "language" ? (
          <div className="intake-language-stage">
            <IntakeMessage speaker="patient" patientName={patientName} patientInitials={patientInitials} text={chiefComplaint} languageCode={languageCandidate?.languageCode ?? languageCode ?? "und"} />
            <form className="intake-language-confirm" onSubmit={submitManualLanguage}>
              <div className="intake-language-confirm-copy">
                <Languages size={18} aria-hidden="true" />
                <div>
                  <strong>{languageCandidate ? `${languageCandidate.languageName} detected — is that right?` : "Which language should we use?"}</strong>
                  <span>{languageError}</span>
                </div>
              </div>
              {languageCandidate ? (
                <button className="intake-language-option" type="button" onClick={() => applyLanguage(languageCandidate, "detected")} disabled={disabled}>
                  <span className="intake-language-icon"><Check size={17} aria-hidden="true" /></span>
                  <span><strong>Use {languageCandidate.languageName}</strong><small>{languageCandidate.languageCode} · message preserved</small></span>
                  <Send size={14} aria-hidden="true" />
                </button>
              ) : null}
              <label htmlFor="manual-intake-language">Language name</label>
              <div className="intake-language-manual-row">
                <input
                  id="manual-intake-language"
                  value={manualLanguage}
                  onChange={(event) => {
                    setManualLanguage(event.target.value);
                    setLanguageError(null);
                  }}
                  placeholder="e.g. French, Arabic, Hindi, Vietnamese"
                  autoComplete="off"
                  dir="auto"
                  disabled={disabled}
                />
                <button className="button intake-continue" type="submit" disabled={disabled || manualLanguage.trim().length < 2}>
                  Use language <Send size={13} aria-hidden="true" />
                </button>
              </div>
              <small>Your first message will not be cleared or rewritten.</small>
            </form>
          </div>
        ) : null}

        {script && stage !== "language" && stage !== "complaint" ? (
          <>
            <IntakeMessage
              speaker="patient"
              patientName={patientName}
              patientInitials={patientInitials}
              text={chiefComplaint}
              languageCode={script.code}
            />

            {stage === "clarification" ? (
              <>
                <div className="intake-confidence-callout is-low">
                  <Sparkles size={14} aria-hidden="true" />
                  <div><strong lang={script.code}>{script.controls.meaningHeading}</strong><span lang={script.code}>{script.controls.meaningDetail}</span></div>
                  <span lang={script.code}>{script.controls.lowConfidence}</span>
                </div>
                <IntakeMessage
                  speaker="behemoth"
                  patientName={patientName}
                  patientInitials={patientInitials}
                  text={clarification?.question ?? script.clarificationQuestion}
                  translated={clarification?.questionEnglish ?? script.clarificationQuestionEnglish}
                  languageCode={script.code}
                />
              </>
            ) : null}

            {stage === "urgent" && safetyDecision ? (
              <>
                {clarificationResponse ? (
                  <IntakeMessage
                    speaker="patient"
                    patientName={patientName}
                    patientInitials={patientInitials}
                    text={clarificationResponse}
                    languageCode={script.code}
                  />
                ) : null}
                <div className="intake-urgent-card" role="alert">
                <div className="intake-urgent-heading">
                  <AlertTriangle size={20} aria-hidden="true" />
                  <div>
                    <strong lang={preferredLanguage === "Tagalog" ? "tl" : preferredLanguage === "Spanish" ? "es" : "en"}>{preferredLanguage === "Tagalog" ? "Kumilos ngayon" : preferredLanguage === "Spanish" ? "Actúe ahora" : "Act now"}</strong>
                    <span>Deterministic safety policy</span>
                  </div>
                </div>
                <p lang={preferredLanguage === "Tagalog" ? "tl" : preferredLanguage === "Spanish" ? "es" : "en"}>{urgentGuidance(preferredLanguage ?? "Undetermined", safetyDecision.ruleId)}</p>
                <div className="intake-urgent-english" lang="en">
                  <Languages size={13} aria-hidden="true" />
                  {safetyDecision.guidance}
                </div>
                <small>Routine intake stopped as soon as the red-flag phrase matched.</small>
                <button
                  className="button intake-urgent-retry"
                  type="button"
                  onClick={() => preferredLanguage && languageCode && sendUrgentIntake({
                    safety: safetyDecision,
                    languageName: preferredLanguage,
                    code: languageCode,
                    provenance: languageProvenance ?? "detected",
                    urgentClarification: clarificationResponse,
                  })}
                  disabled={disabled}
                >
                  <ShieldCheck size={14} aria-hidden="true" />
                  {preferredLanguage === "Tagalog" ? "Buuin muli ang clinician handoff" : preferredLanguage === "Spanish" ? "Volver a crear el informe clínico" : "Rebuild clinician handoff"}
                </button>
                </div>
              </>
            ) : null}

            {stage === "clarification" ? (
              <form className="intake-composer" onSubmit={submitClarification}>
                <label htmlFor={clarificationId} lang={script.code}>{script.clarificationLabel}</label>
                <span className="intake-label-translation" lang="en">{script.clarificationLabelEnglish}</span>
                <textarea
                  id={clarificationId}
                  value={clarificationResponse}
                  onChange={(event) => {
                    resetGeneratedInterpretation();
                    setClarificationResponse(event.target.value);
                  }}
                  placeholder={clarification?.placeholder ?? script.clarificationPlaceholder}
                  maxLength={500}
                  rows={2}
                  dir="auto"
                  autoFocus
                  disabled={disabled || interpretationStatus === "loading"}
                  lang={script.code}
                />
                {interpretationError ? (
                  <div className="intake-interpretation-error" role="alert" lang={script.code}>
                    <AlertTriangle size={14} aria-hidden="true" /> {interpretationError}
                  </div>
                ) : null}
                <div className="intake-composer-actions">
                  {demoForComplaint ? (
                    <button className="intake-demo-fill" type="button" onClick={() => {
                      resetGeneratedInterpretation();
                      setClarificationResponse(demoForComplaint.clarification);
                    }} disabled={disabled || interpretationStatus === "loading"}>
                      <Sparkles size={13} aria-hidden="true" /> {demoForComplaint.buttonLabel}
                    </button>
                  ) : <span />}
                  <button className="button intake-continue" type="submit" disabled={disabled || interpretationStatus === "loading" || clarificationResponse.trim().length < 2}>
                    {interpretationStatus === "loading" ? (
                      <><span className="spinner" /> {preferredLanguage === "Tagalog" ? "Isinasalin ng Sonnet" : preferredLanguage === "Spanish" ? "Sonnet está interpretando" : "Sonnet is interpreting"}</>
                    ) : <>{interpretationStatus === "error" ? (preferredLanguage === "Tagalog" ? "Subukang muli" : preferredLanguage === "Spanish" ? "Reintentar" : "Try again") : script.controls.reviewMeaning} <Send size={13} aria-hidden="true" /></>}
                  </button>
                </div>
              </form>
            ) : null}

            {stage === "confirmation" || stage === "confirmed" ? (
              <>
                <IntakeMessage
                  speaker="patient"
                  patientName={patientName}
                  patientInitials={patientInitials}
                  text={clarificationResponse}
                  languageCode={script.code}
                />
                {interpretation ? (
                  <div className={`intake-confirmation-card confidence-${interpretation.confidence}`}>
                    <div className="intake-confirmation-heading">
                      <div>
                        <BadgeCheck size={17} aria-hidden="true" />
                        <strong lang={script.code}>{script.confirmationHeading}</strong>
                        {interpretation.method === "sonnet" ? <em>Sonnet interpreted</em> : null}
                      </div>
                      <span lang={script.code}>{confidenceLabel(preferredLanguage ?? "Undetermined", interpretation.confidence)}</span>
                    </div>
                    <div className="intake-confirmation-copy">
                      <div>
                        <span lang={script.code}>{script.nativeLabel}</span>
                        <p lang={script.code} dir="auto">{interpretation.patient}</p>
                      </div>
                      <div>
                        <span lang="en">English clinician view · {interpretation.method === "sonnet" ? "Sonnet 5" : "verified demo"}</span>
                        <p lang="en">{interpretation.english}</p>
                      </div>
                    </div>
                    <fieldset className="intake-visit-priorities">
                      <legend lang={script.code}>{script.controls.priorityHeading}</legend>
                      <p lang={script.code}>{script.controls.priorityHelp}</p>
                      <div className="intake-priority-options">
                        {interpretation.visitTopics.map((topic, index) => {
                          const selected = topConcernChoice === index;
                          return (
                            <label className={selected ? "is-selected" : ""} key={`${topic.nativeSummary}-${index}`}>
                              <input
                                type="radio"
                                name={priorityGroupName}
                                checked={selected}
                                onChange={() => setTopConcernChoice(index)}
                                disabled={disabled || stage === "confirmed"}
                              />
                              <span className="priority-rank">{index + 1}</span>
                              <span className="priority-copy">
                                <strong lang={script.code} dir="auto">{topic.nativeSummary}</strong>
                                <small lang="en">{topic.englishSummary}</small>
                              </span>
                              <em>{selected ? (preferredLanguage === "Tagalog" ? "Pangunahin" : preferredLanguage === "Spanish" ? "Prioridad" : "Top priority") : ""}</em>
                            </label>
                          );
                        })}
                        <label className={topConcernChoice === "none" ? "is-selected" : ""}>
                          <input
                            type="radio"
                            name={priorityGroupName}
                            checked={topConcernChoice === "none"}
                            onChange={() => setTopConcernChoice("none")}
                            disabled={disabled || stage === "confirmed"}
                          />
                          <span className="priority-rank">—</span>
                          <span className="priority-copy"><strong lang={script.code}>{script.controls.noPreference}</strong></span>
                        </label>
                      </div>
                      <small lang="en">Patient preference only; deterministic safety and clinical review may change visit order.</small>
                    </fieldset>
                    {interpretation.ambiguities.length > 0 ? (
                      <div className="intake-ambiguities" lang="en">
                        <strong>Meaning to verify with the patient</strong>
                        <ul>{interpretation.ambiguities.map((ambiguity) => <li key={ambiguity}>{ambiguity}</li>)}</ul>
                      </div>
                    ) : null}
                    {stage === "confirmation" ? (
                      <div className="intake-confirmation-actions">
                        <button className="button intake-edit" type="button" onClick={() => {
                          resetGeneratedInterpretation();
                          setStage("complaint");
                        }} disabled={disabled}>
                          <PencilLine size={13} aria-hidden="true" /> {script.controls.editAnswers}
                        </button>
                        <button className="button intake-confirm" type="button" onClick={confirmInterpretation} disabled={disabled || topConcernChoice === null}>
                          <Check size={14} aria-hidden="true" /> {script.confirmLabel}
                        </button>
                      </div>
                    ) : (
                      <div className="intake-confirmed-state" role="status">
                        <Check size={15} aria-hidden="true" /> <span lang={script.code}>{script.controls.confirmed}</span>
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </div>

      {stage !== "complaint" && stage !== "confirmed" && stage !== "urgent" ? (
        <button
          className="intake-back"
          type="button"
          onClick={() => {
            resetGeneratedInterpretation();
            if (stage === "language" || stage === "clarification") {
              editFirstMessage();
              return;
            }
            setStage("clarification");
          }}
          disabled={disabled || interpretationStatus === "loading"}
        >
          <ArrowLeft size={12} aria-hidden="true" /> {script?.controls.back ?? "Back"}
        </button>
      ) : null}
    </section>
  );
}
