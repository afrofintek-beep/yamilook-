import { Input } from '@/components/ui/input';
import { businessDates, validStartYear } from '@/lib/business-dates';
import { useTranslation } from 'react-i18next';

interface Props {
  year: string;
  planned: boolean;
  onChange: (year: string, planned: boolean) => void;
}

export function BusinessStartField({ year, planned, onChange }: Props) {
  const { i18n } = useTranslation();
  const copy = businessDates(i18n.language);
  return <fieldset className="space-y-2">
    <label className="block">{copy.question}
      <Input inputMode="numeric" maxLength={4} value={year} disabled={planned}
        aria-invalid={!!year && !validStartYear(year)} onChange={event => onChange(event.target.value, false)} />
    </label>
    <p className="text-sm text-muted-foreground">{copy.hint}</p>
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={planned} onChange={event => onChange('', event.target.checked)} />
      {copy.planned}
    </label>
  </fieldset>;
}
