import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ProfileBioProps {
  lines: string[];
  expandable?: boolean;
  expandedText?: string;
}

export function ProfileBio({
  lines,
  expandable = false,
  expandedText,
}: ProfileBioProps) {
  useUiLocale();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!lines || lines.length === 0) return null;

  return (
    <motion.div
      className="px-6 mb-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.3 }}
    >
      <div className="text-center space-y-1">
        {lines.map((line, index) => (
          <p
            key={index}
            className={`text-sm leading-relaxed ${
              index === lines.length - 1 && line.startsWith('"')
                ? 'text-muted-foreground/70 italic'
                : 'text-foreground/80'
            }`}
          >
            {line}
          </p>
        ))}
      </div>

      {/* Expandable content */}
      {expandable && expandedText && (
        <>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <p className="text-sm text-foreground/70 leading-relaxed mt-4 text-center whitespace-pre-line">
                  {expandedText}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-center gap-1 w-full mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? (
              <>{uiText("Ver menos ")}<ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>{uiText("Ver mais ")}<ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        </>
      )}
    </motion.div>
  );
}
