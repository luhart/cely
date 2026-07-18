import { NextResponse } from "next/server";

import { interpretIntake } from "@/lib/ai/interpret-intake";
import { IntakeInterpretationRequestSchema } from "@/lib/workflow/contracts";
import { runIntakeInterpretationPipeline } from "@/lib/workflow/interpretation-pipeline";

export const maxDuration = 30;

export async function POST(request: Request) {
  const parsed = IntakeInterpretationRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid interpretation request", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const outcome = await runIntakeInterpretationPipeline(parsed.data, interpretIntake);
    if (outcome.kind === "escalated") {
      return NextResponse.json(
        {
          error: outcome.phase === "raw"
            ? "Routine interpretation stopped by the deterministic safety policy."
            : "Routine interpretation stopped after deterministic screening of the English interpretation.",
          safety: outcome.safety,
          englishSafetyTranslation: outcome.englishSafetyTranslation,
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ ...outcome.result, mode: "sonnet" });
  } catch {
    return NextResponse.json(
      { error: "English interpretation is temporarily unavailable. Please retry or use a qualified interpreter." },
      { status: 503 },
    );
  }
}
