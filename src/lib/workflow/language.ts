import { francAll } from "franc-min";
import ISO6391 from "iso-639-1";

export type DetectedIntakeLanguage = {
  status: "detected";
  languageName: string;
  languageCode: string;
  iso6393: string;
  confidence: "high" | "medium";
  method: "deterministic";
};

export type UndeterminedIntakeLanguage = {
  status: "undetermined";
  confidence: "low";
  method: "deterministic";
  reason: "too-short" | "ambiguous" | "unsupported";
};

export type IntakeLanguageDetection = DetectedIntakeLanguage | UndeterminedIntakeLanguage;

type MarkerLanguage = "Arabic" | "English" | "Hindi" | "Spanish" | "Tagalog";

type LanguageMetadata = {
  languageName: string;
  languageCode: string;
  iso6393: string;
};

// `franc-min` emits ISO-639-3 codes. This compact map covers its common-language
// models without shipping the full ~7,800-entry ISO-639-3 catalog to the browser.
const FRANC_TO_LANGUAGE_CODE: Record<string, string> = {
  amh: "am", arb: "ar", azj: "az", bel: "be", ben: "bn", bho: "bho",
  bos: "bs", bul: "bg", ceb: "ceb", ces: "cs", ckb: "ckb", cmn: "zh",
  deu: "de", ell: "el", eng: "en", fra: "fr", fuv: "ff", guj: "gu",
  hau: "ha", hin: "hi", hms: "hms", hnj: "hnj", hrv: "hr", hun: "hu",
  ibo: "ig", ilo: "ilo",
  ind: "id", ita: "it", jav: "jv", jpn: "ja", kan: "kn", kaz: "kk",
  kin: "rw", koi: "koi", kor: "ko", lin: "ln", mad: "mad", mag: "mag",
  mai: "mai", mal: "ml", mar: "mr", mya: "my", nld: "nl", npi: "ne",
  nya: "ny", pan: "pa", pbu: "ps", pes: "fa", plt: "mg", pol: "pl",
  por: "pt", qug: "qu", ron: "ro", run: "rn", rus: "ru", sin: "si",
  skr: "skr", som: "so", spa: "es", srp: "sr", sun: "su", swe: "sv",
  swh: "sw", tam: "ta", tel: "te", tgl: "tl", tha: "th", tur: "tr",
  ukr: "uk", urd: "ur", uzn: "uz", vie: "vi", yor: "yo", zlm: "ms",
  zul: "zu", zyb: "za",
};

const LANGUAGE_NAME_OVERRIDES: Record<string, string> = {
  bho: "Bhojpuri",
  ceb: "Cebuano",
  ckb: "Kurdish (Sorani)",
  hms: "Southern Qiandong Miao",
  hnj: "Hmong Njua",
  ilo: "Iloko",
  koi: "Komi-Permyak",
  mad: "Madurese",
  mag: "Magahi",
  mai: "Maithili",
  skr: "Saraiki",
};

function metadataFromIso3(iso6393: string): LanguageMetadata | null {
  const languageCode = FRANC_TO_LANGUAGE_CODE[iso6393];
  if (!languageCode) return null;
  const languageName = LANGUAGE_NAME_OVERRIDES[iso6393]
    ?? (languageCode.length === 2 ? ISO6391.getName(languageCode) : "");
  if (!languageName) return null;
  return { languageName, languageCode, iso6393 };
}

const LANGUAGE_BY_LOOKUP = new Map<string, LanguageMetadata>();
for (const languageCode of ISO6391.getAllCodes()) {
  const languageName = ISO6391.getName(languageCode);
  const iso6393 = Object.keys(FRANC_TO_LANGUAGE_CODE)
    .find((code) => FRANC_TO_LANGUAGE_CODE[code] === languageCode) ?? languageCode;
  const language = { languageName, languageCode, iso6393 };
  for (const value of [languageName, ISO6391.getNativeName(languageCode), languageCode]) {
    if (value) LANGUAGE_BY_LOOKUP.set(value.toLocaleLowerCase(), language);
  }
}

const LANGUAGE_ALIASES = new Map([
  ["arabic, standard", "ar"],
  ["العربية", "ar"],
  ["বাংলা", "bn"],
  ["bahasa indonesia", "id"],
  ["bahasa melayu", "ms"],
  ["brazilian portuguese", "pt"],
  ["čeština", "cs"],
  ["deutsch", "de"],
  ["español", "es"],
  ["farsi", "fa"],
  ["فارسی", "fa"],
  ["filipino", "tl"],
  ["français", "fr"],
  ["हिन्दी", "hi"],
  ["italiano", "it"],
  ["kiswahili", "sw"],
  ["magyar", "hu"],
  ["mandarin", "zh"],
  ["mandarin chinese", "zh"],
  ["nederlands", "nl"],
  ["日本語", "ja"],
  ["한국어", "ko"],
  ["中文", "zh"],
  ["polski", "pl"],
  ["português", "pt"],
  ["română", "ro"],
  ["русский", "ru"],
  ["simplified chinese", "zh"],
  ["ไทย", "th"],
  ["traditional chinese", "zh"],
  ["türkçe", "tr"],
  ["українська", "uk"],
  ["اردو", "ur"],
  ["עברית", "he"],
  ["ελληνικά", "el"],
  ["普通话", "zh"],
  ["tiếng việt", "vi"],
]);

const MARKERS: Record<MarkerLanguage, Record<string, number>> = {
  Arabic: {
    أشعر: 2, ألم: 2, الدواء: 2, اليسرى: 2, ستة: 1, في: 1, قدمي: 2, لا: 1,
    منذ: 2, يساعدني: 2, يبدو: 1,
  },
  Hindi: {
    डॉक्टर: 2, मेरे: 1, बाएं: 2, पैर: 2, छह: 1, महीने: 2, दर्द: 2,
    दवा: 2, आराम: 2, नहीं: 2, मिल: 1, रहा: 1, है: 1, और: 1,
  },
  Tagalog: {
    ako: 1, akong: 1, ang: 1, aking: 1, dahil: 1, gamot: 2, gumagaling: 2,
    hindi: 2, hinlalaki: 2, kaliwa: 2, ko: 1, kong: 1, kumikirot: 2, masakit: 2,
    mga: 2, nagsisimula: 2, ng: 1, paa: 2, pananakit: 2, parang: 2, po: 2,
    pong: 2, sa: 1, tuwing: 2, wala: 2, walang: 2,
  },
  Spanish: {
    cabeza: 2, con: 1, cuando: 1, desde: 2, dolor: 2, duele: 2, el: 1, en: 1,
    izquierda: 2, izquierdo: 2, la: 1, las: 1, los: 1, mareada: 2, mareo: 2,
    me: 1, mi: 1, no: 1, para: 1, pastilla: 2, pecho: 2, pie: 2, porque: 1,
    presion: 2, respirar: 2, sangrado: 2, siento: 2, tengo: 2, una: 1,
  },
  English: {
    doctor: 1, feel: 2, foot: 2, for: 1, have: 2, head: 2, helping: 2, hurts: 2,
    i: 1, is: 1, left: 2, medicine: 2, medication: 2, my: 1, not: 1, pain: 2,
    right: 2, since: 2, the: 1, this: 1, working: 2,
  },
};

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/(\p{Script=Latin})\p{Diacritic}+/gu, "$1")
    .toLocaleLowerCase();
}

function tokens(value: string): Set<string> {
  return new Set(normalize(value).match(/[\p{Letter}\p{Mark}]+/gu) ?? []);
}

function knownLanguage(languageName: MarkerLanguage): DetectedIntakeLanguage {
  const iso6393Code = languageName === "Tagalog"
    ? "tgl"
    : languageName === "Spanish"
      ? "spa"
      : languageName === "Arabic"
        ? "arb"
        : languageName === "Hindi"
          ? "hin"
          : "eng";
  const language = metadataFromIso3(iso6393Code);
  return {
    status: "detected",
    languageName,
    languageCode: language?.languageCode ?? (languageName === "Tagalog" ? "tl" : languageName === "Spanish" ? "es" : languageName === "Arabic" ? "ar" : languageName === "Hindi" ? "hi" : "en"),
    iso6393: iso6393Code,
    confidence: "high",
    method: "deterministic",
  };
}

function markerDetection(value: string): DetectedIntakeLanguage | null {
  const inputTokens = tokens(value);
  const ranked = (Object.keys(MARKERS) as MarkerLanguage[])
    .map((languageName) => {
      const matches = Object.entries(MARKERS[languageName]).filter(([marker]) => inputTokens.has(normalize(marker)));
      return {
        languageName,
        matches: matches.length,
        score: matches.reduce((total, [, weight]) => total + weight, 0),
      };
    })
    .sort((left, right) => right.score - left.score);
  const [first, second] = ranked;
  if (!first || !second) return null;
  const margin = first.score - second.score;
  if (first.score >= 6 && first.matches >= 3 && margin >= 3) return knownLanguage(first.languageName);
  return null;
}

function scriptDetection(value: string): DetectedIntakeLanguage | null {
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(value)) {
    return { status: "detected", languageName: "Japanese", languageCode: "ja", iso6393: "jpn", confidence: "high", method: "deterministic" };
  }
  if (/\p{Script=Hangul}/u.test(value)) {
    return { status: "detected", languageName: "Korean", languageCode: "ko", iso6393: "kor", confidence: "high", method: "deterministic" };
  }
  if (/\p{Script=Han}/u.test(value) && !/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(value)) {
    return { status: "detected", languageName: "Chinese", languageCode: "zh", iso6393: "cmn", confidence: "medium", method: "deterministic" };
  }
  return null;
}

export function detectIntakeLanguage(value: string): IntakeLanguageDetection {
  const normalized = normalize(value).trim();
  const characterCount = (normalized.match(/\p{Letter}/gu) ?? []).length;
  if (characterCount < 8) {
    return { status: "undetermined", confidence: "low", method: "deterministic", reason: "too-short" };
  }

  const byMarkers = markerDetection(value);
  if (byMarkers) return byMarkers;
  const byScript = scriptDetection(value);
  if (byScript) return byScript;

  const ranked = francAll(value)
    .map(([code, score]) => ({ language: metadataFromIso3(code), code, score }))
    .filter((candidate): candidate is { language: LanguageMetadata; code: string; score: number } => Boolean(candidate.language));
  const [first, second] = ranked;
  if (!first) {
    return { status: "undetermined", confidence: "low", method: "deterministic", reason: "unsupported" };
  }

  const margin = first.score - (second?.score ?? 0);
  const confidence = characterCount >= 40 && margin >= 0.04
    ? "high"
    : characterCount >= 20 && margin >= 0.02
      ? "medium"
      : null;
  if (!confidence) {
    return { status: "undetermined", confidence: "low", method: "deterministic", reason: "ambiguous" };
  }

  return {
    status: "detected",
    languageName: first.language.languageName,
    languageCode: first.language.languageCode,
    iso6393: first.code,
    confidence,
    method: "deterministic",
  };
}

export function resolveLanguageOverride(value: string): DetectedIntakeLanguage | null {
  const normalized = value.trim().toLocaleLowerCase();
  const aliasCode = LANGUAGE_ALIASES.get(normalized);
  const language = (aliasCode ? LANGUAGE_BY_LOOKUP.get(aliasCode) : null)
    ?? LANGUAGE_BY_LOOKUP.get(normalized)
    ?? metadataFromIso3(normalized);
  if (!language) return null;
  return {
    status: "detected",
    languageName: language.languageName,
    languageCode: language.languageCode,
    iso6393: language.iso6393,
    confidence: "high",
    method: "deterministic",
  };
}
