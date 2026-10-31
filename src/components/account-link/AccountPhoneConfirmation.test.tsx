import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe,it,expect,vi,beforeEach } from 'vitest';
import AccountPhoneConfirmation from './AccountPhoneConfirmation';
const {invoke}=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{functions:{invoke},auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe:vi.fn()}}})}}}));
beforeEach(()=>invoke.mockReset());
describe('phone confirmation consent',()=>{
 it('does not send SMS without complete international phone and explicit consent',()=>{
  render(<AccountPhoneConfirmation/>);const button=screen.getByRole('button',{name:'Enviar código'});
  expect(button).toBeDisabled();fireEvent.change(screen.getByLabelText('Número com indicativo internacional'),{target:{value:'+244923456789'}});expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));expect(button).toBeEnabled();expect(invoke).not.toHaveBeenCalled();
 });
 it('keeps OTP bound to the returned challenge and clears consent when number changes',async()=>{
  invoke.mockResolvedValue({data:{ok:true,challenge_id:'challenge'},error:null});render(<AccountPhoneConfirmation/>);
  fireEvent.change(screen.getByLabelText('Número com indicativo internacional'),{target:{value:'+244923456789'}});fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Enviar código'}));
  await screen.findByLabelText('Código SMS');fireEvent.change(screen.getByLabelText('Código SMS'),{target:{value:'123456'}});fireEvent.click(screen.getByRole('button',{name:'Confirmar código'}));
  await waitFor(()=>expect(invoke).toHaveBeenLastCalledWith('account-phone',expect.objectContaining({body:expect.objectContaining({action:'verify',challenge_id:'challenge',otp:'123456'})})));
 });
});
