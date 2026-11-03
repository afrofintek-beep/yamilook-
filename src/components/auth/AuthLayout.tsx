import { EntryLanguageSelector } from './EntryLanguageSelector';
import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import YamilookLogo from '@/components/brand/YamilookLogo';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  tagline?: string;
  footerNote?: string;
  showBackButton?: boolean;
  backTo?: string;
}

export function AuthLayout({ children, title, subtitle, tagline, footerNote, showBackButton = false, backTo }: AuthLayoutProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  return (
    <motion.div 
      className="min-h-screen flex flex-col bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Minimal decorative background - clean, not glamorous */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Back Button */}
      {showBackButton && (
        <motion.div
          className="absolute top-4 left-4 z-10"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => backTo ? navigate(backTo) : navigate(-1)}
            aria-label={t('common.back')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </motion.div>
      )}

      {/* Content */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Yamilook Brand Logo - with golden sinus wave */}
        <motion.div 
          className="mb-6 flex flex-col items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <YamilookLogo size="lg" showTagline={false} animate={false} />
        </motion.div>

        <EntryLanguageSelector />

        {/* Card - Seamless, no borders */}
        <div className="w-full max-w-md">
          <div className="p-8">
            <div className="text-center mb-8">
              <motion.h2 
                className="text-2xl font-semibold text-foreground"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {title}
              </motion.h2>
              {subtitle && (
                <motion.p 
                  className="mt-2 text-muted-foreground"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.35 }}
                >
                  {subtitle}
                </motion.p>
              )}
              {tagline && (
                <motion.p 
                  className="mt-1 text-sm text-muted-foreground/70"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.45 }}
                >
                  {tagline}
                </motion.p>
              )}
            </div>
            {children}
          </div>
        </div>

        {/* Footer Note */}
        {footerNote && (
          <motion.p 
            className="mt-6 text-sm text-muted-foreground font-light tracking-wide text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            {footerNote}
          </motion.p>
        )}
        
        {/* Terms footer */}
        <p className="mt-4 text-xs text-muted-foreground text-center">
          {t('auth.termsAccept')}{' '}
          <a href="/terms" className="text-primary hover:underline font-medium">
            {t('auth.termsOfService')}
          </a>{' '}
          {t('auth.and')}{' '}
          <a href="/privacy" className="text-primary hover:underline font-medium">
            {t('auth.privacyPolicy')}
          </a>
        </p>
      </main>
    </motion.div>
  );
}
