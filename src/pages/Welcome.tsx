import { WelcomeCarousel } from '@/components/auth/WelcomeCarousel';
import { normalizeAppLanguage } from '@/i18n/afroloc-languages';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import YamilookLogo from '@/components/brand/YamilookLogo';
import { EntryLanguageSelector } from '@/components/auth/EntryLanguageSelector';

export default function Welcome() {
  const { t, i18n } = useTranslation();
  const isPortuguese = ['pt', 'pt-banda'].includes(normalizeAppLanguage(i18n.language));
  const { search } = useLocation();
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-5 py-6 gap-3">
      <YamilookLogo size="lg" showTagline={false} animate={false} />
      <h1 className="text-2xl font-semibold text-center">{isPortuguese ? t('welcome.title') : t('entry.title')} 👋🏾</h1>
      <p className="text-muted-foreground text-center">{isPortuguese ? t('welcome.subtitle') : t('entry.subtitle')}</p>
      <WelcomeCarousel />
      <EntryLanguageSelector />
      <div className="w-full max-w-sm space-y-3">
        <Button asChild size="lg" className="w-full min-h-14"><Link to={`/onboarding${search}`}>{t('entry.createAccount')}</Link></Button>
        <Button asChild variant="outline" size="lg" className="w-full min-h-14"><Link to={`/login${search}`}>{t('entry.login')}</Link></Button>
      </div>
      <nav className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <Link to="/terms" className="underline">{t('entry.terms')}</Link>
        <Link to="/privacy" className="underline">{t('entry.privacy')}</Link>
      </nav>
    </main>
  );
}
