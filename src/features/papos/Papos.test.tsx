import { changeAppLanguage } from '@/i18n';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaposGate } from './PaposApp';
import PaposLogin from './PaposLogin';
import { PhoneAccess } from '@/features/phone-access/PhoneAccess';
import PaposInstall from './PaposInstall';
import BottomNav from '@/components/BottomNav';
import { AppSurfaceContext } from '@/lib/app-surface';
import { captureAppInstallPrompt, clearAppInstallPrompt, type InstallPrompt } from '@/lib/app-install';
const { auth } = vi.hoisted(() => ({ auth: { user: null as null | {id:string}, profile: null as null | {onboarding_completed:boolean}, loading: false, signIn: vi.fn(), refreshProfile: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth, AuthProvider: ({ children }: {children:React.ReactNode}) => children }));
const phoneAuth = vi.hoisted(() => ({ signInWithOtp: vi.fn(), verifyOtp: vi.fn(), updateUser: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: phoneAuth } }));
beforeEach(() => { auth.user=null; auth.profile=null; auth.loading=false; auth.signIn.mockReset(); auth.refreshProfile.mockReset(); clearAppInstallPrompt(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
function Destination() { const location=useLocation(); return <p data-testid="location">{JSON.stringify({path:location.pathname,state:location.state})}</p>; }
function gate() { return render(<MemoryRouter basename="/papos-app" initialEntries={['/papos-app/chat/real-chat']}><Routes><Route path="/chat/:id" element={<PaposGate><p>Histórico partilhado</p></PaposGate>} /><Route path="/login" element={<Destination />} /></Routes></MemoryRouter>); }
describe('Papos account and route isolation', () => {
  it('retains the destination when requesting sign-in', () => { gate(); expect(screen.getByTestId('location')).toHaveTextContent('"path":"/login"'); expect(screen.getByTestId('location')).toHaveTextContent('"from":"/chat/real-chat"'); });
  it('does not reveal messages while authentication is loading', () => { auth.loading=true; gate(); expect(screen.getByRole('status')).toBeInTheDocument(); expect(screen.queryByText('Histórico partilhado')).not.toBeInTheDocument(); });
  it('uses the existing completed account without a second registration', () => { auth.user={id:'same-user'}; auth.profile={onboarding_completed:true}; gate(); expect(screen.getByText('Histórico partilhado')).toBeInTheDocument(); expect(auth.signIn).not.toHaveBeenCalled(); });
  it('preserves the central onboarding requirement', () => { auth.user={id:'same-user'}; auth.profile={onboarding_completed:false}; gate(); expect(screen.getByRole('link',{name:'Continuar a inscrição'})).toHaveAttribute('href','https://www.yamilook.com/onboarding?lang=pt'); expect(screen.queryByText('Histórico partilhado')).not.toBeInTheDocument(); });
  it('allows retry when the shared account profile cannot be loaded', () => { auth.user={id:'same-user'}; gate(); fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'})); expect(auth.refreshProfile).toHaveBeenCalledOnce(); });
  it('keeps all messenger navigation inside the standalone application', () => {
    render(<AppSurfaceContext.Provider value="papos"><MemoryRouter basename="/papos-app" initialEntries={['/papos-app/papos']}><BottomNav /></MemoryRouter></AppSurfaceContext.Provider>);
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getByRole('link',{name:'Conversas'})).toHaveAttribute('href','/papos-app/papos');
    expect(screen.getByRole('link',{name:'Contactos'})).toHaveAttribute('href','/papos-app/contacts');
    expect(screen.queryByRole('link',{name:'Muxi'})).not.toBeInTheDocument();
  });
});
describe('Papos password sign-in', () => {
  it('keeps account and legal links on Yamilook with the selected language', async () => {
    try {
      for (const language of ['pt', 'en', 'fr', 'ar', 'am', 'sw', 'ln', 'yo', 'sn', 'zu']) {
        await changeAppLanguage(language);
        const view = login();
        const links = screen.getAllByRole('link').map(link => new URL(link.getAttribute('href')!));
        expect(links.map(link => link.pathname).sort()).toEqual(['/forgot-password', '/muxi', '/onboarding', '/privacy', '/terms']);
        for (const link of links) {
          expect(link.origin).toBe('https://www.yamilook.com');
          expect(link.searchParams.get('lang')).toBe(language);
        }
        view.unmount();
      }
    } finally { await changeAppLanguage('pt'); }
  });
  function login() { return render(<MemoryRouter basename="/papos-app" initialEntries={[{pathname:'/papos-app/login',state:{from:'/chat/real-chat'}}]}><Routes><Route path="/login" element={<PaposLogin />} /><Route path="/chat/:id" element={<Destination />} /></Routes></MemoryRouter>); }
  function submit() { fireEvent.change(screen.getByLabelText('E-mail ou nome de utilizador'),{target:{value:'same@example.com'}}); fireEvent.change(screen.getByLabelText('Palavra-passe'),{target:{value:'private-password'}}); fireEvent.click(screen.getByRole('button',{name:'Entrar na KOSOLOLA'})); }
  it('signs into the shared identity service and returns to the requested conversation', async () => { auth.signIn.mockResolvedValue({error:null}); login(); submit(); await waitFor(()=>expect(screen.getByTestId('location')).toHaveTextContent('/chat/real-chat')); expect(auth.signIn).toHaveBeenCalledExactlyOnceWith('same@example.com','private-password'); });
  it('offers SMS first in the pilot and retains the password option', () => {
    vi.stubEnv('VITE_KOSOLOLA_PHONE_PILOT_ENABLED', 'true');
    login();
    expect(screen.getByLabelText('Número de telefone')).toHaveValue('+244 ');
    expect(screen.getByRole('button', { name: 'Pedir código por SMS' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar com palavra-passe' }));
    expect(screen.getByLabelText('Palavra-passe')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar com o número de telefone' }));
    expect(screen.getByLabelText('Número de telefone')).toBeInTheDocument();
  });
  it('requires a session after SMS verification before opening a protected conversation', async () => {
    vi.stubEnv('VITE_KOSOLOLA_PHONE_PILOT_ENABLED', 'true');
    phoneAuth.signInWithOtp.mockResolvedValueOnce({ error: null });
    phoneAuth.verifyOtp.mockResolvedValueOnce({ data: { session: null }, error: null });
    phoneAuth.verifyOtp.mockResolvedValueOnce({ data: { session: { user: { id: 'same-user' } } }, error: null });
    login();

    const phone = screen.getByLabelText('Número de telefone');
    fireEvent.change(phone, { target: { value: '+351912345678' } });
    expect(screen.getByRole('button', { name: 'Pedir código por SMS' })).toBeDisabled();
    fireEvent.change(phone, { target: { value: '923 000 000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pedir código por SMS' }));
    const code = await screen.findByLabelText('Código recebido por SMS');
    expect(phoneAuth.signInWithOtp).toHaveBeenCalledExactlyOnceWith({
      phone: '+244923000000',
      options: { shouldCreateUser: false },
    });
    fireEvent.change(code, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar código' }));
    await screen.findByText(/Não foi possível concluir/);
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar código' }));
    expect(await screen.findByTestId('location')).toHaveTextContent('/chat/real-chat');
    expect(phoneAuth.verifyOtp).toHaveBeenLastCalledWith({ phone: '+244923000000', token: '123456', type: 'sms' });
  });
  it('links the verified number to the signed-in account without making a directory request', async () => {
    vi.stubEnv('VITE_KOSOLOLA_PHONE_PILOT_ENABLED', 'true');
    phoneAuth.updateUser.mockResolvedValueOnce({ error: null });
    phoneAuth.verifyOtp.mockResolvedValueOnce({ data: {}, error: null });
    render(<PhoneAccess mode="link" surface="kosolola" />);
    fireEvent.change(screen.getByLabelText('Número de telefone'), { target: { value: '+244 923 000 000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pedir código por SMS' }));
    fireEvent.change(await screen.findByLabelText('Código recebido por SMS'), { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar código' }));
    expect(await screen.findByText('Telefone confirmado.')).toBeInTheDocument();
    expect(phoneAuth.updateUser).toHaveBeenCalledExactlyOnceWith({ phone: '+244923000000' });
    expect(phoneAuth.verifyOtp).toHaveBeenLastCalledWith({ phone: '+244923000000', token: '654321', type: 'phone_change' });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
  it('reports a failed login without losing credentials or opening protected content', async () => { auth.signIn.mockResolvedValue({error:{message:'Invalid credentials'}}); login(); submit(); expect(await screen.findByRole('alert')).toHaveTextContent('Dados de acesso incorrectos. Verifica e tenta novamente.'); expect(screen.getByLabelText('E-mail ou nome de utilizador')).toHaveValue('same@example.com'); expect(screen.queryByTestId('location')).not.toBeInTheDocument(); });
});
describe('Papos installation', () => {
  it('keeps its own install identity and does not claim an accepted prompt has completed installation', async () => {
    captureAppInstallPrompt(); const event=new Event('beforeinstallprompt',{cancelable:true}) as InstallPrompt;
    event.prompt=vi.fn().mockResolvedValue(undefined); event.userChoice=Promise.resolve({outcome:'accepted'}); window.dispatchEvent(event);
    render(<MemoryRouter><PaposInstall /></MemoryRouter>); fireEvent.click(screen.getByRole('button',{name:'Instalar KOSOLOLA'}));
    await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Pedido aceite'));
    expect(screen.getByText('Instalar a KOSOLOLA')).toBeInTheDocument(); expect(event.prompt).toHaveBeenCalledOnce();
    expect(screen.getByRole('link',{name:'Continuar no navegador'})).toHaveAttribute('href','/papos');
  });
});
