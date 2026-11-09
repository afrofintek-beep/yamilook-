/** Kumbu economy – copy & constants (algorithm thresholds only, no formula). */
import { uiText } from '@/i18n/ui-copy';

export const LEVEL_THRESHOLDS = [
  { level: 'Bronze', min: 0, max: 200 },
  { level: 'Prata', min: 200, max: 800 },
  { level: 'Ouro', min: 800, max: 2000 },
  { level: 'KOTA', min: 2000, max: Infinity },
] as const;

export type KumbuLevel = (typeof LEVEL_THRESHOLDS)[number]['level'];

/** Keep stored tier identifiers stable; translate only their display labels. */
export function kumbuLevelLabel(level: string): string {
  switch (level) {
    case 'Bronze': return uiText('Bronze');
    case 'Prata': return uiText('Prata');
    case 'Ouro': return uiText('Ouro');
    default: return level;
  }
}

export function levelFor(lifetime: number): KumbuLevel {
  return (LEVEL_THRESHOLDS.find((t) => lifetime < t.max) ?? LEVEL_THRESHOLDS[3]).level;
}

export function levelProgress(lifetime: number) {
  const tier = LEVEL_THRESHOLDS.find((t) => lifetime < t.max) ?? LEVEL_THRESHOLDS[3];
  if (tier.max === Infinity) return { pct: 100, current: lifetime, target: tier.min };
  const range = tier.max - tier.min;
  const progress = lifetime - tier.min;
  return { pct: Math.min(100, Math.round((progress / range) * 100)), current: lifetime, target: tier.max };
}

/** Friendly labels for reason codes coming from kumbu_ledger.action_type */
export const ACTION_LABELS: Record<string, string> = {
  get roda_join() { return uiText('Participar na Roda'); },
  get roda_create() { return uiText('Criar Roda'); },
  get academia_session() { return uiText('Sessão na Academia'); },
  get referral() { return uiText('Convidar utilizador activo'); },
  get post_create() { return uiText('Publicação criada'); },
  get weekly_bonus() { return uiText('Bónus semanal Top 10'); },
  get spend() { return uiText('Utilização de Kumbu'); },
  get payout() { return uiText('Conversão para dinheiro'); },
  get admin_grant() { return uiText('Bónus administrativo'); },
};

export const EARN_ACTIONS = [
  { get action() { return uiText('Participar na Roda'); }, kumbu: '+5', get limit() { return uiText('máx. 3/dia'); } },
  { get action() { return uiText('Criar Roda'); }, kumbu: '+8', get limit() { return uiText('máx. 2/dia'); } },
  { get action() { return uiText('Sessão na Academia'); }, kumbu: '+15', get limit() { return uiText('máx. 1/dia'); } },
  { get action() { return uiText('Convidar utilizador activo'); }, kumbu: '+15', get limit() { return uiText('máx. 5/mês'); } },
  { get action() { return uiText('Publicar no feed'); }, kumbu: '+3', get limit() { return uiText('máx. 3/dia'); } },
];

export const WEEKLY_REWARDS = [
  { position: '#1', kumbu: '+40' },
  { position: '#2–3', kumbu: '+25' },
  { position: '#4–10', kumbu: '+10' },
];

export const DAILY_CAP = 40;

export const TAGLINE = 'Na Yamilook, quem participa ganha Kumbu.';
export const TAGLINE_ACADEMIA = 'Usa o teu Kumbu na Academia da Banda.';
export const TAGLINE_FULL =
  'Mokubico é convivência. Academia é crescimento. Kumbu é valor.';
export const ECONOMY_LABEL = 'Economia da Participação';
