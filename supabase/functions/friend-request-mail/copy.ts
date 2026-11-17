// Transactional friend-request copy; no private profile data or message body in email.
const copy: Record<string, string[]> = {
 pt: ['Pedido de amizade na Yamilook', '{{name}} enviou-te um pedido de amizade.', 'Abre a Yamilook para aceitar ou recusar o pedido.', 'Ver pedido', 'Podes desactivar estes e-mails nas definições de notificações da Yamilook.'],
 en: ['Friend request on Yamilook', '{{name}} sent you a friend request.', 'Open Yamilook to accept or decline the request.', 'View request', 'You can turn off these emails in your Yamilook notification settings.'],
 fr: ['Demande d’amitié sur Yamilook', '{{name}} vous a envoyé une demande d’amitié.', 'Ouvrez Yamilook pour accepter ou refuser la demande.', 'Voir la demande', 'Vous pouvez désactiver ces e-mails dans les paramètres de notification de Yamilook.'],
 ar: ['طلب صداقة على Yamilook', 'أرسل إليك {{name}} طلب صداقة.', 'افتح Yamilook لقبول الطلب أو رفضه.', 'عرض الطلب', 'يمكنك إيقاف هذه الرسائل في إعدادات الإشعارات في Yamilook.'],
 am: ['በYamilook የጓደኝነት ጥያቄ', '{{name}} የጓደኝነት ጥያቄ ልኮልዎታል።', 'ጥያቄውን ለመቀበል ወይም ላለመቀበል Yamilookን ይክፈቱ።', 'ጥያቄውን ይመልከቱ', 'እነዚህን ኢሜይሎች በYamilook የማሳወቂያ ቅንብሮች ውስጥ ማጥፋት ይችላሉ።'],
 sw: ['Ombi la urafiki kwenye Yamilook', '{{name}} amekutumia ombi la urafiki.', 'Fungua Yamilook ili kukubali au kukataa ombi.', 'Angalia ombi', 'Unaweza kuzima barua pepe hizi katika mipangilio ya arifa ya Yamilook.'],
 ln: ['Bosengi ya boninga na Yamilook', '{{name}} atindeli yo bosengi ya boninga.', 'Fungola Yamilook mpo na kondima to koboya bosengi.', 'Tala bosengi', 'Okoki kokanga ba email oyo na paramètres ya mayebisi ya Yamilook.'],
 yo: ['Ìbéèrè ọ̀rẹ́ lórí Yamilook', '{{name}} fi ìbéèrè ọ̀rẹ́ ránṣẹ́ sí ọ.', 'Ṣí Yamilook láti gba tàbí kọ ìbéèrè náà.', 'Wo ìbéèrè', 'O lè pa àwọn ímeèlì wọ̀nyí nínú ètò ìfitónilétí Yamilook.'],
 sn: ['Chikumbiro cheushamwari paYamilook', '{{name}} akutumira chikumbiro cheushamwari.', 'Vhura Yamilook kuti ugamuchire kana kuramba chikumbiro.', 'Ona chikumbiro', 'Unogona kudzima maemail aya muzvirongwa zvezviziviso zveYamilook.'],
 zu: ['Isicelo sobungani ku-Yamilook', '{{name}} ukuthumelele isicelo sobungani.', 'Vula i-Yamilook ukuze wamukele noma wenqabe isicelo.', 'Buka isicelo', 'Ungavala la ma-imeyili kuzilungiselelo zezaziso ze-Yamilook.'],
};
const escape = (s: string) => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function friendRequestEmail(id: string, name: string, locale: string) {
 const language = locale?.toLowerCase().split(/[-_]/)[0];
 const lang = Object.hasOwn(copy,language) ? language : 'pt';
 const [subject,template,explanation,button,footer] = copy[lang];
 const description = template.replace('{{name}}', name.replace(/[\r\n]/g,' ').slice(0,100));
 const url = `https://www.yamilook.com/notifications?request=${encodeURIComponent(id)}`;
 return {subject,text:[description,explanation,`${button}: ${url}`,footer].join('\n\n'),
 html:`<!doctype html><html lang="${lang}" dir="${lang==='ar'?'rtl':'ltr'}"><body style="background:#111114;color:#f7f7fa;font-family:Arial,sans-serif;padding:24px"><div style="max-width:520px;margin:auto;padding:24px;border:1px solid #34343b;border-radius:18px"><h2 style="color:#d7ae34">YAMILOOK</h2><h1 style="font-size:22px">${escape(subject)}</h1><p>${escape(description)}</p><p>${escape(explanation)}</p><p style="margin:32px 0"><a href="${escape(url)}" style="display:inline-block;background:#d7ae34;color:#111;padding:14px 22px;border-radius:24px;text-decoration:none;font-weight:bold">${escape(button)}</a></p><p style="font-size:12px;color:#bbb">${escape(footer)}</p></div></body></html>`};
}
