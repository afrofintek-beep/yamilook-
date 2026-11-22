import { useAppSurface } from '@/lib/app-surface';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Wallet, List, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function WalletHeader({ section = 'wallet', asset = 'kwanzas', admin = false, security, back = '/feed' }: { section?: string; asset?: 'kwanzas' | 'kumbu'; admin?: boolean; security?: () => void; back?: string }) {
  const navigate = useNavigate();
  const surface = useAppSurface();
  const destination = surface === 'papos' && back === '/feed' ? '/papos' : back;
  return <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
    <div className="mx-auto flex max-w-xl items-center gap-2 px-3 py-2">
      <Button variant="ghost" className="min-h-11 gap-1 px-2" onClick={() => navigate(destination)}><ArrowLeft className="h-5 w-5" />Voltar</Button>
      <h1 className="flex-1 text-lg font-semibold">{section === 'business' ? 'MEU NEGÓCIO' : section === 'movements' ? 'MOVIMENTOS' : 'CARTEIRA'}</h1>
      <span className="text-xs text-muted-foreground">{asset === 'kwanzas' ? 'Angola · Kz' : 'Kumbu'}</span>
      {security && <Button variant="ghost" size="icon" aria-label="Segurança das transferências" onClick={security}><ShieldCheck className="h-5 w-5" /></Button>}
      {admin && <Button variant="ghost" aria-label="Gestão" onClick={() => navigate('/payment-point?tab=admin')}>Gestão</Button>}
    </div>
    {section === 'wallet' && <nav aria-label="Saldos da carteira" className="mx-auto grid max-w-xl grid-cols-2 gap-1 px-4 pb-2">
      {[{ key: 'kwanzas', label: 'MASSA', to: '/payment-point' }, { key: 'kumbu', label: 'KUMBU', to: '/kumbu' }].map(item => <Link key={item.key} to={item.to} aria-current={item.key === asset ? 'page' : undefined} className={`rounded-lg py-2 text-center text-sm font-medium ${item.key === asset ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-muted'}`}>{item.label}</Link>)}
    </nav>}
  </header>;
}
export function WalletNavigation({ asset = 'kwanzas', tab = 'wallet' }: { asset?: 'kwanzas' | 'kumbu'; tab?: string }) {
  const items = [
    { key: 'wallet', label: 'Carteira', icon: Wallet, to: asset === 'kumbu' ? '/kumbu' : '/payment-point' },
    { key: 'movements', label: 'Movimentos', icon: List, to: asset === 'kumbu' ? '/kumbu/history' : '/payment-point?tab=movements' },
    { key: 'business', label: 'Negócio', icon: Store, to: '/payment-point?tab=business' },
  ];
  return <nav aria-label="Navegação da carteira" className="fixed bottom-0 inset-x-0 z-20 border-t bg-background pb-[env(safe-area-inset-bottom)]"><div className="mx-auto flex max-w-xl gap-1 p-2">
    {items.map(item => <Link key={item.key} to={item.to} aria-current={tab === item.key ? 'page' : undefined} className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-xs ${tab === item.key ? 'bg-primary/10 text-primary' : 'text-foreground'}`}><item.icon className="h-5 w-5" />{item.label}</Link>)}
  </div></nav>;
}
