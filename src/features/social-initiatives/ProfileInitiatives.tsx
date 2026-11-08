import { useQuery } from '@tanstack/react-query';
import { Award } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { FAIR_PATH, socialAction, type ProfileInitiatives as ProfileData } from './api';

export default function ProfileInitiatives({ userId }: { userId: string }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['social-profile', userId, user?.id],
    queryFn: () => socialAction<ProfileData>('profile', { user_id: userId }),
  });
  if (query.isPending) return <p role="status" className="px-4 text-sm">A carregar iniciativas…</p>;
  if (query.isError) return <p role="alert" className="px-4 text-sm">Não foi possível carregar as iniciativas. <button className="underline" onClick={() => void query.refetch()}>Tentar novamente</button></p>;
  const items = query.data.initiatives;
  if (!items.length) return null;
  const total = items.filter(item => item.awarded).length;
  return <section className="mx-4 mb-6 space-y-3 rounded-xl border p-4" aria-label="Iniciativas e impacto social">
    <h2 className="font-semibold">Iniciativas e impacto social</h2>
    {total > 0 && <p className="flex items-center gap-2 font-semibold"><Award aria-hidden="true" className="h-5 w-5" />Embaixador Social · {total} {total === 1 ? 'distinção' : 'distinções'}</p>}
    <p className="text-sm">{items.length} iniciativas participadas{user?.id !== userId ? ' com visibilidade pública' : ''}</p>
    <ul className="space-y-3">{items.map(item => <li key={item.slug} className="rounded-lg bg-muted/50 p-3 text-sm">
      <a href={FAIR_PATH} className="font-medium underline">{item.name}</a>
      <p>{item.awarded ? 'Distinção conquistada' : 'Participação registada'}</p>
      {item.awarded && item.awarded_at && <p>{new Date(item.awarded_at).toLocaleDateString('pt-AO')}</p>}
      {user?.id === userId && <p>{item.is_public ? 'Pública' : 'Visível apenas para si'}</p>}
    </li>)}</ul>
  </section>;
}
