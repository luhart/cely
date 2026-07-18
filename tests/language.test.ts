import { describe, expect, test } from "bun:test";

import { detectIntakeLanguage, resolveLanguageOverride } from "../src/lib/workflow/language";
import { hasLocalizedExperience } from "../src/lib/workflow/language-profiles";

describe("deterministic intake language detection", () => {
  test("detects the persistent foot-pain example as Tagalog", () => {
    const result = detectIntakeLanguage(
      "Doc, anim na buwan na pong masakit ang kaliwa kong paa, at parang hindi po gumagana ang gamot ko. Lagi pong sinasabi ng doktor na arthritis ito dahil masakit tuwing umaga, pero hindi naman po gumagaling.",
    );
    expect(result).toMatchObject({ status: "detected", languageName: "Tagalog", languageCode: "tl", confidence: "high" });
  });

  test("detects the existing Spanish example", () => {
    expect(detectIntakeLanguage("Me mareo por las mañanas desde que dejé de tomar la pastilla para la presión.")).toMatchObject({
      status: "detected",
      languageName: "Spanish",
      languageCode: "es",
    });
  });

  test.each([
    ["English", "en", "I have had pain in my left foot for six months and my medicine is not helping."],
    ["French", "fr", "Bonjour docteur, j’ai mal au pied gauche depuis six mois et mon médicament ne semble pas fonctionner."],
    ["German", "de", "Guten Tag, ich habe seit sechs Monaten Schmerzen im linken Fuß und meine Medikamente helfen nicht."],
    ["Portuguese", "pt", "Doutor, estou com dor no pé esquerdo há seis meses e meu remédio não parece estar ajudando."],
    ["Italian", "it", "Dottore, ho dolore al piede sinistro da sei mesi e la medicina non sembra aiutare."],
    ["Hindi", "hi", "डॉक्टर, मेरे बाएं पैर में छह महीने से दर्द है और मेरी दवा से आराम नहीं मिल रहा है।"],
    ["Bengali", "bn", "ডাক্তার, আমার বাম পায়ে ছয় মাস ধরে ব্যথা এবং ওষুধে উপকার হচ্ছে না।"],
    ["Urdu", "ur", "ڈاکٹر، میرے بائیں پاؤں میں چھ ماہ سے درد ہے اور دوا سے آرام نہیں آ رہا۔"],
    ["Vietnamese", "vi", "Bác sĩ, tôi bị đau bàn chân trái suốt sáu tháng và thuốc dường như không có tác dụng."],
    ["Russian", "ru", "Доктор, у меня уже шесть месяцев болит левая стопа, и лекарство, похоже, не помогает."],
    ["Ukrainian", "uk", "Лікарю, у мене вже шість місяців болить ліва стопа, і ліки, здається, не допомагають."],
    ["Polish", "pl", "Doktorze, od sześciu miesięcy boli mnie lewa stopa i wydaje się, że lek nie pomaga."],
    ["Turkish", "tr", "Doktor, sol ayağım altı aydır ağrıyor ve ilacım işe yaramıyor gibi görünüyor."],
    ["Indonesian", "id", "Dokter, kaki kiri saya sudah sakit selama enam bulan dan obat saya sepertinya tidak membantu."],
    ["Thai", "th", "คุณหมอ ฉันปวดเท้าซ้ายมาหกเดือนแล้ว และยาที่กินอยู่ดูเหมือนจะไม่ช่วยเลย"],
    ["Japanese", "ja", "こんにちは、左足が六か月前から痛くて、薬が効いていないようです。"],
    ["Korean", "ko", "의사 선생님, 왼발이 6개월 동안 아팠고 약이 효과가 없는 것 같습니다."],
    ["Chinese", "zh", "医生，我的左脚已经疼了六个月，药物似乎没有效果。"],
    ["Arabic", "ar", "أشعر بألم في قدمي اليسرى منذ ستة أشهر ويبدو أن الدواء لا يساعدني."],
    ["Persian", "fa", "دکتر، شش ماه است که پای چپم درد می‌کند و دارویم به نظر نمی‌رسد که کمک کند."],
  ])("detects a common %s message", (languageName, languageCode, message) => {
    expect(detectIntakeLanguage(message)).toMatchObject({ status: "detected", languageName, languageCode });
  });

  test.each(["Doc", "po po po", "Masakit ang pie", "🙂🙂🙂"])("abstains on short or ambiguous input: %s", (message) => {
    expect(detectIntakeLanguage(message).status).toBe("undetermined");
  });

  test("resolves manual common-language names and aliases", () => {
    for (const [input, languageName, languageCode] of [
      ["French", "French", "fr"],
      ["Filipino", "Tagalog", "tl"],
      ["Mandarin", "Chinese", "zh"],
      ["Simplified Chinese", "Chinese", "zh"],
      ["Traditional Chinese", "Chinese", "zh"],
      ["Arabic", "Arabic", "ar"],
      ["Arabic, Standard", "Arabic", "ar"],
      ["Farsi", "Persian", "fa"],
      ["Español", "Spanish", "es"],
      ["Français", "French", "fr"],
      ["中文", "Chinese", "zh"],
      ["日本語", "Japanese", "ja"],
      ["العربية", "Arabic", "ar"],
      ["हिन्दी", "Hindi", "hi"],
    ]) {
      const language = resolveLanguageOverride(input);
      expect(language).toMatchObject({ languageCode, languageName });
      expect(hasLocalizedExperience(language?.languageName ?? "")).toBe(true);
    }
    expect(resolveLanguageOverride("not a language")).toBeNull();
  });
});
