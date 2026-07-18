import { z } from "zod";

export const EvidenceSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  source: z.enum(["patient", "athena", "derived"]),
  resource: z.string().optional(),
  observedAt: z.string().optional(),
});

export const ConcernSchema = z.object({
  id: z.string(),
  patientWords: z.string(),
  translated: z.string().optional(),
  duration: z.string().nullable(),
  severity: z.number().int().min(0).max(10).nullable(),
  mentionOrder: z.number().int().min(1).max(8).optional(),
  patientPriority: z.enum(["top", "mentioned"]).optional(),
  priority: z.enum(["routine", "soon", "urgent"]),
});

export const VisitTopicSchema = z.object({
  nativeSummary: z.string().trim().min(1).max(300),
  englishSummary: z.string().trim().min(1).max(300),
});

export const ConfirmedConcernSchema = VisitTopicSchema.extend({
  id: z.string().trim().min(1).max(80),
  mentionOrder: z.number().int().min(1).max(8),
});

export const ConfirmedIntakeSchema = z
  .object({
    preferredLanguage: z.enum(["Tagalog", "Spanish"]),
    chiefComplaint: z.string().trim().min(3).max(1000),
    clarificationQuestion: z.string().trim().min(3).max(500),
    clarificationResponse: z.string().trim().min(1).max(500),
    nativeInterpretation: z.string().trim().min(3).max(1500).optional(),
    englishInterpretation: z.string().trim().min(3).max(1500),
    interpretationMethod: z.enum(["deterministic", "sonnet"]).optional(),
    ambiguities: z.array(z.string().trim().min(1).max(300)).max(4).optional(),
    interpretationConfirmed: z.literal(true),
    confidence: z.enum(["low", "medium", "high"]),
    confirmedConcerns: z.array(ConfirmedConcernSchema).min(1).max(8).optional(),
    topConcernId: z.string().trim().min(1).max(80).nullable().optional(),
    priorityConfirmed: z.literal(true).optional(),
  })
  .superRefine((intake, context) => {
    const concerns = intake.confirmedConcerns;
    if (!concerns) {
      if (typeof intake.topConcernId === "string") {
        context.addIssue({
          code: "custom",
          path: ["topConcernId"],
          message: "Top concern must reference a supplied confirmed concern.",
        });
      }
      return;
    }

    const ids = concerns.map((concern) => concern.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["confirmedConcerns"],
        message: "Confirmed concern IDs must be unique.",
      });
    }

    const mentionOrders = concerns.map((concern) => concern.mentionOrder).sort((left, right) => left - right);
    const hasContiguousMentionOrder = mentionOrders.every((order, index) => order === index + 1);
    if (!hasContiguousMentionOrder) {
      context.addIssue({
        code: "custom",
        path: ["confirmedConcerns"],
        message: "Confirmed concern mention order must be unique and contiguous from 1.",
      });
    }

    if (typeof intake.topConcernId === "string" && !ids.includes(intake.topConcernId)) {
      context.addIssue({
        code: "custom",
        path: ["topConcernId"],
        message: "Top concern must reference a supplied confirmed concern.",
      });
    }
  });

export const IntakeInterpretationRequestSchema = z.object({
  preferredLanguage: z.enum(["Tagalog", "Spanish"]),
  chiefComplaint: z.string().trim().min(3).max(1000),
  clarificationQuestion: z.string().trim().min(3).max(500),
  clarificationResponse: z.string().trim().min(1).max(500),
});

export const IntakeInterpretationSchema = z.object({
  patientInterpretation: z.string().trim().min(3).max(1500),
  englishInterpretation: z.string().trim().min(3).max(1500),
  visitTopics: z.array(VisitTopicSchema).min(1).max(8),
  confidence: z.enum(["low", "medium"]),
  ambiguities: z.array(z.string().trim().min(1).max(300)).max(4),
});

export const SafetyRuleIdSchema = z.enum([
  "chest-pain-with-dyspnea",
  "stroke-signs",
  "severe-bleeding",
  "self-harm",
]);

export const UrgentIntakeSchema = z.object({
  preferredLanguage: z.enum(["Tagalog", "Spanish"]),
  chiefComplaint: z.string().trim().min(3).max(1000),
  clarificationResponse: z.string().trim().min(1).max(500).optional(),
  safetyRuleId: SafetyRuleIdSchema,
  guidanceDisplayed: z.literal(true),
});

export const AgendaItemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  rationale: z.string().trim().min(1).max(400),
  evidenceIds: z
    .array(z.string().min(1))
    .min(1)
    .max(3)
    .refine((ids) => new Set(ids).size === ids.length, "Agenda evidence IDs must be unique."),
});

export const HandoffSchema = z
  .object({
    headline: z.string(),
    summary: z.string(),
    agenda: z.array(AgendaItemSchema).min(1).max(5),
    relevantHistory: z.array(z.string()).max(6),
    discrepancies: z.array(z.string()).max(5),
    openQuestions: z.array(z.string()).max(5),
    disposition: z.enum(["clinician-review", "nurse-triage", "emergency-guidance"]),
    confidence: z.enum(["high", "medium", "low"]),
    evidenceIds: z
      .array(z.string().min(1))
      .min(1)
      .refine((ids) => new Set(ids).size === ids.length, "Evidence IDs must be unique."),
  })
  .superRefine((handoff, context) => {
    const globalEvidenceIds = new Set(handoff.evidenceIds);
    handoff.agenda.forEach((item, itemIndex) => {
      item.evidenceIds.forEach((evidenceId, evidenceIndex) => {
        if (!globalEvidenceIds.has(evidenceId)) {
          context.addIssue({
            code: "custom",
            path: ["agenda", itemIndex, "evidenceIds", evidenceIndex],
            message: "Agenda evidence must also appear in the handoff evidence IDs.",
          });
        }
      });
    });
  });

export const ScenarioIdSchema = z.enum(["maya-previsit", "luis-escalation"]);

export const RunInputSchema = z
  .object({
    scenarioId: ScenarioIdSchema.default("maya-previsit"),
    preferLiveAthena: z.boolean().default(false),
    preferLiveModel: z.boolean().default(false),
    intake: ConfirmedIntakeSchema.optional(),
    urgentIntake: UrgentIntakeSchema.optional(),
  })
  .superRefine((input, context) => {
    if (input.intake && input.urgentIntake) {
      context.addIssue({
        code: "custom",
        path: ["intake"],
        message: "Submit either a confirmed intake or an urgent intake, not both.",
      });
    }
    if (input.scenarioId === "maya-previsit" && !input.intake && !input.urgentIntake) {
      context.addIssue({
        code: "custom",
        path: ["intake"],
        message: "Patient confirmation or a displayed urgent-safety branch is required before the workflow can run.",
      });
    }
  });

export const RunResultSchema = z.object({
  runId: z.string(),
  workflowId: z.literal("previsit-intake-v1"),
  scenarioId: ScenarioIdSchema,
  startedAt: z.string(),
  completedAt: z.string(),
  patient: z.object({
    id: z.string(),
    displayName: z.string(),
    age: z.number(),
    language: z.string(),
    appointment: z.string(),
    appointmentId: z.string().optional(),
    identitySource: z.enum(["athena", "fixture"]).optional(),
  }),
  concerns: z.array(ConcernSchema),
  evidence: z.array(EvidenceSchema),
  handoff: HandoffSchema,
  execution: z.object({
    athena: z.enum(["live", "partial", "fixture", "degraded"]),
    model: z.enum(["live", "fixture", "degraded"]),
    safetyBranch: z.enum(["standard", "escalated"]),
  }),
  approval: z.object({
    required: z.literal(true),
    status: z.enum(["pending", "approved"]),
  }),
});

export type Evidence = z.infer<typeof EvidenceSchema>;
export type Concern = z.infer<typeof ConcernSchema>;
export type VisitTopic = z.infer<typeof VisitTopicSchema>;
export type ConfirmedConcern = z.infer<typeof ConfirmedConcernSchema>;
export type ConfirmedIntake = z.infer<typeof ConfirmedIntakeSchema>;
export type IntakeInterpretationRequest = z.infer<typeof IntakeInterpretationRequestSchema>;
export type IntakeInterpretation = z.infer<typeof IntakeInterpretationSchema>;
export type SafetyRuleId = z.infer<typeof SafetyRuleIdSchema>;
export type UrgentIntake = z.infer<typeof UrgentIntakeSchema>;
export type AgendaItem = z.infer<typeof AgendaItemSchema>;
export type ClinicalHandoff = z.infer<typeof HandoffSchema>;
export type RunInput = z.infer<typeof RunInputSchema>;
export type RunResult = z.infer<typeof RunResultSchema>;
