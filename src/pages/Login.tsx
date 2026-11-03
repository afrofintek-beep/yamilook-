import { useTranslation } from 'react-i18next';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { LoginForm } from '@/components/auth/LoginForm';

export default function Login() {
  const { t } = useTranslation();
  
  return (
    <AuthLayout
      title={t('auth.loginTitle')}
      subtitle={t('entry.subtitle')}
      footerNote={t('entry.subtitle')}
      showBackButton={true}
      backTo="/welcome"
    >
      <LoginForm />
    </AuthLayout>
  );
}