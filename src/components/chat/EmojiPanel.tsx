import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { EMOJI_GROUPS, SKIN_TONES, DEFAULT_TONE, applyTone, supportsTone } from '@/lib/african-emojis';

interface Props {
  onSelect: (emoji: string) => void;
}

const TONE_KEY = 'yamilook-emoji-tone';

/** African-first emoji picker for the chat. Category chips switch the grid; a
 *  skin-tone selector re-tones people/hand emojis (default darkest, up to the
 *  lightest/European); the "Outros" group holds the general set. */
export function EmojiPanel({ onSelect }: Props) {
  useUiLocale();
  const [active, setActive] = useState(EMOJI_GROUPS[0].key);
  const [tone, setTone] = useState<string>(() => {
    try {
      return localStorage.getItem(TONE_KEY) || DEFAULT_TONE;
    } catch {
      return DEFAULT_TONE;
    }
  });

  const group = EMOJI_GROUPS.find((g) => g.key === active) ?? EMOJI_GROUPS[0];
  const groupHasTonable = group.emojis.some(supportsTone);

  const pickTone = (mod: string) => {
    setTone(mod);
    try {
      localStorage.setItem(TONE_KEY, mod);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="w-[300px] max-w-[80vw]">
      {/* Category chips */}
      <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
        {EMOJI_GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setActive(g.key)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs whitespace-nowrap shrink-0 transition-colors',
              active === g.key
                ? 'bg-primary/15 text-primary font-medium'
                : 'text-muted-foreground hover:bg-secondary/50',
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Skin-tone selector — only where the current group has tonable emojis */}
      {groupHasTonable && (
        <div className="flex items-center gap-1 pb-2">
          <span className="text-[10px] text-muted-foreground mr-1">{uiText("Tom:")}</span>
          {SKIN_TONES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => pickTone(t.mod)}
              title={t.label}
              aria-label={`Tom de pele: ${t.label}`}
              aria-pressed={tone === t.mod}
              className={cn(
                'text-base leading-none rounded-md p-0.5 transition-transform',
                tone === t.mod ? 'ring-2 ring-primary scale-110' : 'opacity-80 hover:opacity-100',
              )}
            >
              <span role="img" aria-hidden="true">{`✋${t.mod}`}</span>
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="grid grid-cols-7 gap-0.5 max-h-[184px] overflow-y-auto">
        {group.emojis.map((e, i) => {
          const toned = applyTone(e, tone);
          return (
            <button
              key={`${e}-${i}`}
              type="button"
              onClick={() => onSelect(toned)}
              className="text-xl p-1.5 rounded-lg hover:bg-secondary/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Emoji ${toned}`}
            >
              <span role="img">{toned}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
