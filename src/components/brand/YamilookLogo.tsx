import { motion } from "framer-motion";
import { useTranslation } from 'react-i18next';
import { YAMILOOK_LOGO_LIGHT as logoLight, YAMILOOK_LOGO_DARK as logoDark } from '@/lib/brand-assets';
// Two wordmarks: a dark-ink logo for light backgrounds and a light logo for dark.

interface YamilookLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  animate?: boolean;
  className?: string;
  /** Custom background class to match parent context (e.g., "bg-palco-bg" for PALCO pages) */
  bgClassName?: string;
}

/**
 * YAMILOOK BRAND LOGO
 *
 * Uses the official yamilook-logo.png and keeps original details always visible.
 *
 * IMPORTANT: When using on non-standard backgrounds (like PALCO pages),
 * pass the matching bgClassName prop (e.g., bgClassName="bg-palco-bg")
 */
const YamilookLogo = ({ 
  size = "md", 
  showTagline = true, 
  animate = true,
  className = "",
  bgClassName = "bg-background"
}: YamilookLogoProps) => {
  const { t } = useTranslation();
  const sizes = {
    sm: { width: 100, tagline: "text-xs", gap: "mt-2" },
    md: { width: 150, tagline: "text-sm", gap: "mt-3" },
    lg: { width: 200, tagline: "text-base", gap: "mt-4" },
    xl: { width: 280, tagline: "text-lg", gap: "mt-5" },
  };

  const { width, tagline, gap } = sizes[size];

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Blend modes drop each logo's flat background: multiply hides white (light
          theme), screen hides dark (dark theme). Swap by the .dark class. */}
      <div className="relative" style={{ width }}>
        <motion.img
          src={logoLight}
          alt="Yamilook"
          width={width}
          height={Math.round(width * 376 / 560)}
          // React 18.3 não reconhece a prop camelCase `fetchPriority`; usamos o
          // atributo HTML minúsculo `fetchpriority` (lido pelo browser) via spread.
          {...{ fetchpriority: "high" }}
          loading="eager"
          decoding="async"
          className="relative h-auto mix-blend-multiply block dark:hidden"
          initial={animate ? { opacity: 0, y: -10 } : undefined}
          animate={animate ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.5 }}
        />
        <motion.img
          src={logoDark}
          alt="Yamilook"
          width={width}
          height={Math.round(width * 376 / 560)}
          {...{ fetchpriority: "high" }}
          loading="eager"
          decoding="async"
          className="relative h-auto mix-blend-screen hidden dark:block"
          initial={animate ? { opacity: 0, y: -10 } : undefined}
          animate={animate ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Tagline */}
      {showTagline && (
        <motion.p
          className={`${tagline} ${gap} font-normal text-muted-foreground tracking-wide`}
          initial={animate ? { opacity: 0, y: 5 } : undefined}
          animate={animate ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.4, delay: 0.5 }}
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          {t('brandTagline')}
        </motion.p>
      )}
    </div>
  );
};

export default YamilookLogo;
