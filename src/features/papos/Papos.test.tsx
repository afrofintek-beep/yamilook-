import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaposGate } from './PaposApp';
import PaposLogin from './PaposLogin';
import PaposInstall from './PaposInstall';
import BottomNav from '@/components/BottomNav';
import { AppSurfaceContext } from '@/lib/app-surface';
import { captureAppInstallPrompt, clearAppInstallPrompt, type InstallPrompt } from '@/lib/app-install';
const { auth } = vi.hoisted(() => ({ auth: { user: null as null | {id:string}, profile: null as null | {onboarding_completed:boolean}, loading: false, signIn: vi.fn(), refreshProfile: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth, AuthProvider: ({ children }: {children:React.ReactNode}) => children }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
beforeEach(() => { auth.user=null; auth.profile=null; auth.loading=false; auth.signIn.mockReset(); auth.refreshProfile.mockReset(); clearAppInstallPrompt(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function Destination() { const location=useLocation(); return <p data-testid="location">{JSON.stringify({path:location.pathname,state:location.state})}</p>; }
function gate() { return render(<MemoryRouter basename="/papos-app" initialEntries={['/papos-app/chat/real-chat']}><Routes><Route path="/chat/:id" element={<PaposGate><p>Histórico partilhado</p></PaposGate>} /><Route path="/login" element={<Destination />} /></Routes></MemoryRouter>); }
describe('Papos account and route isolation', () => {
  it('retains the destination when requesting sign-in', () => { gate(); expect(screen.getByTestId('location')).toHaveTextContent('"path":"/login"'); expect(screen.getByTestId('location')).toHaveTextContent('"from":"/chat/real-chat"'); });
  it('does not reveal messages while authentication is loading', () => { auth.loading=true; gate(); expect(screen.getByRole('status')).toBeInTheDocument(); expect(screen.queryByText('Histórico partilhado')).not.toBeInTheDocument(); });
  it('uses the existing completed account without a second registration', () => { auth.user={id:'same-user'}; auth.profile={onboarding_completed:true}; gate(); expect(screen.getByText('Histórico partilhado')).toBeInTheDocument(); expect(auth.signIn).not.toHaveBeenCalled(); });
  it('preserves the central onboarding requirement', () => { auth.user={id:'same-user'}; auth.profile={onboarding_completed:false}; gate(); expect(screen.getByRole('link',{name:'Continuar a inscrição'})).toHaveAttribute('href','/onboarding'); expect(screen.queryByText('Histórico partilhado')).not.toBeInTheDocument(); });
  it('allows retry when the shared account profile cannot be loaded', () => { auth.user={id:'same-user'}; gate(); fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'})); expect(auth.refreshProfile).toHaveBeenCalledOnce(); });
  it('keeps all messenger navigation inside the standalone application', () => {
    render(<AppSurfaceContext.Provider value="papos"><MemoryRouter basename="/papos-app" initialEntries={['/papos-app/papos']}><BottomNav /></MemoryRouter></AppSurfaceContext.Provider>);
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getByRole('link',{name:'Papos'})).toHaveAttribute('href','/papos-app/papos');
    expect(screen.getByRole('link',{name:'Contactos'})).toHaveAttribute('href','/papos-app/contacts');
    expect(screen.queryByRole('link',{name:'Muxi'})).not.toBeInTheDocument();
  });
});
describe('Papos password sign-in', () => {
  function login() { return render(<MemoryRouter basename="/papos-app" initialEntries={[{pathname:'/papos-app/login',state:{from:'/chat/real-chat'}}]}><Routes><Route path="/login" element={<PaposLogin />} /><Route path="/chat/:id" element={<Destination />} /></Routes></MemoryRouter>); }
  function submit() { fireEvent.change(screen.getByLabelText('Email'),{target:{value:'same@example.com'}}); fireEvent.change(screen.getByLabelText('Palavra-passe'),{target:{value:'private-password'}}); fireEvent.click(screen.getByRole('button',{name:'Entrar no Papos'})); }
  it('signs into the shared identity service and returns to the requested conversation', async () => { auth.signIn.mockResolvedValue({error:null}); login(); submit(); await waitFor(()=>expect(screen.getByTestId('location')).toHaveTextContent('/chat/real-chat')); expect(auth.signIn).toHaveBeenCalledExactlyOnceWith('same@example.com','private-password'); });
  it('reports a failed login without losing credentials or opening protected content', async () => { auth.signIn.mockResolvedValue({error:{message:'Invalid credentials'}}); login(); submit(); expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível entrar'); expect(screen.getByLabelText('Email')).toHaveValue('same@example.com'); expect(screen.queryByTestId('location')).not.toBeInTheDocument(); });
});
describe('Papos installation', () => {
  it('keeps its own install identity and does not claim an accepted prompt has completed installation', async () => {
    captureAppInstallPrompt(); const event=new Event('beforeinstallprompt',{cancelable:true}) as InstallPrompt;
    event.prompt=vi.fn().mockResolvedValue(undefined); event.userChoice=Promise.resolve({outcome:'accepted'}); window.dispatchEvent(event);
    render(<MemoryRouter><PaposInstall /></MemoryRouter>); fireEvent.click(screen.getByRole('button',{name:'Instalar Papos'}));
    await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Pedido aceite'));
    expect(screen.getByText('Instalar o Papos')).toBeInTheDocument(); expect(event.prompt).toHaveBeenCalledOnce();
    expect(screen.getByRole('link',{name:'Continuar no navegador'})).toHaveAttribute('href','/papos');
  });
});
