import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { getYamilookPublicUrl } from '@/lib/public-site';
import { registrationEmailLanguage } from '@/lib/registration-email';

const copy: Record<string, [string, string, string]> = {
  pt: ['Retomar a minha inscrição', 'Introduza o email usado na inscrição.', 'Se este email estiver associado a uma conta, receberá uma ligação de acesso.'],
  en: ['Resume my registration', 'Enter the email used to register.', 'If this email belongs to an account, you will receive a sign-in link.'],
  fr: ['Reprendre mon inscription', 'Saisissez l’adresse utilisée pour votre inscription.', 'Si cette adresse est associée à un compte, vous recevrez un lien de connexion.'],
  ar: ['متابعة تسجيلي', 'أدخل البريد الإلكتروني المستخدم للتسجيل.', 'إذا كان البريد مرتبطاً بحساب فستصلك رسالة تحتوي على رابط للدخول.'],
  am: ['ምዝገባዬን ልቀጥል', 'ለመመዝገብ የተጠቀሙበትን ኢሜይል ያስገቡ።', 'ይህ ኢሜይል ከመለያ ጋር ከተገናኘ የመግቢያ አገናኝ ይደርስዎታል።'],
  sw: ['Endelea na usajili wangu', 'Weka barua pepe uliyotumia kujisajili.', 'Ikiwa barua pepe hii imeunganishwa na akaunti, utapokea kiungo cha kuingia.'],
  ln: ['Kokoba komikomisa na ngai', 'Tyá email oyo osalelaki mpo na komikomisa.', 'Soki email yango ezali ya konti moko, okozwa lien mpo na kokɔta.'],
  yo: ['Tẹ̀síwájú pẹ̀lú ìforúkọsílẹ̀ mi', 'Tẹ ímeèlì tí o lò láti forúkọ sílẹ̀.', 'Tí ímeèlì yìí bá ní àkọọ́lẹ̀, o máa gba ìjápọ̀ láti wọlé.'],
  sn: ['Enderera mberi nekunyoresa kwangu', 'Isa email yawakashandisa kunyoresa.', 'Kana email iyi yakabatana neakaundi, uchagamuchira chinongedzo chekupinda.'],
  zu: ['Qhubeka nokubhalisa kwami', 'Faka i-imeyili oyisebenzisele ukubhalisa.', 'Uma le imeyili ixhunywe ku-akhawunti, uzothola isixhumanisi sokungena.'],
};
function useResumeCopy() {
  const { i18n } = useTranslation();
  return copy[registrationEmailLanguage(i18n.language)];
}
export function ResumeLink() {
  const [label] = useResumeCopy();
  return <Link className="block py-3 text-center underline" to="/retomar">{label}</Link>;
}
export default function ResumeRegistration() {
  const { t, i18n } = useTranslation();
  const [title, hint, confirmation] = useResumeCopy();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    try {
      const lang = registrationEmailLanguage(i18n.language);
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: getYamilookPublicUrl(`/?lang=${lang}`) },
      });
      const accountUnknown = error?.code === 'user_not_found' || error?.code === 'otp_disabled' || error?.code === 'signup_disabled';
      setStatus(error && !accountUnknown ? 'error' : 'sent');
    } catch {
      setStatus('error');
    }
  }
  return <AuthLayout title={title} subtitle={status === 'sent' ? confirmation : hint} showBackButton backTo="/welcome">
    {status === 'sent' ? <Button variant="outline" onClick={() => setStatus('idle')}>{t('auth.tryDifferentEmail')}</Button> :
      <form className="space-y-4" onSubmit={submit}>
        <label className="block">{t('auth.email')}
          <Input type="email" required autoComplete="email" value={email} disabled={status === 'sending'} onChange={event => setEmail(event.target.value)} />
        </label>
        {status === 'error' && <p role="alert">{t('publicAuth.retry')}</p>}
        <Button type="submit" disabled={status === 'sending'}>{status === 'sending' ? t('auth.sending') : title}</Button>
      </form>}
  </AuthLayout>;
}
