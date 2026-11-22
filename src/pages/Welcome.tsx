import { ResumeLink } from '@/pages/ResumeRegistration';
import { WelcomeCarousel } from '@/components/auth/WelcomeCarousel';
import { normalizeAppLanguage } from '@/i18n/afroloc-languages';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import YamilookLogo from '@/components/brand/YamilookLogo';
import { EntryLanguageSelector } from '@/components/auth/EntryLanguageSelector';

import { useState } from 'react';
import { businessCopy, initialScene, readEntry, saveEntry, scenes } from '@/lib/business-entry';
import { Input } from '@/components/ui/input';

export default function Welcome() {
  const { t, i18n } = useTranslation();
  const isPortuguese = ['pt', 'pt-banda'].includes(normalizeAppLanguage(i18n.language));
  const { search } = useLocation();
  const businessSearch = new URLSearchParams(search);
  businessSearch.set('next', '/meus-negocios?abrir=1');
  const business = new URLSearchParams(search).get('next') === '/meus-negocios?abrir=1';
  const [draft, setDraft] = useState(readEntry);
  const scene = draft.scene || initialScene(i18n.language);
  const labels = businessCopy(i18n.language);
  function update(name: string, activity: string, selected: string) {
    setDraft({ name, activity, scene: selected });
    saveEntry(name, activity, selected);
  }
  return (
    <main dir={i18n.dir()} className="min-h-screen flex flex-col items-center justify-start sm:justify-center bg-background px-3 pt-2 pb-6 sm:px-5 sm:py-6 gap-3">
      <YamilookLogo size="md" showTagline={false} animate={false} />
      <h1 className="text-2xl font-semibold text-center">{isPortuguese ? t('welcome.title') : t('entry.title')} 👋🏾</h1>
      <p className="text-muted-foreground text-center">{isPortuguese ? t('welcome.subtitle') : t('entry.subtitle')}</p>
      {business ? <div className="w-full max-w-md space-y-2">
        <img className="aspect-video w-full rounded-2xl object-cover" src={`/business-scenes/${scene}.webp`} alt="" />
        <label className="flex items-center justify-between gap-3 text-sm">{labels.region}
          <select value={scene} onChange={e => update(draft.name, draft.activity, e.target.value)}>
            {scenes.map(([city,id]) => <option key={id} value={id}>{city}</option>)}
          </select>
        </label>
      </div> : <WelcomeCarousel />}
      <EntryLanguageSelector />
      <div className="w-full max-w-md space-y-3">
        <h2 className="text-center text-lg font-semibold">{t(business ? 'entry.business' : 'entry.start')}</h2>
        {business ? (
          <>
            <label className="block">{labels.name}<Input maxLength={160} value={draft.name} onChange={e => update(e.target.value, draft.activity, scene)} /></label>
            <label className="block">{labels.activity}<Input maxLength={240} value={draft.activity} onChange={e => update(draft.name, e.target.value, scene)} /></label>
            <p className="text-sm text-muted-foreground">{labels.owner}</p>
            <Button asChild size="lg" className="w-full min-h-14"><Link to={`/register${search}`}>{t('entry.createAccount')}</Link></Button>
          </>
        ) : (
          <>
            <Link className="block rounded-xl bg-primary px-4 py-3 text-primary-foreground" to={`/register${search}`}>
              <strong className="block">{t('entry.personal')}</strong><span className="text-sm">{t('entry.personalHint')}</span>
            </Link>
            <Link className="block rounded-xl border px-4 py-3" to={`/welcome?${businessSearch}`}>
              <strong className="block">{t('entry.business')}</strong><span className="text-sm">{t('entry.businessHint')}</span>
            </Link>
          </>
        )}
        <Button asChild variant="outline" size="lg" className="w-full min-h-14"><Link to={`/login${search}`}>{isPortuguese ? 'Já tenho conta · ' : ''}{t('entry.login')}</Link></Button>
        <ResumeLink />
      </div>
      <nav className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <Link to="/terms" className="underline">{t('entry.terms')}</Link>
        <Link to="/privacy" className="underline">{t('entry.privacy')}</Link>
      </nav>
    </main>
  );
}
