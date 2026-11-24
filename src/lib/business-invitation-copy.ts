const copy = {
  pt: ['Pedir convite', 'Nome da pessoa responsável', 'Email para receber o convite', 'Enviar pedido de convite', 'Pedido recebido. Se for aprovado, receberás o convite por email.', 'Não foi possível concluir. Tenta novamente.', 'Retomar rascunho', 'Tenho um convite'],
  en: ['Request an invitation', 'Name of the person responsible', 'Email for the invitation', 'Submit invitation request', 'Request received. If approved, you will receive an invitation by email.', 'Could not complete this. Please try again.', 'Resume draft', 'I have an invitation'],
  fr: ['Demander une invitation', 'Nom du responsable', 'Email de réception', 'Envoyer la demande', 'Demande reçue. Si elle est approuvée, vous recevrez une invitation par email.', 'Impossible de terminer. Réessayez.', 'Reprendre le brouillon', 'J’ai une invitation'],
  ar: ['طلب دعوة','اسم المسؤول','البريد الإلكتروني للدعوة','إرسال طلب الدعوة','تم استلام الطلب. ستصلك الدعوة عبر البريد الإلكتروني في حال الموافقة.','تعذّر الإكمال. حاول مجدداً.','استئناف المسودة','لدي دعوة'],
  am: ['ግብዣ ይጠይቁ','የኃላፊው ስም','ግብዣው የሚላክበት ኢሜይል','ጥያቄውን ይላኩ','ጥያቄዎ ደርሷል። ሲፈቀድ ግብዣውን በኢሜይል ያገኛሉ።','አልተሳካም። እንደገና ይሞክሩ።','ረቂቁን ይቀጥሉ','ግብዣ አለኝ'],
  sw: ['Omba mwaliko','Jina la msimamizi','Barua pepe ya kupokea mwaliko','Tuma ombi','Ombi limepokelewa. Likiidhinishwa utapokea mwaliko kwa barua pepe.','Imeshindikana. Jaribu tena.','Endelea na rasimu','Nina mwaliko'],
  ln: ['Sɛngá libyangi','Nkombo ya mokambi','Email mpo na libyangi','Tindá bosɛngi','Tozwi bosɛngi. Soki endimami, okozwa libyangi na email.','Esimbi te. Meká lisusu.','Kobá na lokasa obandaki','Nazali na libyangi'],
  yo: ['Béèrè ìkésíni','Orúkọ alábòójútó','Ímeèlì fún ìkésíni','Fi ìbéèrè ránṣẹ́','A ti gba ìbéèrè rẹ. Bí a bá fọwọ́ sí i, ìkésíni yóò dé nípasẹ̀ ímeèlì.','Ó kùnà. Tún gbìyànjú.','Tẹ̀síwájú pẹ̀lú àkọsílẹ̀','Mo ní ìkésíni'],
  sn: ['Kumbira kukokwa','Zita remutariri','Email yekugamuchira kukokwa','Tumira chikumbiro','Chikumbiro chagamuchirwa. Kana chabvumidzwa uchakokwa neemail.','Hazvina kubudirira. Edza zvakare.','Enderera pawakagumira','Ndine kokero'],
  zu: ['Cela isimemo','Igama lomuntu ophethe','I-imeyili yokwamukela isimemo','Thumela isicelo','Isicelo samukelwe. Uma sivunyiwe uzothola isimemo nge-imeyili.','Akuqedekanga. Zama futhi.','Qhubeka nokusalungiswa','Nginesimemo'],
};
export function businessInvitationCopy(language: string) {
  const key = language.split(/[-_]/)[0] as keyof typeof copy;
  const [request, owner, email, submit, received, retry, resume, haveInvite] = copy[key] ?? copy.pt;
  return { request, owner, email, submit, received, retry, resume, haveInvite, language: copy[key] ? key : 'pt' };
}
