import "server-only";

import { generateClinicalHandoff } from "@/lib/ai/handoff";
import { AthenaPreviewClient } from "@/lib/athena/client";
import { getAthenaConfig, hasAthenaCredentials } from "@/lib/athena/config";
import type { AthenaChartContext, AthenaRecord } from "@/lib/athena/types";
import { getScenario, type ConversationMessage, type DemoScenario } from "@/lib/demo/fixtures";
import {
  HandoffSchema,
  type AgendaItem,
  type ClinicalHandoff,
  type Concern,
  type ConfirmedIntake,
  type Evidence,
  type RunInput,
  type RunResult,
  type UrgentIntake,
} from "@/lib/workflow/contracts";
import { evaluateIntakeSafety } from "@/lib/workflow/policy";

function stringValue(record: AthenaRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function initials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function ageFromDob(dob: string | undefined): number | undefined {
  if (!dob) return undefined;
  const parts = dob.includes("/") ? dob.split("/") : dob.split("-");
  if (parts.length !== 3) return undefined;
  const [year, month, day] = dob.includes("/")
    ? [Number(parts[2]), Number(parts[0]), Number(parts[1])]
    : [Number(parts[0]), Number(parts[1]), Number(parts[2])];
  if (![year, month, day].every(Number.isFinite)) return undefined;
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age -= 1;
  return age >= 0 && age < 130 ? age : undefined;
}

function languageName(code: string | undefined, fallback: string): string {
  const normalized = code?.toLowerCase();
  if (normalized === "tgl" || normalized === "fil" || normalized === "tagalog") return "Tagalog";
  if (normalized === "spa" || normalized === "es" || normalized === "spanish") return "Spanish";
  return fallback;
}

function appointmentLabel(appointment: AthenaRecord | undefined, fallback: string): string {
  if (!appointment) return fallback;
  const date = stringValue(appointment, ["date", "appointmentdate"]);
  const time = stringValue(appointment, ["starttime", "appointmenttime"]);
  const type = stringValue(appointment, ["patientappointmenttypename", "appointmenttype", "reason"]);
  const parts = [date, time, type].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(" · ") : fallback;
}

function appointmentTimestamp(appointment: AthenaRecord): number {
  const date = stringValue(appointment, ["date", "appointmentdate"]);
  const time = stringValue(appointment, ["starttime", "appointmenttime"]) ?? "00:00";
  if (!date) return Number.NaN;
  const [month, day, year] = date.split("/").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const value = new Date(year, month - 1, day, hour || 0, minute || 0).getTime();
  return Number.isFinite(value) ? value : Number.NaN;
}

const BOOKED_APPOINTMENT_STATUSES = new Set(["f", "filled", "booked", "scheduled"]);

function upcomingAppointment(appointments: AthenaRecord[], preferredAppointmentId?: string): AthenaRecord | undefined {
  const now = Date.now();
  const available = appointments.filter((appointment) => {
    const status = stringValue(appointment, ["appointmentstatus", "status"])?.toLowerCase();
    const timestamp = appointmentTimestamp(appointment);
    return Boolean(status && BOOKED_APPOINTMENT_STATUSES.has(status)) && Number.isFinite(timestamp) && timestamp >= now;
  });
  const preferred = preferredAppointmentId
    ? available.find((appointment) => stringValue(appointment, ["appointmentid", "id"]) === preferredAppointmentId)
    : undefined;
  if (preferred) return preferred;
  return available.sort((left, right) => appointmentTimestamp(left) - appointmentTimestamp(right))[0];
}

function resolvePatient(
  fallback: DemoScenario["patient"],
  context: AthenaChartContext,
  patientId: string,
  preferredAppointmentId?: string,
): DemoScenario["patient"] & { appointmentId?: string; identitySource: "athena" | "fixture" } {
  const patient = context.patient;
  if (!patient) return { ...fallback, id: patientId, identitySource: "fixture" };
  const firstName = stringValue(patient, ["firstname", "firstName", "preferredname"]);
  const lastName = stringValue(patient, ["lastname", "lastName"]);
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || fallback.displayName;
  const appointment = upcomingAppointment(context.appointments, preferredAppointmentId);
  return {
    id: patientId,
    displayName,
    initials: initials(displayName) || fallback.initials,
    age: ageFromDob(stringValue(patient, ["dob", "dateofbirth"])) ?? fallback.age,
    language: languageName(stringValue(patient, ["language6392code", "language"]), fallback.language),
    appointment: appointmentLabel(appointment, "No upcoming appointment returned by Athena"),
    appointmentId: appointment ? stringValue(appointment, ["appointmentid", "id"]) : undefined,
    identitySource: "athena",
  };
}

function athenaEvidence(context: AthenaChartContext, preferredAppointmentId?: string): Evidence[] {
  const evidence: Evidence[] = [];
  const appointment = upcomingAppointment(context.appointments, preferredAppointmentId);
  (appointment ? [appointment] : []).forEach((item, index) => {
    const value = appointmentLabel(item, "Booked appointment");
    evidence.push({
      id: `athena-live-appointment-${index + 1}`,
      label: "Upcoming appointment",
      value,
      source: "athena",
      resource: `Appointment / Athena Preview${stringValue(item, ["appointmentid", "id"]) ? ` / ${stringValue(item, ["appointmentid", "id"])}` : ""}`,
    });
  });
  context.problems.slice(0, 4).forEach((problem, index) => {
    const value = stringValue(problem, ["name", "description", "code"]);
    if (value) evidence.push({
      id: `athena-live-problem-${index + 1}`,
      label: "Problem list",
      value,
      source: "athena",
      resource: `Problem / Athena Preview${stringValue(problem, ["problemid"]) ? ` / ${stringValue(problem, ["problemid"])}` : ""}`,
      observedAt: stringValue(problem, ["lastmodifieddatetime", "lastupdated"]),
    });
  });
  context.medications.slice(0, 4).forEach((medication, index) => {
    const value = stringValue(medication, ["medication", "medicationname", "name"]);
    if (value) evidence.push({
      id: `athena-live-medication-${index + 1}`,
      label: "Active medication",
      value,
      source: "athena",
      resource: "Medication / Athena Preview",
    });
  });
  context.allergies.slice(0, 3).forEach((allergy, index) => {
    const value = stringValue(allergy, ["allergenname", "allergy", "name"]);
    if (value) evidence.push({
      id: `athena-live-allergy-${index + 1}`,
      label: "Allergy",
      value,
      source: "athena",
      resource: "Allergy / Athena Preview",
    });
  });
  return evidence;
}

function interactiveConversation(patient: DemoScenario["patient"], intake: ConfirmedIntake): ConversationMessage[] {
  const firstName = patient.displayName.split(" ")[0];
  const opening = intake.preferredLanguage === "Tagalog"
    ? `Kumusta ${firstName}. Ano-ano ang gusto mong siguraduhing matalakay sa iyong pagbisita?`
    : intake.preferredLanguage === "Spanish"
      ? `Hola ${firstName}. ¿Qué temas quiere asegurarse de hablar durante su visita?`
      : `Hello ${firstName}. Tell us what you want to make sure is addressed during your visit, in your own language.`;
  const confirmation = intake.preferredLanguage === "Tagalog"
    ? "Ito ba ang tamang pagkaunawa?"
    : intake.preferredLanguage === "Spanish"
      ? "¿Entendimos correctamente?"
      : "The patient was asked to confirm the same-language restatement.";
  return [
    { speaker: "behemoth", text: opening, translated: "What topics do you want to make sure are addressed at your visit?" },
    { speaker: "patient", text: intake.chiefComplaint, translated: intake.englishInterpretation },
    { speaker: "behemoth", text: intake.clarificationQuestion, translated: "One bounded clarification was requested before interpretation." },
    { speaker: "patient", text: intake.clarificationResponse },
    { speaker: "behemoth", text: confirmation, translated: intake.englishInterpretation },
    {
      speaker: "patient",
      text: intake.preferredLanguage === "Tagalog"
        ? "Oo, tama iyon."
        : intake.preferredLanguage === "Spanish"
          ? "Sí, es correcto."
          : "Meaning and priority confirmed in the patient interface.",
      translated: "Yes, that is correct.",
    },
  ];
}

function interactiveEvidence(intake: ConfirmedIntake): Evidence[] {
  const interpretationMethod = intake.interpretationMethod === "sonnet"
    ? "Sonnet-assisted bilingual intake"
    : "Deterministic bilingual intake";
  return [
    ...(intake.languageCode ? [{
      id: "derived-intake-language",
      label: "Intake language",
      value: `${intake.preferredLanguage} (${intake.languageCode})`,
      source: "derived" as const,
      resource: intake.languageProvenance === "manual" ? "Patient-corrected language selection" : "First-message deterministic detection",
      observedAt: "Pre-visit intake",
    }] : []),
    {
      id: "patient-chief-complaint",
      label: "Patient's exact words",
      value: intake.chiefComplaint,
      source: "patient",
      observedAt: "Pre-visit intake",
    },
    {
      id: "patient-clarification",
      label: "Clarification response",
      value: intake.clarificationResponse,
      source: "patient",
      observedAt: "Pre-visit intake",
    },
    {
      id: "patient-confirmed-interpretation",
      label: intake.interpretationMethod === "sonnet"
        ? "AI English interpretation; native meaning confirmed by patient"
        : intake.confidence === "low"
          ? "Original wording confirmed; English review pending"
          : "Patient-confirmed English rendering",
      value: intake.englishInterpretation,
      source: "derived",
      resource: intake.confidence === "low"
        ? `${interpretationMethod} / qualified review required`
        : `${interpretationMethod} / confirmed by patient`,
      observedAt: "Confirmed by patient",
    },
    ...(intake.nativeInterpretation ? [{
      id: "derived-native-interpretation",
      label: "Interpretation in the patient's preferred language",
      value: intake.nativeInterpretation,
      source: "derived" as const,
      resource: `${interpretationMethod} / confirmed by patient`,
      observedAt: "Confirmed by patient",
    }] : []),
    ...(intake.ambiguities?.length ? [{
      id: "derived-interpretation-ambiguities",
      label: "Interpretation ambiguities requiring review",
      value: intake.ambiguities.join("; "),
      source: "derived" as const,
      resource: `${interpretationMethod} / unresolved ambiguity`,
      observedAt: "Pre-visit intake",
    }] : []),
    ...(intake.confirmedConcerns ?? []).map((concern) => ({
      id: `patient-priority-${concern.mentionOrder}`,
      label: concern.id === intake.topConcernId
        ? "Patient-selected top visit priority"
        : `Patient-confirmed visit topic ${concern.mentionOrder}`,
      value: `${concern.englishSummary} · Original: ${concern.nativeSummary}`,
      source: "derived" as const,
      resource: concern.id === intake.topConcernId
        ? "Patient priority selection / confirmed"
        : "Patient-confirmed topic / mention order preserved",
      observedAt: "Confirmed by patient",
    })),
  ];
}

function urgentEvidence(intake: UrgentIntake, guidance: string | undefined): Evidence[] {
  return [
    {
      id: "patient-chief-complaint",
      label: "Red-flag report in patient's exact words",
      value: intake.chiefComplaint,
      source: "patient",
      observedAt: "Pre-visit intake",
    },
    ...(intake.clarificationResponse ? [{
      id: "patient-clarification",
      label: "Red-flag clarification in patient's exact words",
      value: intake.clarificationResponse,
      source: "patient" as const,
      observedAt: "Pre-visit intake",
    }] : []),
    {
      id: "derived-safety-rule",
      label: "Deterministic safety policy",
      value: `${intake.safetyRuleId} matched ${intake.englishSafetyTranslation ? "after evaluating the attached English safety translation" : "directly in the patient's message before model use"}. Guidance displayed: ${guidance ?? "emergency guidance"}`,
      source: "derived",
      resource: intake.englishSafetyTranslation
        ? "previsit-intake-v1 / deterministic rule over translated safety text"
        : "previsit-intake-v1 / pre-model red-flag gate",
      observedAt: "Displayed immediately",
    },
    ...(intake.englishSafetyTranslation ? [{
      id: "derived-safety-translation",
      label: "English safety translation",
      value: intake.englishSafetyTranslation,
      source: "derived" as const,
      resource: "Language interpretation / safety screening",
      observedAt: "Pre-visit intake",
    }] : []),
  ];
}

function urgentConversation(
  patient: DemoScenario["patient"],
  intake: UrgentIntake,
  guidance: string | undefined,
): ConversationMessage[] {
  return [
    { speaker: "patient", text: intake.chiefComplaint },
    ...(intake.clarificationResponse ? [{ speaker: "patient" as const, text: intake.clarificationResponse }] : []),
    {
      speaker: "behemoth",
      text: guidance ?? "This may be an emergency. Call local emergency services now and do not wait for the appointment.",
      translated: `Routine intake stopped for ${patient.displayName} when the deterministic safety rule matched.`,
    },
  ];
}

function interactiveConcerns(intake: ConfirmedIntake, escalated: boolean): Concern[] {
  if (intake.confirmedConcerns?.length) {
    return intake.confirmedConcerns.map((concern) => ({
      id: concern.id,
      patientWords: concern.nativeSummary,
      translated: concern.englishSummary,
      duration: null,
      severity: null,
      mentionOrder: concern.mentionOrder,
      patientPriority: concern.id === intake.topConcernId ? "top" : "mentioned",
      priority: escalated ? "urgent" : "soon",
    }));
  }
  return [{
    id: "concern-patient-entered",
    patientWords: intake.chiefComplaint,
    translated: intake.englishInterpretation,
    duration: null,
    severity: null,
    priority: escalated ? "urgent" : "soon",
  }];
}

function urgentConcern(intake: UrgentIntake): Concern {
  return {
    id: "concern-patient-entered-urgent",
    patientWords: [intake.chiefComplaint, intake.clarificationResponse].filter(Boolean).join(" / "),
    translated: intake.englishSafetyTranslation,
    duration: null,
    severity: null,
    priority: "urgent",
  };
}

function pickAgendaEvidence(evidence: Evidence[], preferredIds: string[]): string[] {
  const allowed = new Set(evidence.map((item) => item.id));
  const selected = [...new Set(preferredIds)].filter((id) => allowed.has(id)).slice(0, 3);
  return selected.length > 0 ? selected : evidence.slice(0, 1).map((item) => item.id);
}

function buildEvidenceLinkedFallback(input: {
  patient: DemoScenario["patient"];
  intake?: ConfirmedIntake;
  concerns: Concern[];
  evidence: Evidence[];
  disposition: ClinicalHandoff["disposition"];
  guidanceDisplayed: boolean;
}): ClinicalHandoff {
  const evidenceIds = input.evidence.map((item) => item.id);
  if (input.disposition !== "clinician-review") {
    const guidanceStatus = input.guidanceDisplayed
      ? "Emergency guidance was displayed immediately in the patient UI."
      : "The deterministic rule matched; emergency guidance must be displayed immediately.";
    const patientEvidenceIds = input.evidence.filter((item) => item.source === "patient").map((item) => item.id);
    const safetyEvidenceIds = input.evidence
      .filter((item) => item.source === "derived" && /safety|red-flag/i.test(`${item.label} ${item.resource ?? ""}`))
      .map((item) => item.id);
    return HandoffSchema.parse({
      headline: "Immediate escalation from patient-reported symptoms",
      summary: `Routine intake stopped after ${input.patient.displayName} reported: “${input.intake?.chiefComplaint ?? input.concerns[0]?.patientWords ?? "an urgent symptom"}” ${guidanceStatus} A qualified clinical team member must review the report immediately.`,
      agenda: [
        {
          label: "Review the red-flag report immediately",
          rationale: "Patient-reported symptoms matched the deterministic emergency branch, so routine intake stopped.",
          evidenceIds: pickAgendaEvidence(input.evidence, [...patientEvidenceIds, ...safetyEvidenceIds]),
        },
        {
          label: "Confirm whether the patient contacted emergency services",
          rationale: "Emergency guidance was displayed, but patient follow-through has not been verified.",
          evidenceIds: pickAgendaEvidence(input.evidence, [...safetyEvidenceIds, ...patientEvidenceIds]),
        },
      ],
      relevantHistory: [],
      discrepancies: [],
      openQuestions: ["Did the patient contact emergency services?"],
      disposition: "emergency-guidance",
      confidence: "high",
      evidenceIds,
    });
  }

  const athenaFacts = input.evidence.filter((item) => item.source === "athena");
  const patientReport = `${input.intake?.chiefComplaint ?? ""} ${input.intake?.clarificationResponse ?? ""}`;
  const medicationStop = patientReport.split(/[.!?;\n]/).some((clause) => {
    const hasStopVerb = /\b(stopp?ed|quit|dej[eé]|dejado|dej[oó]|tumigil|hindi na iniinom|itinigil)\b/i.test(clause);
    const hasMedicationNoun = /\b(medication|medicine|pill|tablet|drug|medicina|medicamento|pastilla|gamot|lisinopril)\b/i.test(clause);
    return hasStopVerb && hasMedicationNoun;
  });
  const activeMedications = athenaFacts.filter((item) => item.label === "Active medication");
  const discrepancies = medicationStop && activeMedications.length > 0
    ? [`Patient reports stopping a medication; Athena lists ${activeMedications.map((item) => item.value).join(", ")} as active. Confirm which medication the patient meant before reconciling.`]
    : medicationStop
      ? ["Patient reports stopping a medication; confirm the exact medication and reconcile it with the chart."]
      : [];
  const reviewedInterpretation = input.intake?.englishInterpretation
    ?? input.concerns.map((concern) => concern.translated ?? concern.patientWords).join("; ");
  const normalizedReport = `${patientReport} ${reviewedInterpretation}`.toLowerCase();
  const lowConfidence = input.intake?.confidence === "low";
  const sonnetInterpretation = input.intake?.interpretationMethod === "sonnet";
  const patientEvidenceIds = input.evidence
    .filter((item) => item.source === "patient" || item.id.startsWith("patient-priority-") || [
      "patient-confirmed-interpretation",
      "derived-native-interpretation",
      "derived-interpretation-ambiguities",
    ].includes(item.id))
    .map((item) => item.id);
  const interpretationEvidenceIds = [
    "patient-chief-complaint",
    "patient-confirmed-interpretation",
    "derived-interpretation-ambiguities",
    "derived-native-interpretation",
    "patient-clarification",
  ].filter((id) => patientEvidenceIds.includes(id));
  const interpretationAgenda: AgendaItem = {
    label: reviewedInterpretation.length > 180
      ? "Review the patient's exact wording with qualified language support"
      : reviewedInterpretation,
    rationale: lowConfidence
      ? `${sonnetInterpretation ? "Sonnet produced" : "The workflow contains"} a low-confidence English interpretation; the patient confirmed the native-language restatement and qualified review remains required.`
      : sonnetInterpretation
        ? "The patient confirmed the native-language restatement; Sonnet's English interpretation and the exact wording remain attached for clinician verification."
        : "The patient confirmed the interpretation; exact wording and the clarification response remain attached for verification.",
    evidenceIds: pickAgendaEvidence(input.evidence, interpretationEvidenceIds),
  };
  const symptomEvidenceIds = [
    "patient-chief-complaint",
    "patient-clarification",
    "patient-confirmed-interpretation",
  ].filter((id) => patientEvidenceIds.includes(id));
  const priorityEvidenceIds = patientEvidenceIds.filter((id) => id.startsWith("patient-priority-"));
  const headacheAgenda: AgendaItem | undefined = /headache|head pain|pounding.{0,20}head|masakit ang ulo|bugbog.{0,20}ulo|dolor de cabeza/.test(normalizedReport)
    ? {
        label: "Clarify the headache character, onset, severity, and associated symptoms",
        rationale: "The patient reports a current headache, while its onset, duration, severity, location, and associated neurologic symptoms remain unresolved.",
        evidenceIds: pickAgendaEvidence(input.evidence, symptomEvidenceIds),
      }
    : undefined;
  const hearingAgenda: AgendaItem | undefined = /hearing|hear anything|cannot hear|can't hear|marinig|pandinig|audici[oó]n|o[ií]r/.test(normalizedReport)
    ? {
        label: "Assess the reported hearing change and its timeline",
        rationale: "The patient may be reporting hearing loss or another hearing change, but onset, laterality, duration, and associated ear symptoms are not established.",
        evidenceIds: pickAgendaEvidence(input.evidence, symptomEvidenceIds),
      }
    : undefined;
  const footPainAgenda: AgendaItem | undefined = /left foot|big toe|great toe|kaliwang paa|hinlalaki ng paa|dolor.{0,20}pie|dedo gordo/.test(normalizedReport)
    ? {
        label: "Characterize the persistent foot pain and reported big-toe onset",
        rationale: "The patient reports six months of sharp, severe left-foot or leg pain starting at the big toe; exact distribution, flare pattern, exam findings, and functional impact remain unknown.",
        evidenceIds: pickAgendaEvidence(input.evidence, [
          ...priorityEvidenceIds.slice(0, 1),
          ...symptomEvidenceIds,
        ]),
      }
    : undefined;
  const ineffectiveMedicationAgenda: AgendaItem | undefined = /medication.{0,30}(not helping|not working)|medicine.{0,30}(not helping|not working)|gamot.{0,30}(hindi|di).{0,20}(gumagana|tumutulong)|hindi nakatutulong ang gamot/.test(normalizedReport)
    ? {
        label: "Identify the medication the patient says is not helping",
        rationale: "The patient reports inadequate benefit, but the medication name, dose, indication, adherence, and prescribing history are not established; verify them before reconciliation or any medication decision.",
        evidenceIds: pickAgendaEvidence(input.evidence, [
          ...priorityEvidenceIds.slice(1, 2),
          ...symptomEvidenceIds,
        ]),
      }
    : undefined;
  const priorArthritisAgenda: AgendaItem | undefined = /arthritis/.test(normalizedReport) && /not improved|not getting better|hindi.{0,20}gumagaling|no mejora/.test(normalizedReport)
    ? {
        label: "Review the prior arthritis assessment and persistent symptoms",
        rationale: "The patient reports that a previous clinician used an arthritis explanation because of morning pain, while symptoms have continued without improvement; preserve that history without treating it as a confirmed diagnosis here.",
        evidenceIds: pickAgendaEvidence(input.evidence, [
          ...priorityEvidenceIds.slice(2, 3),
          ...symptomEvidenceIds,
        ]),
      }
    : undefined;
  const bloodPressureFacts = athenaFacts.filter((item) =>
    /hypertens|high blood pressure|lisinopril|losartan|amlodipine|hydrochlorothiazide/.test(`${item.label} ${item.value}`.toLowerCase()),
  );
  const bloodPressureAgenda: AgendaItem | undefined = headacheAgenda && bloodPressureFacts.length > 0
    ? {
        label: "Review vital signs, blood-pressure control, and current medication use",
        rationale: "A current headache is reported, and Athena lists blood-pressure-related history or medication; review both without assuming they are causally related.",
        evidenceIds: pickAgendaEvidence(input.evidence, [
          ...symptomEvidenceIds.slice(0, 1),
          ...bloodPressureFacts.map((item) => item.id),
        ]),
      }
    : undefined;
  const medicationAgenda: AgendaItem | undefined = discrepancies.length > 0
    ? {
        label: "Reconcile the patient report with the active medication list",
        rationale: "The patient reports stopping medication while Athena contains active medication entries; the exact medication must be confirmed.",
        evidenceIds: pickAgendaEvidence(input.evidence, [
          ...patientEvidenceIds.slice(0, 1),
          ...activeMedications.map((item) => item.id),
          ...patientEvidenceIds.slice(1),
        ]),
      }
    : undefined;
  return HandoffSchema.parse({
    headline: lowConfidence ? "Patient wording preserved for qualified language review" : "Patient-confirmed concern ready for clinician review",
    summary: lowConfidence
      ? `${input.patient.displayName} confirmed the native-language restatement. ${sonnetInterpretation ? `Sonnet produced this low-confidence English interpretation: “${reviewedInterpretation}” It is not independently verified; qualified language review remains required.` : "No reliable English interpretation is asserted; qualified language review remains required."}${athenaFacts.length > 0 ? ` ${athenaFacts.length} Athena item${athenaFacts.length === 1 ? " was" : "s were"} retrieved without silently reconciling the chart.` : " No chart facts were assumed."}`
      : sonnetInterpretation
        ? `${input.patient.displayName} confirmed the native-language restatement before forwarding. Sonnet's English interpretation is: “${reviewedInterpretation}” The original wording and clarification remain attached for clinician verification.${athenaFacts.length > 0 ? ` ${athenaFacts.length} relevant Athena item${athenaFacts.length === 1 ? " was" : "s were"} retrieved without silently reconciling the chart.` : " No chart facts were assumed."}`
        : `${input.patient.displayName} confirmed this rendering before forwarding: “${reviewedInterpretation}” The original wording and clarification remain attached as evidence.${athenaFacts.length > 0 ? ` ${athenaFacts.length} relevant Athena item${athenaFacts.length === 1 ? " was" : "s were"} retrieved without silently reconciling the chart.` : " No chart facts were assumed."}`,
    agenda: [
      interpretationAgenda,
      ...(headacheAgenda ? [headacheAgenda] : []),
      ...(hearingAgenda ? [hearingAgenda] : []),
      ...(footPainAgenda ? [footPainAgenda] : []),
      ...(ineffectiveMedicationAgenda ? [ineffectiveMedicationAgenda] : []),
      ...(priorArthritisAgenda ? [priorArthritisAgenda] : []),
      ...(bloodPressureAgenda ? [bloodPressureAgenda] : []),
      ...(medicationAgenda ? [medicationAgenda] : []),
    ].slice(0, 5),
    relevantHistory: athenaFacts
      .filter((item) => item.label !== "Upcoming appointment")
      .slice(0, 5)
      .map((item) => item.value),
    discrepancies,
    openQuestions: [
      "Confirm duration, 0–10 severity, and functional impact during clinician review if still unknown.",
      ...(input.intake?.confidence === "low" ? ["Use a qualified interpreter to verify the remaining low-confidence nuance."] : []),
      ...(input.intake?.ambiguities ?? []).map((ambiguity) => `Resolve interpretation ambiguity: ${ambiguity}`),
    ].slice(0, 5),
    disposition: "clinician-review",
    confidence: input.intake?.confidence ?? "medium",
    evidenceIds,
  });
}

export async function runPrevisitWorkflow(input: RunInput): Promise<RunResult> {
  const startedAt = new Date().toISOString();
  const scenario = getScenario(input.scenarioId);
  const config = getAthenaConfig();
  const shouldReadAthena = input.scenarioId === "maya-previsit" && input.preferLiveAthena && config.mode === "live" && hasAthenaCredentials(config);
  const patientId = shouldReadAthena ? config.demoPatientId : scenario.patient.id;
  let patient: DemoScenario["patient"] & { appointmentId?: string; identitySource: "athena" | "fixture" } = {
    ...scenario.patient,
    id: patientId,
    identitySource: "fixture",
  };
  let athenaFacts: Evidence[] = scenario.evidence.filter((item) => item.source === "athena");
  let athenaMode: RunResult["execution"]["athena"] = "fixture";

  if (shouldReadAthena) {
    try {
      const context = await new AthenaPreviewClient(config).chartContext(patientId);
      patient = resolvePatient(scenario.patient, context, patientId, config.demoAppointmentId);
      athenaFacts = athenaEvidence(context, config.demoAppointmentId);
      athenaMode = context.partialFailures.length > 0 ? "partial" : "live";
    } catch {
      athenaFacts = [];
      athenaMode = "degraded";
    }
  }

  const safetyText = input.urgentIntake
    ? `${input.urgentIntake.chiefComplaint} ${input.urgentIntake.clarificationResponse ?? ""} ${input.urgentIntake.englishSafetyTranslation ?? ""}`
    : input.intake
      ? `${input.intake.chiefComplaint} ${input.intake.clarificationResponse}`
      : scenario.conversation
        .filter((message) => message.speaker === "patient")
        .map((message) => message.text)
        .join(" ");
  const safety = evaluateIntakeSafety(safetyText);
  if (input.urgentIntake && (safety.branch !== "escalated" || safety.ruleId !== input.urgentIntake.safetyRuleId)) {
    throw new Error("Urgent intake did not match the deterministic safety rule supplied by the client.");
  }
  const escalated = safety.branch === "escalated";
  const guidanceDisplayed = input.urgentIntake?.guidanceDisplayed === true
    || (!input.intake && scenario.conversation.some((message) => message.speaker === "behemoth" && /emergenc|urgent/i.test(`${message.text} ${message.translated ?? ""}`)));
  const concerns = input.urgentIntake
    ? [urgentConcern(input.urgentIntake)]
    : input.intake
      ? interactiveConcerns(input.intake, escalated)
      : scenario.concerns;
  const conversation = input.urgentIntake
    ? urgentConversation(patient, input.urgentIntake, safety.guidance)
    : input.intake
      ? interactiveConversation(patient, input.intake)
      : scenario.conversation;
  const patientFacts = input.urgentIntake
    ? urgentEvidence(input.urgentIntake, safety.guidance)
    : input.intake
      ? interactiveEvidence(input.intake)
      : scenario.evidence.filter((item) => item.source !== "athena");
  const evidence = [...patientFacts, ...athenaFacts];
  const deterministicDisposition: ClinicalHandoff["disposition"] = escalated ? "emergency-guidance" : "clinician-review";
  const fallback = buildEvidenceLinkedFallback({
    patient,
    intake: input.intake,
    concerns,
    evidence,
    disposition: deterministicDisposition,
    guidanceDisplayed,
  });
  const generation = escalated
    ? { handoff: fallback, mode: "fixture" as const }
    : await generateClinicalHandoff({
        patient,
        conversation,
        concerns,
        evidence,
        fallback,
        deterministicDisposition,
        preferLive: input.preferLiveModel,
      });

  return {
    runId: `run_${crypto.randomUUID().slice(0, 8)}`,
    workflowId: "previsit-intake-v1",
    scenarioId: scenario.id,
    startedAt,
    completedAt: new Date().toISOString(),
    patient: {
      id: patient.id,
      displayName: patient.displayName,
      age: patient.age,
      language: patient.language,
      appointment: patient.appointment,
      appointmentId: patient.appointmentId,
      identitySource: patient.identitySource,
    },
    concerns,
    evidence,
    handoff: generation.handoff,
    execution: {
      athena: athenaMode,
      model: generation.mode,
      safetyBranch: escalated ? "escalated" : "standard",
    },
    approval: { required: true, status: "pending" },
  };
}

export function formatAppointmentNote(result: RunResult): string {
  const lines = [
    "BEHEMOTH PRE-VISIT INTAKE — CLINICIAN APPROVED",
    "",
    result.handoff.summary,
    "",
    "VISIT AGENDA",
    ...result.handoff.agenda.map(
      (item) => `- ${item.label}\n  Rationale: ${item.rationale}\n  Evidence: ${item.evidenceIds.join(", ")}`,
    ),
  ];
  if (result.handoff.discrepancies.length) {
    lines.push("", "DISCREPANCIES TO RECONCILE", ...result.handoff.discrepancies.map((item) => `- ${item}`));
  }
  if (result.handoff.openQuestions.length) {
    lines.push("", "OPEN QUESTIONS", ...result.handoff.openQuestions.map((item) => `- ${item}`));
  }
  lines.push("", `Audit: ${result.runId} · Evidence: ${result.handoff.evidenceIds.join(", ")}`);
  return lines.join("\n").slice(0, 4000);
}
