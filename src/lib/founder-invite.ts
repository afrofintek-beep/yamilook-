const copy: Record<string, {
  greeting: (name: string) => string;
  introduction: string;
  profession: (value: string) => string;
  reason: (value: string) => string;
  feedback: string;
  placeholder: string;
  closing: string;
}> = {
  pt: {
    greeting: name => `Olá ${name || 'amigo(a)'},`,
    introduction: 'Gostaria de te convidar pessoalmente a conhecer a YAMILOOK, uma plataforma digital africana que estamos a desenvolver na AFROFINTEK.',
    profession: value => `A tua experiência em ${value} seria valiosa.`,
    reason: value => `Lembrei-me de ti porque ${value}.`,
    feedback: 'Estamos a testar o MVP e gostaria muito de ouvir as tuas impressões.',
    placeholder: '[Ligação individual — por gerar]',
    closing: 'Um abraço,',
  },
  en: {
    greeting: name => `Hello ${name || 'friend'},`,
    introduction: "I'd like to personally invite you to explore YAMILOOK, an African digital platform we're building at AFROFINTEK.",
    profession: value => `Your experience in ${value} would be valuable.`,
    reason: value => `I thought of you because ${value}.`,
    feedback: "We're testing our MVP and I'd appreciate your feedback.",
    placeholder: '[Personal invitation link — to be issued]',
    closing: 'Warm regards,',
  },
  fr: {
    greeting: name => `Bonjour ${name || 'mon ami(e)'},`,
    introduction: "Je souhaite t'inviter personnellement à découvrir YAMILOOK, une plateforme numérique africaine que nous développons chez AFROFINTEK.",
    profession: value => `Ton expérience dans le domaine ${value} serait précieuse.`,
    reason: value => `J'ai pensé à toi parce que ${value}.`,
    feedback: "Nous testons notre MVP et j'apprécierais beaucoup ton avis.",
    placeholder: '[Lien personnel à générer]',
    closing: 'Bien amicalement,',
  },
  ar: {
    greeting: name => `مرحبًا${name ? ' ' + name : ''}،`,
    introduction: 'أود أن أدعوك شخصيًا للتعرّف على YAMILOOK، وهي منصة رقمية أفريقية نطوّرها في AFROFINTEK.',
    profession: value => `خبرتك في مجال ${value} ستكون قيّمة بالنسبة إلينا.`,
    reason: value => `فكّرت في دعوتك لهذا السبب: ${value}.`,
    feedback: 'نختبر النسخة الأولية من المنصة ويسعدني أن أسمع رأيك.',
    placeholder: '[رابط الدعوة الشخصي قيد الإعداد]',
    closing: 'مع أطيب التحيات،',
  },
  am: {
    greeting: name => `ሰላም${name ? ' ' + name : ''}፣`,
    introduction: 'በAFROFINTEK እያዘጋጀነው ያለውን አፍሪካዊ ዲጂታል መድረክ YAMILOOKን እንዲያዩ በግሌ ልጋብዝዎ እፈልጋለሁ።',
    profession: value => `በ${value} ያለዎት ልምድ ለእኛ ጠቃሚ ይሆናል።`,
    reason: value => `የጋበዝኩዎት ምክንያት፦ ${value}።`,
    feedback: 'የመጀመሪያውን ስሪት እየሞከርን ነው፤ አስተያየትዎን መስማት ደስ ይለኛል።',
    placeholder: '[የግል የግብዣ አገናኝ ይዘጋጃል]',
    closing: 'ከሰላምታ ጋር፣',
  },
  sw: {
    greeting: name => `Habari ${name || 'rafiki'},`,
    introduction: 'Ningependa kukualika binafsi uifahamu YAMILOOK, jukwaa la kidijitali la Afrika tunalounda katika AFROFINTEK.',
    profession: value => `Uzoefu wako katika ${value} ungekuwa wa thamani kwetu.`,
    reason: value => `Nilifikiria kukualika kwa sababu hii: ${value}.`,
    feedback: 'Tunajaribu toleo letu la kwanza na ningependa kusikia maoni yako.',
    placeholder: '[Kiungo cha mwaliko binafsi bado hakijatolewa]',
    closing: 'Salamu za dhati,',
  },
  ln: {
    greeting: name => `Mbote ${name || 'moninga'},`,
    introduction: 'Nalingi kobengisa yo yo moko mpo oyeba YAMILOOK, plateforme numérique ya Afrika oyo tozali kosala na AFROFINTEK.',
    profession: value => `Mayele na yo na mosala ya ${value} ekosalisa biso mingi.`,
    reason: value => `Nakanisaki kobengisa yo mpo na ntina oyo: ${value}.`,
    feedback: 'Tozali komeka version na biso ya liboso mpe nakosepela koyoka makanisi na yo.',
    placeholder: '[Liyebisi ya kobengisama na yo ekobima]',
    closing: 'Na boboto nyonso,',
  },
  yo: {
    greeting: name => `Ẹ n lẹ́${name ? ' ' + name : ''},`,
    introduction: 'Mo fẹ́ pè yín fúnra mi láti mọ YAMILOOK, pẹpẹ oní-nọ́mbà ti Áfíríkà tí a ń kọ́ ní AFROFINTEK.',
    profession: value => `Ìrírí yín nípa ${value} yóò wúlò fún wa.`,
    reason: value => `Ìdí tí mo fi ronú láti pè yín ni pé: ${value}.`,
    feedback: 'A ń dán ẹ̀yà àkọ́kọ́ wa wò, inú mi yóò sì dùn láti gbọ́ èrò yín.',
    placeholder: '[Ọ̀nà àsopọ̀ ìpè ti ara yín ṣì ń bọ̀]',
    closing: 'Pẹ̀lú ọ̀wọ̀,',
  },
  sn: {
    greeting: name => `Mhoro ${name || 'shamwari'},`,
    introduction: 'Ndinoda kukukoka pachangu kuti uzive YAMILOOK, dandemutande remuAfrica ratiri kugadzira kuAFROFINTEK.',
    profession: value => `Ruzivo rwako mu${value} rungatibatsira zvikuru.`,
    reason: value => `Ndafunga kukukoka nechikonzero ichi: ${value}.`,
    feedback: 'Tiri kuyedza vhezheni yedu yekutanga uye ndingafarira kunzwa pfungwa dzako.',
    placeholder: '[Link yekukoka iwe pachako ichagadzirwa]',
    closing: 'Ndinokukwazisa,',
  },
  zu: {
    greeting: name => `Sawubona ${name || 'mngane'},`,
    introduction: 'Ngifisa ukukumema mathupha ukuba uhlole i-YAMILOOK, inkundla yedijithali yase-Afrika esiyakhayo kwa-AFROFINTEK.',
    profession: value => `Ulwazi lwakho emkhakheni we-${value} lungasisiza kakhulu.`,
    reason: value => `Ngicabange ukukumema ngalesi sizathu: ${value}.`,
    feedback: 'Sihlola inguqulo yethu yokuqala futhi ngingakujabulela ukuzwa umbono wakho.',
    placeholder: '[Isixhumanisi sakho sesimemo sisazolungiswa]',
    closing: 'Ngokuzithoba,',
  },
};

export type FounderInviteFields = { name: string; profession: string; reason: string; language: string; link?: string };

export function buildFounderInviteMessage({ name, profession, reason, language, link }: FounderInviteFields): string {
  const text = copy[language] ?? copy.pt;
  const body = [text.introduction];
  if (profession.trim()) body.push(text.profession(profession.trim()));
  if (reason.trim()) body.push(text.reason(reason.trim()));
  body.push(text.feedback);
  return [text.greeting(name.trim()), body.join(' '), link || text.placeholder, `${text.closing}\nAntónio H. da Silva`].join('\n\n');
}
