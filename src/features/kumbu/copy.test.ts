import { afterEach, expect, it } from 'vitest';
import { changeAppLanguage } from '@/i18n';
import { ACTION_LABELS, EARN_ACTIONS, kumbuLevelLabel, levelFor, levelProgress } from './copy';

afterEach(async () => { await changeAppLanguage('pt'); });

it('updates imported reward and history labels after changing language without changing amounts or tier identifiers', async () => {
  await changeAppLanguage('en');
  expect(ACTION_LABELS.academia_session).toBe('Academy session');
  expect(EARN_ACTIONS[2]).toMatchObject({ action: 'Academy session', kumbu: '+15', limit: 'max. 1/day' });
  expect(kumbuLevelLabel('Prata')).toBe('Silver');
  await changeAppLanguage('ar');
  expect(ACTION_LABELS.academia_session).toBe('جلسة في الأكاديمية');
  expect(EARN_ACTIONS[2]).toMatchObject({ action: 'جلسة في الأكاديمية', kumbu: '+15', limit: '1 يوميًا كحد أقصى' });
  expect(kumbuLevelLabel('Prata')).toBe('فضي');
  expect(kumbuLevelLabel('KOTA')).toBe('KOTA');
  expect(levelFor(400)).toBe('Prata');
  expect(levelProgress(400)).toEqual({ pct: 33, current: 400, target: 800 });
});
