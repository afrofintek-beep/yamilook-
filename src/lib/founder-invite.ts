export type FounderInviteLanguage = 'pt' | 'en' | 'fr';
export type FounderInviteFields = { name: string; profession: string; reason: string; language: FounderInviteLanguage; link?: string };
export function buildFounderInviteMessage({name, profession, reason, language, link}: FounderInviteFields): string {
  const firstName = name.trim() || (language === 'en' ? 'friend' : language === 'fr' ? 'mon ami(e)' : 'amigo(a)');
  const professionText = profession.trim();
  const reasonText = reason.trim();
  if (language === 'en') return `Hello ${firstName},\n\nI'd like to personally invite you to explore YAMILOOK, an African digital platform we're building at AFROFINTEK. ${professionText ? `Your experience in ${professionText} would be valuable. ` : ''}${reasonText ? `I thought of you because ${reasonText}. ` : ''}We're testing our MVP and I'd appreciate your feedback.\n\n${link || '[Personal invitation link — to be issued]'}\n\nWarm regards,\nAntónio H. da Silva`;
  if (language === 'fr') return `Bonjour ${firstName},\n\nJe souhaite t'inviter personnellement à découvrir YAMILOOK, une plateforme numérique africaine que nous développons chez AFROFINTEK. ${professionText ? `Ton expérience dans le domaine ${professionText} serait précieuse. ` : ''}${reasonText ? `J'ai pensé à toi parce que ${reasonText}. ` : ''}Nous testons notre MVP et j'apprécierais beaucoup ton avis.\n\n${link || '[Lien personnel à générer]'}\n\nBien amicalement,\nAntónio H. da Silva`;
  return `Olá ${firstName},\n\nGostaria de te convidar pessoalmente a conhecer a YAMILOOK, uma plataforma digital africana que estamos a desenvolver na AFROFINTEK. ${professionText ? `A tua experiência em ${professionText} seria valiosa. ` : ''}${reasonText ? `Lembrei-me de ti porque ${reasonText}. ` : ''}Estamos a testar o MVP e gostaria muito de ouvir as tuas impressões.\n\n${link || '[Ligação individual — por gerar]'}\n\nUm abraço,\nAntónio H. da Silva`;
}
