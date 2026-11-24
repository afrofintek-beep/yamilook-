import { trustedInviteLanguage, type TrustedInviteLanguage } from './api';

const pt = {
  title: 'Convites de confiança',
  description: 'Autorize a entrada de uma pessoa conhecida sem confirmação de e-mail. Cada convite permite uma única activação.',
  direct: 'Entrada directa',
  directHint: 'Partilhe pessoalmente. Quem tiver o link poderá utilizá-lo antes do destinatário.',
  phone: 'Confirmar telefone',
  phoneHint: 'A activação exige o código SMS enviado ao número que indicar.',
  smsUnavailable: 'A confirmação por SMS está indisponível. Pode emitir um convite de entrada directa.',
  smsChecking: 'A verificar a disponibilidade de SMS…',
  recipient: 'Nome da pessoa convidada',
  recipientPlaceholder: 'Nome completo',
  phoneNumber: 'Telefone da pessoa convidada',
  language: 'Idioma do convite',
  validity: 'Prazo para activar',
  hours: 'horas',
  issue: 'Criar convite de confiança',
  issuing: 'A criar convite…',
  issued: 'Convite criado. Copie o link ou apresente o QR à pessoa convidada.',
  forRecipient: 'Convite para',
  expires: 'Activar até',
  expiryHint: 'Este prazo aplica-se ao convite. A conta continua activa depois da inscrição.',
  link: 'Link individual',
  codeOrLink: 'Código ou link do convite',
  useTrusted: 'Usar um convite de confiança',
  copyLink: 'Copiar link',
  copyMessage: 'Copiar mensagem',
  whatsapp: 'Partilhar pelo WhatsApp',
  copied: 'Copiado. Partilhe pessoalmente com a pessoa convidada.',
  copyFailed: 'Seleccione o link e copie-o manualmente.',
  recent: 'Convites recentes',
  refresh: 'Actualizar',
  loading: 'A carregar…',
  noInvites: 'Ainda não foram emitidos convites de confiança.',
  listError: 'Não foi possível carregar os convites. Tente actualizar.',
  cancel: 'Cancelar convite',
  cancelled: 'Convite cancelado.',
  pending: 'Pendente',
  used: 'Utilizado',
  expired: 'Expirado',
  revoked: 'Cancelado',
  privateLink: 'Guarde o link quando o emitir. Só a pessoa que o receber deve utilizá-lo.',
  ordinaryHint: 'Para uma pessoa conhecida entrar sem confirmar o e-mail, utilize Convites de confiança.',
  openTrusted: 'Abrir convites de confiança',
  welcome: 'O seu acesso foi pré-aprovado',
  invitedBy: 'Convidado por',
  welcomeHint: 'Configure o seu acesso pessoal para activar a conta Yamilook.',
  noEmail: 'Não precisa de confirmar um e-mail para activar esta conta.',
  displayName: 'O seu nome',
  username: 'Nome de utilizador',
  usernameHint: '3 a 20 caracteres: letras, números e _. Comece com uma letra ou número.',
  password: 'Palavra-passe',
  passwordHint: 'Pelo menos 12 caracteres, com maiúscula, minúscula e número.',
  showPassword: 'Mostrar palavra-passe',
  hidePassword: 'Ocultar palavra-passe',
  termsBefore: 'Aceito os',
  terms: 'Termos de utilização',
  termsAnd: 'e li a',
  privacy: 'Política de privacidade',
  activate: 'Activar a minha conta',
  activating: 'A activar a conta…',
  otpDestination: 'Enviaremos o código para',
  requestOtp: 'Pedir código por SMS',
  requestAgain: 'Pedir novo código',
  otp: 'Código recebido por SMS',
  otpSent: 'Pedido de SMS aceite. Introduza o código recebido.',
  wait: 'Aguarde',
  seconds: 'segundos',
  activated: 'Conta activada',
  recoveryTitle: 'Guarde o seu código de recuperação',
  recoveryHint: 'Este código permite recuperar o acesso se esquecer a palavra-passe. Guarde-o num local seguro e privado.',
  recoveryCode: 'Código de recuperação',
  copyRecovery: 'Copiar código de recuperação',
  recoveryCopied: 'Código de recuperação copiado.',
  savedRecovery: 'Guardei o meu código de recuperação.',
  continue: 'Continuar para o meu perfil',
  signIn: 'Entrar na minha conta',
  sessionFailed: 'A conta foi criada. Utilize o seu nome de utilizador e palavra-passe para entrar.',
  existingSession: 'Já tem uma sessão iniciada. Este convite cria uma nova conta; continue na sua conta actual.',
  existingAccount: 'Já tem conta?',
  invitationUnavailable: 'Este convite não está disponível. Pode ter expirado, sido utilizado ou cancelado. Peça um novo convite ao responsável.',
  invalidToken: 'Cole o link completo que recebeu ou o código individual do convite.',
  checkCode: 'Verificar convite',
  retry: 'Tentar novamente',
  error: 'Não foi possível concluir. Verifique os dados e tente novamente.',
  invalidFields: 'Verifique o nome, o nome de utilizador, a palavra-passe e a aceitação dos termos.',
  invalidPhone: 'Indique um telefone válido, com o indicativo do país.',
  usernameTaken: 'Este nome de utilizador já está em uso. Escolha outro.',
  invalidOtp: 'O código SMS está incorrecto ou expirou. Verifique-o ou peça um novo código.',
  rateLimited: 'Aguarde antes de tentar novamente.',
  forbidden: 'Apenas administradores podem gerir estes convites.',
};

type Copy = { [K in keyof typeof pt]: string };
const en: Copy = {
  title: 'Trusted invitations', description: 'Approve access for someone you know without email confirmation. Each invitation can activate one account.',
  direct: 'Direct access', directHint: 'Share personally. Anyone with the link can use it before the intended recipient.',
  phone: 'Confirm phone', phoneHint: 'Activation requires the SMS code sent to the phone number you provide.',
  smsUnavailable: 'SMS confirmation is unavailable. You can issue a direct access invitation.', smsChecking: 'Checking SMS availability…',
  recipient: 'Invitee name', recipientPlaceholder: 'Full name', phoneNumber: 'Invitee phone number', language: 'Invitation language', validity: 'Activation deadline', hours: 'hours',
  issue: 'Create trusted invitation', issuing: 'Creating invitation…', issued: 'Invitation created. Copy the link or show the QR code to your invitee.', forRecipient: 'Invitation for', expires: 'Activate by', expiryHint: 'This deadline applies to the invitation. The account stays active after registration.',
  link: 'Individual link', codeOrLink: 'Invitation code or link', useTrusted: 'Use a trusted invitation', copyLink: 'Copy link', copyMessage: 'Copy message', whatsapp: 'Share via WhatsApp', copied: 'Copied. Share personally with your invitee.', copyFailed: 'Select the link and copy it manually.',
  recent: 'Recent invitations', refresh: 'Refresh', loading: 'Loading…', noInvites: 'No trusted invitations have been issued yet.', listError: 'Unable to load invitations. Try refreshing.', cancel: 'Cancel invitation', cancelled: 'Invitation cancelled.',
  pending: 'Pending', used: 'Used', expired: 'Expired', revoked: 'Cancelled', privateLink: 'Save the link when you issue it. Only the person receiving it should use it.', ordinaryHint: 'To let someone you know join without confirming an email, use Trusted invitations.', openTrusted: 'Open trusted invitations',
  welcome: 'Your access has been pre-approved', invitedBy: 'Invited by', welcomeHint: 'Set up your personal sign-in to activate your Yamilook account.', noEmail: 'You do not need to confirm an email to activate this account.',
  displayName: 'Your name', username: 'Username', usernameHint: '3–20 characters: letters, numbers and _. Start with a letter or number.', password: 'Password', passwordHint: 'At least 12 characters, with an uppercase letter, lowercase letter and number.', showPassword: 'Show password', hidePassword: 'Hide password',
  termsBefore: 'I accept the', terms: 'Terms of use', termsAnd: 'and have read the', privacy: 'Privacy policy', activate: 'Activate my account', activating: 'Activating account…',
  otpDestination: 'We will send the code to', requestOtp: 'Request SMS code', requestAgain: 'Request a new code', otp: 'SMS verification code', otpSent: 'SMS request accepted. Enter the code you receive.', wait: 'Wait', seconds: 'seconds',
  activated: 'Account activated', recoveryTitle: 'Save your recovery code', recoveryHint: 'This code lets you recover access if you forget your password. Keep it somewhere safe and private.', recoveryCode: 'Recovery code', copyRecovery: 'Copy recovery code', recoveryCopied: 'Recovery code copied.', savedRecovery: 'I have saved my recovery code.', continue: 'Continue to my profile', signIn: 'Sign in to my account',
  sessionFailed: 'Your account was created. Use your username and password to sign in.', existingSession: 'You are already signed in. This invitation creates a new account; continue with your current account.', existingAccount: 'Already have an account?',
  invitationUnavailable: 'This invitation is unavailable. It may have expired, been used or cancelled. Ask the person who invited you for a new one.', invalidToken: 'Paste the full link you received or your individual invitation code.', checkCode: 'Check invitation', retry: 'Try again',
  error: 'Unable to complete. Check the details and try again.', invalidFields: 'Check your name, username, password and acceptance of the terms.', invalidPhone: 'Enter a valid phone number with the country code.', usernameTaken: 'This username is already in use. Choose another.', invalidOtp: 'The SMS code is incorrect or expired. Check it or request a new code.', rateLimited: 'Wait before trying again.', forbidden: 'Only administrators can manage these invitations.',
};
const fr: Copy = {
  title: 'Invitations de confiance', description: 'Autorisez une personne que vous connaissez à entrer sans confirmation par e-mail. Chaque invitation permet une seule activation.',
  direct: 'Accès direct', directHint: 'Partagez personnellement. Toute personne qui possède le lien peut l’utiliser avant son destinataire.', phone: 'Confirmer le téléphone', phoneHint: 'L’activation nécessite le code SMS envoyé au numéro indiqué.',
  smsUnavailable: 'La confirmation par SMS est indisponible. Vous pouvez créer une invitation avec accès direct.', smsChecking: 'Vérification de la disponibilité des SMS…', recipient: 'Nom de la personne invitée', recipientPlaceholder: 'Nom complet', phoneNumber: 'Téléphone de la personne invitée', language: 'Langue de l’invitation', validity: 'Délai d’activation', hours: 'heures',
  issue: 'Créer une invitation de confiance', issuing: 'Création de l’invitation…', issued: 'Invitation créée. Copiez le lien ou présentez le QR à la personne invitée.', forRecipient: 'Invitation pour', expires: 'À activer avant le', expiryHint: 'Ce délai concerne l’invitation. Le compte reste actif après l’inscription.', link: 'Lien individuel', codeOrLink: 'Code ou lien d’invitation', useTrusted: 'Utiliser une invitation de confiance', copyLink: 'Copier le lien', copyMessage: 'Copier le message', whatsapp: 'Partager sur WhatsApp', copied: 'Copié. Partagez personnellement avec la personne invitée.', copyFailed: 'Sélectionnez le lien et copiez-le manuellement.',
  recent: 'Invitations récentes', refresh: 'Actualiser', loading: 'Chargement…', noInvites: 'Aucune invitation de confiance n’a encore été créée.', listError: 'Impossible de charger les invitations. Essayez d’actualiser.', cancel: 'Annuler l’invitation', cancelled: 'Invitation annulée.', pending: 'En attente', used: 'Utilisée', expired: 'Expirée', revoked: 'Annulée', privateLink: 'Conservez le lien lors de sa création. Seule la personne qui le reçoit doit l’utiliser.', ordinaryHint: 'Pour permettre à une personne connue d’entrer sans confirmer son e-mail, utilisez les Invitations de confiance.', openTrusted: 'Ouvrir les invitations de confiance',
  welcome: 'Votre accès a été préapprouvé', invitedBy: 'Invité par', welcomeHint: 'Configurez votre accès personnel pour activer votre compte Yamilook.', noEmail: 'Vous n’avez pas besoin de confirmer un e-mail pour activer ce compte.', displayName: 'Votre nom', username: 'Nom d’utilisateur', usernameHint: '3 à 20 caractères : lettres, chiffres et _. Commencez par une lettre ou un chiffre.', password: 'Mot de passe', passwordHint: 'Au moins 12 caractères, avec une majuscule, une minuscule et un chiffre.', showPassword: 'Afficher le mot de passe', hidePassword: 'Masquer le mot de passe', termsBefore: 'J’accepte les', terms: 'Conditions d’utilisation', termsAnd: 'et j’ai lu la', privacy: 'Politique de confidentialité', activate: 'Activer mon compte', activating: 'Activation du compte…',
  otpDestination: 'Nous enverrons le code au', requestOtp: 'Demander le code par SMS', requestAgain: 'Demander un nouveau code', otp: 'Code reçu par SMS', otpSent: 'Demande de SMS acceptée. Saisissez le code reçu.', wait: 'Veuillez patienter', seconds: 'secondes', activated: 'Compte activé', recoveryTitle: 'Conservez votre code de récupération', recoveryHint: 'Ce code permet de récupérer votre accès si vous oubliez votre mot de passe. Conservez-le dans un endroit sûr et privé.', recoveryCode: 'Code de récupération', copyRecovery: 'Copier le code de récupération', recoveryCopied: 'Code de récupération copié.', savedRecovery: 'J’ai conservé mon code de récupération.', continue: 'Continuer vers mon profil', signIn: 'Me connecter', sessionFailed: 'Votre compte a été créé. Connectez-vous avec votre nom d’utilisateur et votre mot de passe.', existingSession: 'Vous êtes déjà connecté. Cette invitation crée un nouveau compte ; continuez avec votre compte actuel.', existingAccount: 'Vous avez déjà un compte ?',
  invitationUnavailable: 'Cette invitation est indisponible. Elle peut avoir expiré, été utilisée ou annulée. Demandez une nouvelle invitation à son émetteur.', invalidToken: 'Collez le lien complet reçu ou le code individuel de votre invitation.', checkCode: 'Vérifier l’invitation', retry: 'Réessayer', error: 'Impossible de terminer. Vérifiez les informations et réessayez.', invalidFields: 'Vérifiez votre nom, votre identifiant, votre mot de passe et l’acceptation des conditions.', invalidPhone: 'Indiquez un numéro valide avec l’indicatif du pays.', usernameTaken: 'Ce nom d’utilisateur est déjà utilisé. Choisissez-en un autre.', invalidOtp: 'Le code SMS est incorrect ou a expiré. Vérifiez-le ou demandez un nouveau code.', rateLimited: 'Veuillez patienter avant de réessayer.', forbidden: 'Seuls les administrateurs peuvent gérer ces invitations.',
};

export function trustedCopy(language: string): Copy {
  const locale = trustedInviteLanguage(language);
  return locale === 'en' ? en : locale === 'fr' ? fr : pt;
}

export function trustedInviteMessage(name: string, url: string, language: TrustedInviteLanguage, mode: 'direct' | 'phone', token: string): string {
  if (language === 'en') return `Hello ${name},\n\nYour personal invitation to YAMILOOK is ready. Open the link to activate your account without email confirmation.${mode === 'phone' ? ' You will receive a verification code on your phone.' : ''}\n\n${url}\n\nIf the page asks for a code, paste this invitation code.\n${token}\n\nThis invitation is personal and can be used once. Keep the link and code private.`;
  if (language === 'fr') return `Bonjour ${name},\n\nVotre invitation personnelle à YAMILOOK est prête. Ouvrez le lien pour activer votre compte sans confirmation par e-mail.${mode === 'phone' ? ' Vous recevrez un code de vérification sur votre téléphone.' : ''}\n\n${url}\n\nSi la page demande un code, collez ce code d’invitation.\n${token}\n\nCette invitation est personnelle et à usage unique. Gardez le lien et le code privés.`;
  return `Olá ${name},\n\nO seu convite pessoal para a YAMILOOK está pronto. Abra o link para activar a conta sem confirmação de e-mail.${mode === 'phone' ? ' Receberá um código de confirmação no seu telefone.' : ''}\n\n${url}\n\nSe a página pedir um código, cole este código de convite.\n${token}\n\nEste convite é pessoal e de utilização única. Guarde o link e o código em privado.`;
}

export function trustedErrorMessage(error: unknown, language: string): string {
  const copy = trustedCopy(language);
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code).toLowerCase() : '';
  if (/username.*(taken|exist|available)|username_unavailable/.test(code)) return copy.usernameTaken;
  if (/otp|verification.*code/.test(code)) return copy.invalidOtp;
  if (/rate|too_many|cooldown/.test(code)) return copy.rateLimited;
  if (/sms.*unavailable|sms_not|provider/.test(code)) return copy.smsUnavailable;
  if (/invite.*(invalid|unavailable|used|revoked|expired)|invitation.*(invalid|unavailable|used|revoked|expired)|invalid_invitation|invalid_token/.test(code)) return copy.invitationUnavailable;
  if (/forbidden|admin_required|unauthori/.test(code)) return copy.forbidden;
  return copy.error;
}
