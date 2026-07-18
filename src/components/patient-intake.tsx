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
import { evaluateIntakeSafety, type IntakeSafetyDecision } from "@/lib/workflow/policy";

export type { ConfirmedIntake, UrgentIntake } from "@/lib/workflow/contracts";

type IntakeStage = "language" | "complaint" | "clarification" | "confirmation" | "confirmed" | "urgent";
type PreferredLanguage = ConfirmedIntake["preferredLanguage"];
type InterpretationStatus = "idle" | "loading" | "ready" | "error";
type GeneratedInterpretation = IntakeInterpretation & { model: string };

type IntakeScript = {
  code: "tl" | "es";
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

const scripts: Record<PreferredLanguage, IntakeScript> = {
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

const stageLabels = ["Language", "Symptoms", "Clarify", "Confirm"] as const;

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function urgentGuidance(language: PreferredLanguage, ruleId: IntakeSafetyDecision["ruleId"]): string {
  if (ruleId === "self-harm") {
    return language === "Tagalog"
      ? "Kailangan mo ng agarang suporta mula sa isang tao. Kung may agarang panganib, tumawag sa lokal na serbisyong pang-emergency ngayon; sa U.S., tumawag o mag-text sa 988."
      : "Necesita apoyo humano inmediato. Si hay peligro inmediato, llame ahora a los servicios de emergencia locales; en EE. UU., llame o envíe un mensaje de texto al 988.";
  }
  return language === "Tagalog"
    ? "Maaaring emergency ito. Tumawag sa lokal na serbisyong pang-emergency ngayon at huwag hintayin ang appointment."
    : "Esto puede ser una emergencia. Llame ahora a los servicios de emergencia locales y no espere a la cita.";
}

function confidenceLabel(language: PreferredLanguage, confidence: "low" | "medium" | "high"): string {
  if (language === "Tagalog") {
    if (confidence === "high") return "Mataas na kumpiyansa";
    if (confidence === "medium") return "Katamtamang kumpiyansa";
    return "Mababang kumpiyansa";
  }
  if (confidence === "high") return "Alta confianza";
  if (confidence === "medium") return "Confianza media";
  return "Baja confianza";
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
  languageCode: "tl" | "es";
}) {
  return (
    <div className={`message-row ${speaker} is-visible`}>
      <div className="message-avatar" aria-hidden="true">
        {speaker === "behemoth" ? <Bot size={15} /> : patientInitials}
      </div>
      <div className="message-bubble">
        <div className="message-speaker">{speaker === "behemoth" ? "Behemoth" : patientName}</div>
        <p lang={languageCode}>{text}</p>
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
  const [stage, setStage] = useState<IntakeStage>("language");
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [clarificationResponse, setClarificationResponse] = useState("");
  const [safetyDecision, setSafetyDecision] = useState<IntakeSafetyDecision | null>(null);
  const [generatedInterpretation, setGeneratedInterpretation] = useState<GeneratedInterpretation | null>(null);
  const [interpretationStatus, setInterpretationStatus] = useState<InterpretationStatus>("idle");
  const [interpretationError, setInterpretationError] = useState<string | null>(null);
  const [topConcernChoice, setTopConcernChoice] = useState<number | "none" | null>(null);

  const script = preferredLanguage ? scripts[preferredLanguage] : null;
  const stageIndex = stage === "confirmed" ? stageLabels.length : stage === "urgent" ? 1 : stageLabels.indexOf(
    stage === "language" ? "Language" : stage === "complaint" ? "Symptoms" : stage === "clarification" ? "Clarify" : "Confirm",
  );

  const clarification = useMemo(() => {
    if (!script || !preferredLanguage) return null;
    const normalizedComplaint = normalize(chiefComplaint);
    const matchesKnownNuance = preferredLanguage === "Tagalog"
      ? normalizedComplaint.includes("kumikirot")
      : /\b(mareo|mareada|medicina|pastilla|presi[oó]n)\b/i.test(chiefComplaint);
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
      : {
          question: "¿Puede describir con otras palabras dónde lo siente y cómo se siente?",
          questionEnglish: "Can you describe in different words where it is and what it feels like?",
          placeholder: "Describa el lugar y la sensación con otras palabras…",
        };
  }, [chiefComplaint, preferredLanguage, script]);

  const isDemoResponse = Boolean(
    script
    && normalize(chiefComplaint) === normalize(script.demoComplaint)
    && normalize(clarificationResponse) === normalize(script.demoClarification),
  );

  const interpretation = useMemo(() => {
    if (!script || !preferredLanguage) return null;
    if (isDemoResponse) {
      return {
        patient: script.demoPatientInterpretation,
        english: script.demoEnglishInterpretation,
        confidence: "high" as const,
        ambiguities: [] as string[],
        visitTopics: script.demoVisitTopics,
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
  }, [generatedInterpretation, isDemoResponse, preferredLanguage, script]);

  const resetGeneratedInterpretation = () => {
    interpretationAbortRef.current?.abort();
    interpretationAbortRef.current = null;
    interpretationRequestRef.current += 1;
    setGeneratedInterpretation(null);
    setInterpretationStatus("idle");
    setInterpretationError(null);
    setTopConcernChoice(null);
  };

  const chooseLanguage = (language: PreferredLanguage) => {
    confirmedRef.current = false;
    resetGeneratedInterpretation();
    setPreferredLanguage(language);
    setChiefComplaint("");
    setClarificationResponse("");
    setSafetyDecision(null);
    setStage("complaint");
  };

  const changeLanguage = () => {
    confirmedRef.current = false;
    resetGeneratedInterpretation();
    setPreferredLanguage(null);
    setChiefComplaint("");
    setClarificationResponse("");
    setSafetyDecision(null);
    setStage("language");
  };

  const sendUrgentIntake = (safety: IntakeSafetyDecision | null, urgentClarification?: string) => {
    if (disabled || !preferredLanguage || !safety?.ruleId) return;
    onUrgent({
      preferredLanguage,
      chiefComplaint: chiefComplaint.trim(),
      clarificationResponse: urgentClarification?.trim() || undefined,
      safetyRuleId: safety.ruleId,
      guidanceDisplayed: true,
    });
  };

  const submitComplaint = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || chiefComplaint.trim().length < 3 || !preferredLanguage) return;
    const safety = evaluateIntakeSafety(chiefComplaint);
    if (safety.branch === "escalated" && safety.ruleId) {
      confirmedRef.current = true;
      setSafetyDecision(safety);
      setStage("urgent");
      sendUrgentIntake(safety);
      return;
    }
    setStage("clarification");
  };

  const submitClarification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || interpretationStatus === "loading" || clarificationResponse.trim().length < 2 || !preferredLanguage || !clarification) return;
    const safety = evaluateIntakeSafety(`${chiefComplaint} ${clarificationResponse}`);
    if (safety.branch === "escalated" && safety.ruleId) {
      confirmedRef.current = true;
      setSafetyDecision(safety);
      setStage("urgent");
      sendUrgentIntake(safety, clarificationResponse);
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
      };
      if (requestId !== interpretationRequestRef.current) return;
      if (response.status === 409 && payload.safety?.branch === "escalated" && payload.safety.ruleId) {
        confirmedRef.current = true;
        setSafetyDecision(payload.safety);
        setInterpretationStatus("idle");
        setStage("urgent");
        sendUrgentIntake(payload.safety, clarificationResponse);
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
        : "No se pudo generar una interpretación segura en inglés. Inténtelo de nuevo o solicite un intérprete calificado.");
    } finally {
      if (requestId === interpretationRequestRef.current) interpretationAbortRef.current = null;
    }
  };

  const confirmInterpretation = () => {
    if (disabled || confirmedRef.current || !preferredLanguage || !script || !interpretation || !clarification || topConcernChoice === null) return;
    confirmedRef.current = true;
    setStage("confirmed");
    onConfirmed({
      preferredLanguage,
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
        {preferredLanguage && stage !== "confirmed" && stage !== "urgent" ? (
          <button className="intake-language-reset" type="button" onClick={changeLanguage} disabled={disabled || interpretationStatus === "loading"}>
            {script?.controls.changeLanguage ?? "Change language"}
          </button>
        ) : null}
      </div>

      <div className="patient-intake-content" aria-live="polite">
        {stage === "language" ? (
          <div className="intake-language-stage">
            <div className="message-row behemoth is-visible">
              <div className="message-avatar" aria-hidden="true"><Bot size={15} /></div>
              <div className="message-bubble">
                <div className="message-speaker">Behemoth</div>
                <p>What language would you like to use for your intake?</p>
                <div className="translation"><Languages size={12} aria-hidden="true" /> Puede elegir Español · Maaari kang pumili ng Tagalog.</div>
              </div>
            </div>
            <div className="intake-language-options" role="group" aria-label="Preferred language">
              {(Object.keys(scripts) as PreferredLanguage[]).map((language) => {
                const option = scripts[language];
                return (
                  <button
                    className="intake-language-option"
                    type="button"
                    onClick={() => chooseLanguage(language)}
                    disabled={disabled}
                    key={language}
                    lang={option.code}
                  >
                    <span className="intake-language-icon"><Languages size={17} aria-hidden="true" /></span>
                    <span><strong>{option.nativeLabel}</strong><small lang="en">{option.englishLabel}</small></span>
                    <Send size={14} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
            <p className="intake-privacy-note"><BadgeCheck size={13} aria-hidden="true" /> Your original words stay attached · Tus palabras originales permanecen · Mananatili ang eksakto mong mga salita.</p>
          </div>
        ) : null}

        {script && stage !== "language" ? (
          <>
            <IntakeMessage
              speaker="behemoth"
              patientName={patientName}
              patientInitials={patientInitials}
              text={script.complaintPrompt}
              translated={script.complaintPromptEnglish}
              languageCode={script.code}
            />

            {stage === "complaint" ? (
              <form className="intake-composer" onSubmit={submitComplaint}>
                <label htmlFor={complaintId} lang={script.code}>{script.complaintLabel}</label>
                <span className="intake-label-translation" lang="en">{script.complaintLabelEnglish}</span>
                <textarea
                  id={complaintId}
                  value={chiefComplaint}
                  onChange={(event) => {
                    resetGeneratedInterpretation();
                    setChiefComplaint(event.target.value);
                  }}
                  placeholder={script.complaintPlaceholder}
                  maxLength={1000}
                  rows={3}
                  autoFocus
                  disabled={disabled}
                  lang={script.code}
                />
                <div className="intake-composer-actions">
                  <button className="intake-demo-fill" type="button" onClick={() => {
                    resetGeneratedInterpretation();
                    setChiefComplaint(script.demoComplaint);
                  }} disabled={disabled}>
                    <Sparkles size={13} aria-hidden="true" /> {script.controls.useDemo}
                  </button>
                  <button className="button intake-continue" type="submit" disabled={disabled || chiefComplaint.trim().length < 3}>
                    {script.controls.continue} <Send size={13} aria-hidden="true" />
                  </button>
                </div>
              </form>
            ) : (
              <IntakeMessage
                speaker="patient"
                patientName={patientName}
                patientInitials={patientInitials}
                text={chiefComplaint}
                languageCode={script.code}
              />
            )}

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
                    <strong lang={script.code}>{preferredLanguage === "Tagalog" ? "Kumilos ngayon" : "Actúe ahora"}</strong>
                    <span>Deterministic safety check · no AI</span>
                  </div>
                </div>
                <p lang={script.code}>{urgentGuidance(script.code === "tl" ? "Tagalog" : "Spanish", safetyDecision.ruleId)}</p>
                <div className="intake-urgent-english" lang="en">
                  <Languages size={13} aria-hidden="true" />
                  {safetyDecision.guidance}
                </div>
                <small>Routine intake stopped as soon as the red-flag phrase matched.</small>
                <button
                  className="button intake-urgent-retry"
                  type="button"
                  onClick={() => sendUrgentIntake(safetyDecision, clarificationResponse)}
                  disabled={disabled}
                >
                  <ShieldCheck size={14} aria-hidden="true" />
                  {preferredLanguage === "Tagalog" ? "Buuin muli ang clinician handoff" : "Volver a crear el informe clínico"}
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
                  {normalize(chiefComplaint) === normalize(script.demoComplaint) ? (
                    <button className="intake-demo-fill" type="button" onClick={() => {
                      resetGeneratedInterpretation();
                      setClarificationResponse(script.demoClarification);
                    }} disabled={disabled || interpretationStatus === "loading"}>
                      <Sparkles size={13} aria-hidden="true" /> {script.controls.useDemo}
                    </button>
                  ) : <span />}
                  <button className="button intake-continue" type="submit" disabled={disabled || interpretationStatus === "loading" || clarificationResponse.trim().length < 2}>
                    {interpretationStatus === "loading" ? (
                      <><span className="spinner" /> {preferredLanguage === "Tagalog" ? "Isinasalin ng Sonnet" : "Sonnet está interpretando"}</>
                    ) : <>{interpretationStatus === "error" ? (preferredLanguage === "Tagalog" ? "Subukang muli" : "Reintentar") : script.controls.reviewMeaning} <Send size={13} aria-hidden="true" /></>}
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
                      <span lang={script.code}>{confidenceLabel(script.code === "tl" ? "Tagalog" : "Spanish", interpretation.confidence)}</span>
                    </div>
                    <div className="intake-confirmation-copy">
                      <div>
                        <span lang={script.code}>{script.nativeLabel}</span>
                        <p lang={script.code}>{interpretation.patient}</p>
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
                                <strong lang={script.code}>{topic.nativeSummary}</strong>
                                <small lang="en">{topic.englishSummary}</small>
                              </span>
                              <em>{selected ? (preferredLanguage === "Tagalog" ? "Pangunahin" : "Prioridad") : ""}</em>
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

      {stage !== "language" && stage !== "confirmed" && stage !== "urgent" ? (
        <button
          className="intake-back"
          type="button"
          onClick={() => {
            resetGeneratedInterpretation();
            if (stage === "complaint") {
              changeLanguage();
              return;
            }
            setStage(stage === "clarification" ? "complaint" : "clarification");
          }}
          disabled={disabled || interpretationStatus === "loading"}
        >
          <ArrowLeft size={12} aria-hidden="true" /> {script?.controls.back ?? "Back"}
        </button>
      ) : null}
    </section>
  );
}
