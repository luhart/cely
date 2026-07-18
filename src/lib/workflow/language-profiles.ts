export type LanguageExperience = {
  clarificationQuestion: string;
  confirmationHeading: string;
  confirmLabel: string;
  priorityHeading: string;
  noPreference: string;
  changeLanguage: string;
};

const ENGLISH: LanguageExperience = {
  clarificationQuestion: "Can you add one detail about when this started or what it feels like?",
  confirmationHeading: "Is this what you meant?",
  confirmLabel: "Yes, this is right",
  priorityHeading: "What is most important to discuss first?",
  noPreference: "No specific preference",
  changeLanguage: "Change language",
};

const STANDARD_ARABIC: LanguageExperience = {
  clarificationQuestion: "هل يمكنك إضافة تفصيل عن وقت بدء ذلك أو عن الشعور الذي يسببه؟",
  confirmationHeading: "هل هذا ما قصدته؟",
  confirmLabel: "نعم، هذا صحيح",
  priorityHeading: "ما الأمر الأهم الذي تريد مناقشته أولًا؟",
  noPreference: "لا يوجد تفضيل محدد",
  changeLanguage: "تغيير اللغة",
};

const EXPERIENCES: Record<string, LanguageExperience> = {
  English: ENGLISH,
  French: {
    clarificationQuestion: "Pouvez-vous ajouter un détail sur le moment où cela a commencé ou sur ce que vous ressentez ?",
    confirmationHeading: "Est-ce bien ce que vous vouliez dire ?",
    confirmLabel: "Oui, c’est exact",
    priorityHeading: "Quel sujet est le plus important à aborder en premier ?",
    noPreference: "Aucune préférence particulière",
    changeLanguage: "Changer de langue",
  },
  German: {
    clarificationQuestion: "Können Sie noch genauer sagen, wann es begonnen hat oder wie es sich anfühlt?",
    confirmationHeading: "Haben Sie das so gemeint?",
    confirmLabel: "Ja, das stimmt",
    priorityHeading: "Was möchten Sie zuerst besprechen?",
    noPreference: "Keine besondere Präferenz",
    changeLanguage: "Sprache ändern",
  },
  Portuguese: {
    clarificationQuestion: "Pode acrescentar um detalhe sobre quando isso começou ou como se sente?",
    confirmationHeading: "Foi isso que quis dizer?",
    confirmLabel: "Sim, está correto",
    priorityHeading: "O que é mais importante discutir primeiro?",
    noPreference: "Sem preferência específica",
    changeLanguage: "Mudar idioma",
  },
  Italian: {
    clarificationQuestion: "Può aggiungere un dettaglio su quando è iniziato o su come si sente?",
    confirmationHeading: "È questo che intendeva?",
    confirmLabel: "Sì, è corretto",
    priorityHeading: "Qual è la cosa più importante da discutere per prima?",
    noPreference: "Nessuna preferenza specifica",
    changeLanguage: "Cambia lingua",
  },
  Chinese: {
    clarificationQuestion: "您能再说明一下这是什么时候开始的，或者是什么感觉吗？",
    confirmationHeading: "这是您想表达的意思吗？",
    confirmLabel: "是的，正确",
    priorityHeading: "您最希望先讨论哪一项？",
    noPreference: "没有特别偏好",
    changeLanguage: "更改语言",
  },
  "Mandarin Chinese": {
    clarificationQuestion: "您能再说明一下这是什么时候开始的，或者是什么感觉吗？",
    confirmationHeading: "这是您想表达的意思吗？",
    confirmLabel: "是的，正确",
    priorityHeading: "您最希望先讨论哪一项？",
    noPreference: "没有特别偏好",
    changeLanguage: "更改语言",
  },
  Japanese: {
    clarificationQuestion: "いつ始まったのか、またはどのように感じるのか、もう少し詳しく教えてください。",
    confirmationHeading: "この内容で合っていますか？",
    confirmLabel: "はい、合っています",
    priorityHeading: "最初に相談したいことはどれですか？",
    noPreference: "特に希望はありません",
    changeLanguage: "言語を変更",
  },
  Korean: {
    clarificationQuestion: "언제 시작되었는지 또는 어떤 느낌인지 한 가지 더 자세히 알려주시겠어요?",
    confirmationHeading: "이 의미가 맞나요?",
    confirmLabel: "네, 맞습니다",
    priorityHeading: "가장 먼저 논의하고 싶은 것은 무엇인가요?",
    noPreference: "특별한 선호 없음",
    changeLanguage: "언어 변경",
  },
  Arabic: STANDARD_ARABIC,
  "Arabic, Standard": STANDARD_ARABIC,
  Hindi: {
    clarificationQuestion: "क्या आप यह कब शुरू हुआ या कैसा महसूस होता है, इसके बारे में एक और जानकारी दे सकते हैं?",
    confirmationHeading: "क्या आपका यही मतलब था?",
    confirmLabel: "हाँ, यह सही है",
    priorityHeading: "आप सबसे पहले किस बारे में बात करना चाहते हैं?",
    noPreference: "कोई विशेष प्राथमिकता नहीं",
    changeLanguage: "भाषा बदलें",
  },
  Bengali: {
    clarificationQuestion: "এটি কখন শুরু হয়েছে বা কেমন অনুভূত হয় সে সম্পর্কে আরেকটি তথ্য দিতে পারেন?",
    confirmationHeading: "আপনি কি এটাই বোঝাতে চেয়েছেন?",
    confirmLabel: "হ্যাঁ, এটি সঠিক",
    priorityHeading: "কোন বিষয়টি আগে আলোচনা করা সবচেয়ে গুরুত্বপূর্ণ?",
    noPreference: "কোনো নির্দিষ্ট পছন্দ নেই",
    changeLanguage: "ভাষা পরিবর্তন করুন",
  },
  Urdu: {
    clarificationQuestion: "کیا آپ یہ کب شروع ہوا یا کیسا محسوس ہوتا ہے، اس بارے میں ایک اور تفصیل بتا سکتے ہیں؟",
    confirmationHeading: "کیا آپ کا یہی مطلب تھا؟",
    confirmLabel: "جی ہاں، یہ درست ہے",
    priorityHeading: "آپ سب سے پہلے کس بات پر گفتگو کرنا چاہتے ہیں؟",
    noPreference: "کوئی خاص ترجیح نہیں",
    changeLanguage: "زبان تبدیل کریں",
  },
  Vietnamese: {
    clarificationQuestion: "Bạn có thể cho biết thêm một chi tiết về lúc bắt đầu hoặc cảm giác như thế nào không?",
    confirmationHeading: "Đây có phải là điều bạn muốn nói không?",
    confirmLabel: "Đúng, chính xác",
    priorityHeading: "Điều gì quan trọng nhất cần trao đổi trước?",
    noPreference: "Không có ưu tiên cụ thể",
    changeLanguage: "Đổi ngôn ngữ",
  },
  Dutch: {
    clarificationQuestion: "Kunt u één detail toevoegen over wanneer dit begon of hoe het voelt?",
    confirmationHeading: "Is dit wat u bedoelde?",
    confirmLabel: "Ja, dat klopt",
    priorityHeading: "Wat is het belangrijkst om eerst te bespreken?",
    noPreference: "Geen specifieke voorkeur",
    changeLanguage: "Taal wijzigen",
  },
  Greek: {
    clarificationQuestion: "Μπορείτε να προσθέσετε μία λεπτομέρεια για το πότε ξεκίνησε ή πώς το αισθάνεστε;",
    confirmationHeading: "Αυτό εννοούσατε;",
    confirmLabel: "Ναι, σωστά",
    priorityHeading: "Τι είναι πιο σημαντικό να συζητήσετε πρώτα;",
    noPreference: "Καμία συγκεκριμένη προτίμηση",
    changeLanguage: "Αλλαγή γλώσσας",
  },
  Hebrew: {
    clarificationQuestion: "האם אפשר להוסיף פרט אחד על מתי זה התחיל או איך זה מרגיש?",
    confirmationHeading: "האם לזה התכוונת?",
    confirmLabel: "כן, זה נכון",
    priorityHeading: "מה הכי חשוב לך לדון בו קודם?",
    noPreference: "אין העדפה מיוחדת",
    changeLanguage: "שינוי שפה",
  },
  Malay: {
    clarificationQuestion: "Boleh tambah satu butiran tentang bila ini bermula atau bagaimana rasanya?",
    confirmationHeading: "Adakah ini yang anda maksudkan?",
    confirmLabel: "Ya, betul",
    priorityHeading: "Apakah perkara paling penting untuk dibincangkan dahulu?",
    noPreference: "Tiada pilihan khusus",
    changeLanguage: "Tukar bahasa",
  },
  Persian: {
    clarificationQuestion: "می‌توانید یک جزئیات دیگر درباره زمان شروع آن یا احساسی که دارد بگویید؟",
    confirmationHeading: "آیا منظورتان همین بود؟",
    confirmLabel: "بله، درست است",
    priorityHeading: "مهم‌ترین موضوعی که می‌خواهید ابتدا درباره آن صحبت کنید چیست؟",
    noPreference: "ترجیح خاصی ندارم",
    changeLanguage: "تغییر زبان",
  },
  Swahili: {
    clarificationQuestion: "Unaweza kuongeza maelezo moja kuhusu ilianza lini au inahisije?",
    confirmationHeading: "Je, hivi ndivyo ulivyomaanisha?",
    confirmLabel: "Ndiyo, ni sahihi",
    priorityHeading: "Ni jambo gani muhimu zaidi kujadili kwanza?",
    noPreference: "Hakuna upendeleo maalum",
    changeLanguage: "Badilisha lugha",
  },
  Russian: {
    clarificationQuestion: "Можете добавить одну деталь о том, когда это началось или как это ощущается?",
    confirmationHeading: "Вы это имели в виду?",
    confirmLabel: "Да, всё верно",
    priorityHeading: "Что важнее всего обсудить сначала?",
    noPreference: "Нет особых предпочтений",
    changeLanguage: "Изменить язык",
  },
  Ukrainian: {
    clarificationQuestion: "Чи можете додати одну деталь про те, коли це почалося або як це відчувається?",
    confirmationHeading: "Ви це мали на увазі?",
    confirmLabel: "Так, усе правильно",
    priorityHeading: "Що найважливіше обговорити спочатку?",
    noPreference: "Немає особливих уподобань",
    changeLanguage: "Змінити мову",
  },
  Polish: {
    clarificationQuestion: "Czy możesz dodać jeden szczegół o tym, kiedy to się zaczęło lub jakie to uczucie?",
    confirmationHeading: "Czy to właśnie masz na myśli?",
    confirmLabel: "Tak, zgadza się",
    priorityHeading: "Co jest najważniejsze do omówienia w pierwszej kolejności?",
    noPreference: "Brak szczególnych preferencji",
    changeLanguage: "Zmień język",
  },
  Turkish: {
    clarificationQuestion: "Bunun ne zaman başladığı veya nasıl hissettirdiği hakkında bir ayrıntı daha ekleyebilir misiniz?",
    confirmationHeading: "Bunu mu demek istediniz?",
    confirmLabel: "Evet, doğru",
    priorityHeading: "Önce konuşulması en önemli konu nedir?",
    noPreference: "Belirli bir tercih yok",
    changeLanguage: "Dili değiştir",
  },
  Indonesian: {
    clarificationQuestion: "Bisakah Anda menambahkan satu detail tentang kapan ini dimulai atau bagaimana rasanya?",
    confirmationHeading: "Apakah ini yang Anda maksud?",
    confirmLabel: "Ya, benar",
    priorityHeading: "Apa yang paling penting untuk dibahas terlebih dahulu?",
    noPreference: "Tidak ada pilihan khusus",
    changeLanguage: "Ganti bahasa",
  },
  Thai: {
    clarificationQuestion: "ช่วยบอกรายละเอียดเพิ่มเติมได้ไหมว่าเริ่มเมื่อใดหรือรู้สึกอย่างไร?",
    confirmationHeading: "นี่คือสิ่งที่คุณหมายถึงใช่ไหม?",
    confirmLabel: "ใช่ ถูกต้อง",
    priorityHeading: "เรื่องใดสำคัญที่สุดที่อยากพูดคุยก่อน?",
    noPreference: "ไม่มีความต้องการเฉพาะ",
    changeLanguage: "เปลี่ยนภาษา",
  },
};

export function languageExperience(languageName: string): LanguageExperience {
  return EXPERIENCES[languageName] ?? ENGLISH;
}

export function hasLocalizedExperience(languageName: string): boolean {
  return languageName === "Tagalog" || languageName === "Spanish" || Boolean(EXPERIENCES[languageName]);
}
