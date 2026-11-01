import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/hooks/useSettings';
import { useRingtonePreview, type RingtoneOptions } from '@/hooks/useRingtone';

export default function CallRingtoneSettings() {
  const { t } = useTranslation();
  const { settings, loading, updateSettings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const enabled = settings?.ringtone_enabled ?? true;
  const volume = settings?.ringtone_volume ?? 0.5;
  const pattern = settings?.ringtone_pattern ?? 'default';
  const { playPreview, stopRingtone } = useRingtonePreview({
    pattern: pattern as RingtoneOptions['pattern'], volume,
    ringtoneEnabled: enabled, vibrationEnabled: false,
  });
  const save = async (updates: Parameters<typeof updateSettings>[0]) => {
    stopRingtone();
    setSaving(true); setError('');
    try {
      const result = await updateSettings(updates);
      if (result.error) throw result.error;
    } catch { setError('Não foi possível guardar o toque. Tenta novamente.'); }
    finally { setSaving(false); }
  };
  return <section className="rounded-2xl border p-4 space-y-4" aria-labelledby="call-ringtone-title">
    <h2 id="call-ringtone-title" className="font-semibold">{t('kosolola.ringtoneTitle')}</h2>
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{t('kosolola.incomingSound')}</span>
      <Switch checked={enabled} disabled={loading || saving || !settings} onCheckedChange={value => void save({ ringtone_enabled: value })} />
    </label>
    <div className="space-y-2">
      <label htmlFor="call-ringtone-pattern" className="block text-sm">{t('kosolola.chooseRingtone')}</label>
      <select id="call-ringtone-pattern" className="w-full min-h-11 rounded-xl border bg-background px-3 text-base"
        value={pattern} disabled={loading || saving || !settings || !enabled}
        onChange={event => void save({ ringtone_pattern: event.target.value })}>
        <option value="default">{t('kosolola.defaultTone')}</option><option value="classic">{t('settings.patternClassic', { defaultValue: 'Clássico' })}</option>
        <option value="modern">{t('settings.patternModern', { defaultValue: 'Moderno' })}</option><option value="gentle">{t('settings.patternGentle', { defaultValue: 'Suave' })}</option>
        <option value="urgent">{t('settings.patternUrgent', { defaultValue: 'Urgente' })}</option><option value="silent">{t('settings.patternSilent', { defaultValue: 'Silencioso' })}</option>
      </select>
    </div>
    <label className="block space-y-2 text-sm" htmlFor="call-ringtone-volume">
      <span>{t('kosolola.ringtoneVolume')}: {Math.round(volume * 100)}%</span>
      <input id="call-ringtone-volume" type="range" className="w-full h-11 accent-primary" min="0" max="1" step="0.1"
        value={volume} disabled={loading || saving || !settings || !enabled}
        onChange={event => void save({ ringtone_volume: Number(event.target.value) })} />
    </label>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={loading || saving || !enabled || volume === 0 || pattern === 'silent'} onClick={() => playPreview(3000)}>{t('kosolola.testTone')}</Button>
      <Button variant="ghost" onClick={stopRingtone}>{t('kosolola.stopTest')}</Button>
    </div>
    {(!enabled || volume === 0 || pattern === 'silent') && <p role="status" className="text-sm">{t('kosolola.silentTone')}</p>}
    {loading && <p role="status" className="text-sm">{t('kosolola.loadingTones')}</p>}
    {!loading && !settings && <p role="alert" className="text-sm">Não foi possível carregar as preferências. Volta a abrir as Definições.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p className="text-xs text-muted-foreground">O teste dura três segundos. Ajusta também o volume do telefone. Este toque é usado com a aplicação aberta; fora dela, ativa os alertas de chamadas abaixo.</p>
  </section>;
}
