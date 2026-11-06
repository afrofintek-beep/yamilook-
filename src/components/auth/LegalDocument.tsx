import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntryLanguageSelector } from './EntryLanguageSelector';
import { legalContent, legalLabel } from '@/i18n/legal-content';

export function LegalDocument({ kind }: { kind: 'terms' | 'privacy' }) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const language = i18n.resolvedLanguage || i18n.language;
  const content = legalContent(language);
  const document = content.documents[kind];
  return <main dir={i18n.dir(language)} lang={language} className="min-h-screen bg-background text-foreground">
    <article className="max-w-4xl mx-auto px-4 py-8">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="h-4 w-4 me-2 rtl:rotate-180" />{legalLabel(language, 'back')}
      </Button>
      <EntryLanguageSelector />
      <h1 className="text-3xl font-bold mb-2">{content.texts[document.title]}</h1>
      <p className="text-muted-foreground mb-8">{legalLabel(language, 'updated')}</p>
      <div className="space-y-6 text-foreground/90">
        {document.sections.map((section, index) => <section key={index} className="space-y-3">
          {section.map((block, blockIndex) => {
            const text = content.texts[block.text];
            if (block.tag === 'h2') return <h2 key={blockIndex} className="text-xl font-semibold">{text}</h2>;
            if (block.tag === 'h3') return <h3 key={blockIndex} className="font-medium pt-3">{text}</h3>;
            if (block.tag === 'li') return <ul key={blockIndex} className="list-disc ps-6"><li className="leading-relaxed">{text}</li></ul>;
            return <p key={blockIndex} className="leading-relaxed">{text}</p>;
          })}
        </section>)}
      </div>
      <nav className="mt-8 border-t pt-4"><Link className="underline" to={kind === 'terms' ? '/privacy' : '/terms'}>{legalLabel(language, kind === 'terms' ? 'privacy' : 'terms')}</Link></nav>
    </article>
  </main>;
}
