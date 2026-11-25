import { adminAreaKeys, type AdminArea } from './catalog';
const extraTranslations = {
  ar: ['الحملات والدعوات','الدعوات الموثوقة','طلبات منشئي المحتوى','تحقيق الدخل','عناوين المجتمع','شهادات AFROLOC','المدفوعات','الأدوات التقنية','مجالات الإدارة','يسمح هذا الإذن بتنفيذ العمليات الإدارية في هذا المجال.','أكّد إنشاء بيانات الاختبار أو تحديثها.','تأكيد','إلغاء'],
  am: ['ዘመቻዎች እና ግብዣዎች','የታመኑ ግብዣዎች','የፈጣሪዎች ማመልከቻዎች','ገቢ ማግኘት','የማህበረሰብ አድራሻዎች','የAFROLOC ማረጋገጫዎች','ክፍያዎች','ቴክኒካዊ መሣሪያዎች','የአስተዳደር ዘርፎች','ይህ ፈቃድ በዚህ ዘርፍ የአስተዳደር ሥራዎችን ይፈቅዳል።','የሙከራ ውሂብ መፍጠር ወይም ማዘመንን ያረጋግጡ።','አረጋግጥ','ሰርዝ'],
};
const translations: Record<string, string[]> = { ...extraTranslations,
  "pt": [
    "Campanhas e convites",
    "Convites de confiança",
    "Candidaturas de criador",
    "Monetização",
    "Endereços da comunidade",
    "Certificações AFROLOC",
    "Pagamentos",
    "Ferramentas técnicas",
    "Áreas de gestão",
    "Esta permissão autoriza operações administrativas nesta área.",
    "Confirma a criação ou actualização dos dados de teste.",
    "Confirmar",
    "Cancelar"
  ],
  "en": [
    "Campaigns and invitations",
    "Trusted invitations",
    "Creator applications",
    "Monetization",
    "Community addresses",
    "AFROLOC certifications",
    "Payments",
    "Technical tools",
    "Management areas",
    "This permission authorizes administrative operations in this area.",
    "Confirm creating or updating test data.",
    "Confirm",
    "Cancel"
  ],
  "fr": [
    "Campagnes et invitations",
    "Invitations de confiance",
    "Candidatures de créateurs",
    "Monétisation",
    "Adresses de la communauté",
    "Certifications AFROLOC",
    "Paiements",
    "Outils techniques",
    "Espaces de gestion",
    "Cette permission autorise les opérations administratives dans cet espace.",
    "Confirmez la création ou la mise à jour des données de test.",
    "Confirmer",
    "Annuler"
  ],
  "sw": [
    "Kampeni na mialiko",
    "Mialiko ya kuaminika",
    "Maombi ya watayarishi",
    "Uchumaji wa mapato",
    "Anwani za jamii",
    "Vyeti vya AFROLOC",
    "Malipo",
    "Zana za kiufundi",
    "Maeneo ya usimamizi",
    "Ruhusa hii inaruhusu shughuli za usimamizi katika eneo hili.",
    "Thibitisha kuunda au kusasisha data za majaribio.",
    "Thibitisha",
    "Ghairi"
  ],
  "ln": [
    "Bakampanye mpe mabengisi",
    "Mabengisi ya bondimi",
    "Masengi ya bakeli",
    "Kozwa mbongo",
    "Baadrɛsi ya lisanga",
    "Bandimisi AFROLOC",
    "Bofuti",
    "Bisaleli ya tekiniki",
    "Bisika ya boyangeli",
    "Ndingisa oyo epesi nzela ya kosala misala ya boyangeli na esika oyo.",
    "Ndima kokela to kobongisa badonnée ya komeka.",
    "Ndima",
    "Longola"
  ],
  "yo": [
    "Ìpolongo àti ìkésíni",
    "Ìkésíni ìgbẹ́kẹ̀lé",
    "Ìbéèrè àwọn ẹlẹ́dàá",
    "Gbígba owó",
    "Àdírẹ́sì àwùjọ",
    "Ìjẹ́rìísí AFROLOC",
    "Ìsanwó",
    "Àwọn irinṣẹ́ ẹ̀rọ",
    "Àwọn ẹ̀ka ìṣàkóso",
    "Àṣẹ yìí gba àwọn iṣẹ́ ìṣàkóso láàyè ní ẹ̀ka yìí.",
    "Jẹ́rìí sí ṣíṣe tàbí àtúnṣe dátà ìdánwò.",
    "Jẹ́rìí",
    "Fagilé"
  ],
  "zu": [
    "Imikhankaso nezimemo",
    "Izimemo ezethembekile",
    "Izicelo zabadali",
    "Ukwenza imali",
    "Amakheli omphakathi",
    "Izitifiketi ze-AFROLOC",
    "Izinkokhelo",
    "Amathuluzi ezobuchwepheshe",
    "Izindawo zokuphatha",
    "Le mvume ivumela imisebenzi yokuphatha kule ndawo.",
    "Qinisekisa ukudala noma ukubuyekeza idatha yokuhlola.",
    "Qinisekisa",
    "Khansela"
  ],
  "sn": [
    "Mishandirapamwe nekukoka",
    "Kukoka kwekuvimbana",
    "Zvikumbiro zvevagadziri",
    "Kuwana mari",
    "Kero dzenharaunda",
    "Zvitupa zveAFROLOC",
    "Kubhadhara",
    "Zvishandiso zvehunyanzvi",
    "Nzvimbo dzekutonga",
    "Mvumo iyi inobvumira mabasa ekutonga munzvimbo iyi.",
    "Simbisa kugadzira kana kugadzirisa data rekuyedza.",
    "Simbisa",
    "Kanzura"
  ]
};
export function adminAreaCopy(locale: string) {
  const values = translations[locale.split('-')[0]] || translations.pt;
  return {
    labels: Object.fromEntries(adminAreaKeys.map((key, index) => [key, values[index]])) as Record<AdminArea, string>,
    title: values[8], permissionHint: values[9], confirmSeed: values[10], confirm: values[11], cancel: values[12],
  };
}
