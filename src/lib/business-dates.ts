const translations = {
  pt: ['Em que ano começou a actividade do negócio?', 'Indica o ano em que começaste a vender ou a prestar serviços, mesmo que tenhas formalizado o negócio mais tarde.', 'Ainda não iniciei a actividade', 'Em actividade desde', 'Na Yamilook desde', 'Qual é a data de nascimento da pessoa responsável?'],
  en: ['What year did the business start operating?', 'Enter the year you started selling or providing services, even if you registered later.', 'I have not started operating yet', 'Operating since', 'On Yamilook since', 'When was the person managing the business born?'],
  fr: ['En quelle année votre activité a-t-elle commencé ?', 'Indiquez l’année des premières ventes ou prestations, même si l’immatriculation est plus récente.', 'Je n’ai pas encore commencé', 'En activité depuis', 'Sur Yamilook depuis', 'Quelle est la date de naissance de la personne responsable ?'],
  ar: ['في أي سنة بدأ النشاط التجاري؟', 'أدخل سنة بدء البيع أو تقديم الخدمات حتى لو سجّلت النشاط لاحقاً.', 'لم أبدأ النشاط بعد', 'يعمل منذ', 'على ياميلوك منذ', 'ما تاريخ ميلاد الشخص المسؤول؟'],
  am: ['ንግዱ በየትኛው ዓመት ጀመረ?', 'ምዝገባው ዘግይቶ ቢሆንም መሸጥ ወይም አገልግሎት መስጠት የጀመሩበትን የጎርጎርዮሳዊ ዓመት ያስገቡ።', 'እስካሁን አልጀመርኩም', 'የጀመረበት ዓመት', 'ያሚሉክን የተቀላቀለበት ዓመት', 'የኃላፊው የትውልድ ቀን መቼ ነው?'],
  sw: ['Biashara ilianza mwaka gani?', 'Weka mwaka ulipoanza kuuza au kutoa huduma, hata kama ulisajili biashara baadaye.', 'Bado sijaanza shughuli', 'Inafanya kazi tangu', 'Kwenye Yamilook tangu', 'Msimamizi alizaliwa lini?'],
  ln: ['Mombongo ebandaki na mobu nini?', 'Tyá mobu oyo obandaki kotɛka to kopesa misala, ata soki okomisaki mombongo na buku nsima.', 'Nabandi naino te', 'Mombongo ebandá na', 'Na Yamilook banda', 'Mokambi abotamaki mokolo nini?'],
  yo: ['Ọdún wo ni iṣẹ́ ọjà náà bẹ̀rẹ̀?', 'Tẹ ọdún tí o bẹ̀rẹ̀ sí í tà tàbí ṣe iṣẹ́ fún àwọn oníbàárà, kódà bí o ṣe forúkọ rẹ̀ sílẹ̀ lẹ́yìn náà.', 'Mi ò tíì bẹ̀rẹ̀ iṣẹ́', 'Ó ti ń ṣiṣẹ́ láti', 'Lórí Yamilook láti', 'Ìgbà wo ni wọ́n bí ẹni tó ń ṣàkóso iṣẹ́ náà?'],
  sn: ['Bhizimisi rakatanga mugore ripi?', 'Isa gore rawakatanga kutengesa kana kupa masevhisi, kunyange wakazonyoresa gare gare.', 'Handisati ndatanga', 'Riri kushanda kubva muna', 'PaYamilook kubva muna', 'Munhu anotarisira bhizimisi akaberekwa riini?'],
  zu: ['Ibhizinisi laqala ngamuphi unyaka?', 'Faka unyaka owaqala ngawo ukuthengisa noma ukuhlinzeka ngezinsizakalo, noma walibhalisa kamuva.', 'Angikaqali ukusebenza', 'Lisebenza kusukela ngo', 'Ku-Yamilook kusukela ngo', 'Wazalwa nini umuntu ophethe ibhizinisi?'],
};

export function businessDates(language: string) {
  const [question, hint, planned, operatingSince, memberSince, ownerBirthday] =
    translations[language.split(/[-_]/)[0] as keyof typeof translations] ?? translations.pt;
  return { question, hint, planned, operatingSince, memberSince, ownerBirthday };
}

export function validStartYear(year: string) {
  return /^[1-9][0-9]{3}$/.test(year) && Number(year) <= new Date().getFullYear();
}
