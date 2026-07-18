import type {
  IntakeInterpretation,
  IntakeInterpretationRequest,
} from "@/lib/workflow/contracts";
import { detectIntakeLanguage } from "@/lib/workflow/language";

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[“”"'’.,!?;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SOURCE_LANGUAGE_MARKERS = {
  Tagalog: ["ako", "akong", "ang", "aking", "ay", "hindi", "ko", "may", "mga", "ng", "parang", "sa", "wala"],
  Spanish: ["como", "con", "desde", "dolor", "el", "ella", "en", "estoy", "la", "me", "pero", "por", "que", "siento", "tengo"],
} as const;

type MarkerLanguage = keyof typeof SOURCE_LANGUAGE_MARKERS;

const NON_LATIN_SCRIPTS = [
  "Arabic",
  "Armenian",
  "Bengali",
  "Cyrillic",
  "Devanagari",
  "Georgian",
  "Gujarati",
  "Gurmukhi",
  "Han",
  "Hangul",
  "Hebrew",
  "Hiragana",
  "Kannada",
  "Katakana",
  "Lao",
  "Malayalam",
  "Myanmar",
  "Tamil",
  "Telugu",
  "Thai",
] as const;

function primaryLanguageCode(value: string | undefined): string | null {
  return value?.toLocaleLowerCase().split("-")[0] || null;
}

function detectedLanguageCode(value: string): string | null {
  const detection = detectIntakeLanguage(value);
  return detection.status === "detected" ? primaryLanguageCode(detection.languageCode) : null;
}

function sharesNonLatinScript(source: string, candidate: string): boolean {
  return NON_LATIN_SCRIPTS.some((script) => {
    const pattern = new RegExp(`\\p{Script=${script}}`, "gu");
    const sourceCharacters = source.match(pattern)?.length ?? 0;
    pattern.lastIndex = 0;
    const candidateCharacters = candidate.match(pattern)?.length ?? 0;
    return sourceCharacters >= 3 && candidateCharacters >= 3;
  });
}

function hasHeavySourceTokenOverlap(source: string, candidate: string): boolean {
  const sourceTokens = new Set(normalize(source).match(/\p{Letter}{2,}/gu) ?? []);
  const candidateTokens = [...new Set(normalize(candidate).match(/\p{Letter}{2,}/gu) ?? [])];
  if (candidateTokens.length < 3) return false;
  const overlap = candidateTokens.filter((token) => sourceTokens.has(token)).length;
  return overlap >= 3 && overlap / candidateTokens.length >= 0.6;
}

/** Rejects outputs that would put source-language text under an English label. */
export function interpretationValidationError(
  request: IntakeInterpretationRequest,
  interpretation: IntakeInterpretation,
): string | null {
  const sourceParts = [request.chiefComplaint, request.clarificationResponse]
    .map(normalize)
    .filter((value) => value.length >= 8);
  const english = normalize(interpretation.englishInterpretation);
  const native = normalize(interpretation.patientInterpretation);
  const sourceIsEnglish = request.languageCode?.toLocaleLowerCase().startsWith("en")
    || request.preferredLanguage.toLocaleLowerCase() === "english";
  const sourceText = sourceParts.join(" ");
  const sourceLanguageCode = detectedLanguageCode(sourceText)
    ?? primaryLanguageCode(request.languageCode);
  const nativeLanguageCode = detectedLanguageCode(interpretation.patientInterpretation);
  const requestedMarkers = SOURCE_LANGUAGE_MARKERS[request.preferredLanguage as MarkerLanguage] ?? [];
  const sourceTokens = new Set(sourceParts.join(" ").split(" "));
  const inferredMarkerSets = (Object.keys(SOURCE_LANGUAGE_MARKERS) as MarkerLanguage[])
    .filter((language) => SOURCE_LANGUAGE_MARKERS[language].filter((marker) => sourceTokens.has(marker)).length >= 3)
    .map((language) => SOURCE_LANGUAGE_MARKERS[language]);
  const markerSets = requestedMarkers.length > 0 ? [requestedMarkers, ...inferredMarkerSets] : inferredMarkerSets;

  if (!english || (!sourceIsEnglish && english === native)) {
    return "English interpretation is empty or duplicates the native-language rendering.";
  }
  if (!sourceIsEnglish && sourceLanguageCode && nativeLanguageCode && nativeLanguageCode !== sourceLanguageCode) {
    return "Native-language rendering does not appear to match the patient's intake language.";
  }
  if (!sourceIsEnglish && sourceParts.some((source) => english === source || english.includes(source))) {
    return "English interpretation reproduces the source-language response verbatim.";
  }
  if (!sourceIsEnglish && (
    (sourceLanguageCode && detectedLanguageCode(interpretation.englishInterpretation) === sourceLanguageCode)
    || sharesNonLatinScript(sourceText, interpretation.englishInterpretation)
    || hasHeavySourceTokenOverlap(sourceText, interpretation.englishInterpretation)
  )) {
    return "English interpretation still appears to be in the source language.";
  }

  const englishTokens = new Set(english.split(" "));
  if (!sourceIsEnglish && markerSets.some((markers) => markers.filter((marker) => englishTokens.has(marker)).length >= 4)) {
    return "English interpretation still appears to be in the source language.";
  }
  for (const topic of interpretation.visitTopics) {
    const topicNative = normalize(topic.nativeSummary);
    const topicEnglish = normalize(topic.englishSummary);
    if (!topicEnglish || (!sourceIsEnglish && topicEnglish === topicNative)) {
      return "A visit topic is empty or duplicates its native-language rendering under the English label.";
    }
    if (!sourceIsEnglish && (
      (sourceLanguageCode && detectedLanguageCode(topic.englishSummary) === sourceLanguageCode)
      || sharesNonLatinScript(sourceText, topic.englishSummary)
      || hasHeavySourceTokenOverlap(sourceText, topic.englishSummary)
    )) {
      return "A visit topic still appears to be in the source language.";
    }
    const topicEnglishTokens = new Set(topicEnglish.split(" "));
    if (!sourceIsEnglish && markerSets.some((markers) => markers.filter((marker) => topicEnglishTokens.has(marker)).length >= 3)) {
      return "A visit topic still appears to be in the source language.";
    }
  }
  return null;
}
