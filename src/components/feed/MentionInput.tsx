import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useEffect, useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { activeMention, insertMention } from '@/lib/comment-mentions';

type Person = { id: string | null; username: string | null; display_name: string | null; avatar_url: string | null };
export function MentionInput({ value, onValueChange, onSubmit, ...props }: Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'onSubmit'> & { value: string; onValueChange: (value: string) => void; onSubmit: () => void }) {
  useUiLocale();
  const ref = useRef<HTMLInputElement>(null);
  const id = useId();
  const [cursor, setCursor] = useState(0);
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const mention = activeMention(value, cursor);
  const query = mention?.query;
  useEffect(() => {
    let current = true;
    setPeople([]); setSelected(0);
    if (query === undefined || dismissed) return;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.from('public_profiles')
        .select('id,username,display_name,avatar_url')
        .ilike('username', query.replace(/[_%\\]/g, '\\$&') + '%')
        .order('username').limit(8);
      if (current && !error) setPeople((data || []).filter(p => p.id && p.username));
    }, 200);
    return () => { current = false; clearTimeout(timer); };
  }, [query, dismissed]);
  const choose = (person: Person) => {
    if (!mention || !person.username) return;
    const result = insertMention(value, cursor, person.username);
    onValueChange(result.value); setPeople([]); setDismissed(true);
    requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(result.cursor, result.cursor); setCursor(result.cursor); });
  };
  const visible = !dismissed && people.length > 0 && !!mention;
  return <div className="relative flex-1 min-w-0">
    {visible && <div id={id} role="listbox" aria-label={uiText("Users")} className="absolute bottom-full mb-2 w-full max-h-60 overflow-auto rounded-xl border bg-popover text-popover-foreground shadow-lg z-50">
      {people.map((p, i) => <button type="button" role="option" id={`${id}-${i}`} aria-selected={selected === i} key={p.id} onMouseDown={e => e.preventDefault()} onClick={() => choose(p)} className={`flex w-full items-center gap-2 p-3 text-left ${selected === i ? 'bg-secondary' : ''}`}>
        {p.avatar_url && <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />}
        <span className="truncate">{p.display_name}<span className="block text-xs text-muted-foreground">@{p.username}</span></span>
      </button>)}
    </div>}
    <Input {...props} ref={ref} value={value} role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls={visible ? id : undefined} aria-activedescendant={visible ? `${id}-${selected}` : undefined}
      onChange={e => { onValueChange(e.target.value); setCursor(e.target.selectionStart ?? e.target.value.length); setDismissed(false); }}
      onSelect={e => setCursor(e.currentTarget.selectionStart ?? value.length)}
      onKeyDown={e => {
        if (e.nativeEvent.isComposing) return;
        if (visible && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
          e.preventDefault();
          if (e.key === 'Escape') setDismissed(true);
          else if (e.key === 'Enter') choose(people[selected]);
          else setSelected(i => (i + (e.key === 'ArrowDown' ? 1 : -1) + people.length) % people.length);
        } else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); }
      }} />
  </div>;
}
