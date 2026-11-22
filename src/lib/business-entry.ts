const cities = {
  pt: ['Luanda', 'luanda'], en: ['Accra', 'accra'], fr: ['Abidjan', 'abidjan'],
  ar: ['القاهرة', 'cairo'], am: ['አዲስ አበባ', 'addis'], sw: ['Dar es Salaam', 'dar'],
  ln: ['Kinshasa', 'kinshasa'], yo: ['Ibadan', 'ibadan'], sn: ['Harare', 'harare'], zu: ['Durban', 'durban'],
};
export const scenes = Object.values(cities);
export function initialScene(language: string) {
  return cities[language.split(/[-_]/)[0] as keyof typeof cities]?.[1] ?? 'luanda';
}
const copy = {
  pt: ['Exemplo regional','Nome do negócio','Actividade principal','Conta da pessoa responsável','Ano de início (opcional)','No estabelecimento','Ao domicílio','Entregas','Online','Rever página','Publicar página'],
  en: ['Regional example','Business name','Main activity','Business owner’s account','Starting year (optional)','On premises','At customers’ homes','Delivery','Online','Review page','Publish page'],
  fr: ['Exemple régional','Nom du commerce','Activité principale','Compte du responsable','Année de début (facultatif)','Sur place','À domicile','Livraison','En ligne','Vérifier la page','Publier la page'],
  ar: ['مثال من المنطقة','اسم النشاط التجاري','النشاط الرئيسي','حساب الشخص المسؤول','سنة البدء (اختياري)','في المحل','في منزل العميل','توصيل','عبر الإنترنت','مراجعة الصفحة','نشر الصفحة'],
  am: ['የአካባቢ ምሳሌ','የንግድ ስም','ዋና ተግባር','የኃላፊው መለያ','የተጀመረበት ዓመት (አማራጭ)','በሱቅ','በደንበኛው ቤት','ማድረስ','በመስመር ላይ','ገጹን ይመልከቱ','ገጹን ያትሙ'],
  sw: ['Mfano wa eneo','Jina la biashara','Shughuli kuu','Akaunti ya msimamizi','Mwaka wa kuanza (si lazima)','Dukani','Nyumbani kwa mteja','Usafirishaji','Mtandaoni','Hakiki ukurasa','Chapisha ukurasa'],
  ln: ['Ndakisa ya etúká','Nkombo ya mombongo','Mosala ya liboso','Konti ya mokambi','Mobu ya ebandeli (soki olingi)','Na esika ya mosala','Na ndako ya kiliya','Kotinda biloko','Na internet','Talá lokasa','Bimisá lokasa'],
  yo: ['Àpẹẹrẹ agbègbè','Orúkọ iṣẹ́ ọjà','Iṣẹ́ pàtàkì','Àkọọ́lẹ̀ alábòójútó','Ọdún ìbẹ̀rẹ̀ (bí o bá fẹ́)','Ní ṣọ́ọ̀bù','Ní ilé oníbàárà','Ìfijiṣẹ́','Lórí ayélujára','Ṣàyẹ̀wò ojú ìwé','Ṣe àtẹ̀jáde ojú ìwé'],
  sn: ['Muenzaniso wedunhu','Zita rebhizimisi','Basa guru','Akaundi yemutariri','Gore rekutanga (kana uchida)','Panzvimbo yebasa','Kumba kwemutengi','Kuendesa zvinhu','Padandemutande','Ongorora peji','Budisa peji'],
  zu: ['Isibonelo sesifunda','Igama lebhizinisi','Umsebenzi oyinhloko','I-akhawunti yomphathi','Unyaka wokuqala (uyazikhethela)','Esitolo','Ekhaya lekhasimende','Ukudiliva','Ku-inthanethi','Buyekeza ikhasi','Shicilela ikhasi'],
};
export function businessCopy(language: string) {
  const [region,name,activity,owner,year,shop,home,delivery,online,review,publish] = copy[language.split(/[-_]/)[0] as keyof typeof copy] ?? copy.pt;
  return {region,name,activity,owner,year,shop,home,delivery,online,review,publish};
}
const key = 'yl-business-entry-v1';
export function readEntry() {
  try {
    const data = JSON.parse(sessionStorage.getItem(key) ?? '{}');
    return { name: String(data.name ?? ''), activity: String(data.activity ?? ''), scene: scenes.find(([,id]) => id === data.scene)?.[1] };
  } catch { return { name: '', activity: '', scene: undefined }; }
}
export function saveEntry(name: string, activity: string, scene: string) {
  try { sessionStorage.setItem(key, JSON.stringify({name,activity,scene})); } catch { /* Browser storage may be unavailable. */ }
}
export function clearEntry() { try { sessionStorage.removeItem(key); } catch { /* Storage unavailable. */ } }
