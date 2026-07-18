---
name: safe-clinical-handoff
description: Turn patient concerns and cited chart context into a concise, uncertainty-aware clinician preread. Use when a care team needs a prioritized visit agenda, relevant history, discrepancies, open questions, and disposition while keeping clinical authority with a qualified human.
---

# Safe clinical handoff

## Build the preread

1. Lead with the issue that most changes the visit or requires immediate routing.
2. Summarize patient concerns without converting symptoms into diagnoses.
3. Preserve every patient-confirmed concern and keep the patient-selected top concern distinct from clinical urgency.
4. Reorder a patient preference only when safety or cited chart context supports it, and explain the reason.
5. Include only chart history relevant to the current agenda.
6. Put patient/chart conflicts in a dedicated discrepancies section.
7. List unanswered questions instead of guessing.
8. Give every agenda item a concise label, a short clinical rationale, and one to three supplied evidence IDs.
9. Include every agenda evidence ID in the handoff's global evidence IDs.
10. Keep the result readable in one minute.

## Output contract

Return: headline, summary, structured agenda items, relevant history, discrepancies, open questions, disposition, confidence, and global evidence IDs. Each agenda item must contain `label`, `rationale`, and one to three `evidenceIds` drawn from the supplied evidence. Every agenda evidence ID must also appear in the global evidence IDs.

Disposition must be one of `clinician-review`, `nurse-triage`, or `emergency-guidance`. The handoff is always a draft until a qualified human approves it.
