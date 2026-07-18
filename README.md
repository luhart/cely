# Behemoth

**The clinical workflow compiler.** Behemoth turns a messy patient need into a safe, Athena-grounded action, then turns each clinician-approved resolution into a versioned, testable skill reusable by any agent or care team.

The hackathon wedge is intentionally narrow: a multilingual pre-visit intake for a new or long-absent outpatient. The reusable skill compiler is the technical reveal—not a generic dashboard or medical chatbot.

## PRD scope

The hackathon slice covers multilingual pre-visit intake that separates multiple concerns, lets the patient identify the highest-priority concern, and produces an evidence-linked clinical agenda. Sonnet provides the bounded bilingual interpretation and structured handoff, Athena Preview supplies cited chart context, and a clinician or nurse must approve any proposed write.

Application state is session-only and held in memory; this scaffold does not add a persistent patient-data database. That is not a zero-retention claim: when live integrations are enabled, patient text and chart context are processed by Claude, and Athena Preview remains the source and optional write target. Resetting the app clears its local session state, not data governed by those upstream services.

Voice intake and text-message delivery, scanned-chart or PDF migration, ICD mapping, and translated after-visit delivery are deliberately deferred. They are plausible follow-on workflows, not part of this demo's safety or completion claims.

## Three-minute demo

1. Start with Maya Santos's first message in any language. For the golden path, choose the editable Tagalog shoulder demo: Maya says her shoulder is `kumikirot`, reports morning dizziness, and says she stopped her blood-pressure medicine. Behemoth detects Tagalog from that message; there is no language picker before the patient speaks.
2. Behemoth preserves her exact words, asks one bounded question, extracts separate bilingual visit topics, and asks Maya which concern matters most before forwarding the confirmed intake into the Athena-grounded handoff workflow.
3. The confirmed intake runs `previsit-intake-v1` against Maya's real synthetic Athena Preview record and appointment. The clinician sees Maya's preference separately from the clinical agenda, where Athena's hypertension and active-lisinopril context can elevate the medication discrepancy with cited evidence.
4. Approve the handoff. Behemoth records a dry-run receipt for Preview appointment `2589077`; no Athena mutation occurs in the hackathon configuration.
5. Compile the approved trace. The app emits `SKILL.md`, agent UI metadata, a permission policy, and a replayable golden trace.
6. Switch to the red-flag replay—or type Spanish chest pressure with shortness of breath into the universal first-message intake. The deterministic policy immediately displays bilingual emergency guidance, bypasses the model, and clinician acknowledgement performs no Athena write.

For a second standard-path replay, choose `Tagalog foot pain`. It captures six months of left-foot pain with big-toe onset, an unspecified medication concern, a prior clinician's arthritis attribution, and a patient-observed food association. The clinician handoff preserves each as a separate cited concern without asserting gout, a medication identity, or a causal dietary trigger.

First-message language detection runs locally and deterministically. High-confidence results continue immediately; uncertain or short messages keep the exact original text and ask the patient to confirm or enter a language name. The detector covers common ISO languages, and the intake includes localized clarification controls for widely used languages with an English fallback for other supported languages. Correcting the intake language does not rewrite the message or change the language preference stored in Athena.

Free-form multilingual intake then uses Sonnet for a bounded same-language restatement plus a real English clinician interpretation; model failure stops at the clarification step instead of displaying source-language text as English. Athena and Claude can be enabled independently, and handoff failures degrade to an evidence-linked fallback without swapping in another patient's canned summary.

## Quick start

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Run the full verification suite:

```bash
pnpm verify
```

## Athena Preview

The adapter uses the same 2-legged server authentication contract as the existing Sematic Athena client:

- Base URL: `https://api.preview.platform.athenahealth.com`
- Token: `POST /oauth2/v1/token`
- Scope: `athena/service/Athenanet.MDP.*`
- Reads: patient, appointments, problems, active medications, and allergies
- Approval-gated write: `POST /v1/{practiceid}/appointments/{appointmentid}/notes`

Set these values in `.env.local`:

```bash
ATHENA_MODE=live
NEXT_PUBLIC_ATHENA_CLIENT_ID_2_LEG=...
ATHENA_CLIENT_SECRET_2_LEG=...
ATHENA_PRACTICE_ID=1959870
ATHENA_DEPARTMENT_ID=150
ATHENA_DEMO_PATIENT_ID=946985
ATHENA_DEMO_APPOINTMENT_ID=2589077
```

`946985` is a dedicated synthetic Preview patient named Maya Santos (`tgl`). The demo setup contains only the minimum useful context: hypertensive disorder, active lisinopril, and booked appointment `2589077` on July 20, 2026 at 08:00. It was created for this hackathon so shared canonical Preview patients do not need to be renamed.

Live reads can remain enabled while writes stay off. Keep `ATHENA_WRITEBACK_ENABLED=false` for this scaffold. The live route re-fetches the configured patient-scoped appointment and verifies ownership, booked status, and date before mutation, but production-quality writeback still needs an authenticated server-side run/approval record and server-built note content.

The client refuses live mode against any base URL other than Athena Preview. It never sends credentials to the browser and does not include upstream error bodies in responses.

## Claude

Set `AGENT_MODE=live` and `ANTHROPIC_API_KEY` to enable both AI stages. `claude-sonnet-5` handles free-form bilingual interpretation before patient confirmation and generates the downstream structured handoff. Both outputs are schema-constrained. Known English, Spanish, and Tagalog red-flag phrases are screened before either generation. For other languages, the route also runs the same deterministic policy over Sonnet's English interpretation and stops routine intake before confirmation when it matches; interpretation fails closed if Sonnet is unavailable.

Each visit-agenda item carries a clinical rationale and one to three evidence citations. The clinician view renders those supporting patient statements or Athena facts directly beneath the agenda item so the recommendation is inspectable rather than merely asserted.

## Project map

```text
src/app/                    Next.js UI and route handlers
src/lib/athena/             Preview-only auth and typed client
src/lib/workflow/           schemas, runner, and write policy
src/lib/ai/                 constrained interpretation and handoff generation
src/lib/skills/             approved-trace skill compiler
src/lib/demo/               synthetic golden-path fixtures
skills/                     portable Codex/Claude-compatible skills
tests/                      policy and compiler contract tests
```

## Safety contract

- Synthetic or explicitly authorized Preview data only.
- Patient words and chart facts remain distinct and cited.
- Routine text is sent to Sonnet only to generate the bilingual review; it does not enter the Athena-grounded handoff workflow until the patient confirms the native-language rendering. A directly recognized red-flag report instead enters the immediate safety branch with its original wording and displayed guidance attached.
- A patient confirms the native-language restatement, not the English translation; the handoff preserves that provenance and any unresolved ambiguity for clinician review.
- Missing chart data is “unavailable,” never assumed negative.
- Deterministic English, Spanish, and Tagalog red-flag checks run before the model and can halt the normal workflow.
- Other-language intake is screened again with deterministic rules over the English interpretation before the patient can confirm it; the evidence ledger distinguishes this from a direct pre-model match.
- The model cannot diagnose, prescribe, approve itself, or write autonomously.
- Every visit-agenda recommendation cites supplied evidence already present in the handoff.
- Every write requires a human role, explicit approval, Preview environment, and a separate configuration flag.

## What is new

All Behemoth application, workflow, policy, compiler, fixture, and skill code in this repository was created for the hackathon. The Athena authentication and endpoint contract were researched from the team's existing Sematic client and local Athena OpenAPI notes; that existing application code is not copied into this repository.

## Portable skills

- `adaptive-patient-intake` — detected-or-patient-corrected intake-language agenda capture and bounded clarification
- `athena-chart-context` — minimum necessary chart retrieval with provenance
- `safe-clinical-handoff` — concise preread with uncertainty and discrepancies
- `athena-approved-action` — explicit approval, Preview write, and verification
- `compile-workflow-skill` — approved trace to governed skill package

Future expansion: compile a care-gap outreach workflow for APCM/VBC, using the same runtime and policy gates.
