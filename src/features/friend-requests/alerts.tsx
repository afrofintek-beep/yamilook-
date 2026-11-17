import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { Button } from '@/components/ui/button';
const Alerts = createContext({count:0,revision:0,refresh:()=>{}});
export const useFriendRequestAlerts = () => useContext(Alerts);
export function FriendRequestAlerts({children}:{children:ReactNode}) {
 useUiLocale();
 const {user}=useAuth(); const {settings}=useSettings(); const navigate=useNavigate(); const location=useLocation();
 const context=useRef({path:location.pathname,enabled:settings?.notifications_enabled!==false});
 context.current={path:location.pathname,enabled:settings?.notifications_enabled!==false};
 const [state,setState]=useState({count:0,revision:0});
 const refreshRef=useRef(()=>{});
 useEffect(()=>{
  setState({count:0,revision:0});
  if(!user) return;
  let disposed=false,version=0,signature='',toastId:string|number|undefined;
  const seen=new Set<string>();
  const refresh=async()=>{
   if(document.hidden) return;
   const current=++version;
   const {data,error,count}=await supabase.from('friend_requests').select('id,updated_at',{count:'exact'}).eq('receiver_id',user.id).eq('status','pending').order('created_at',{ascending:false}).limit(100);
   if(disposed||current!==version||error||!data)return;
   const next=JSON.stringify([count,data]);
   if(next===signature)return;
   signature=next;
   setState(prev=>({count:count??data.length,revision:prev.revision+1}));
   const fresh=data.some(row=>!seen.has(row.id));
   data.forEach(row=>seen.add(row.id));
   if(fresh&&context.current.enabled&&context.current.path!=='/notifications'){
    if(toastId!==undefined)toast.dismiss(toastId);
    toastId=toast(uiText('Pedidos de amizade'),{description:uiText('Tens {{count}} pedido(s) de amizade por responder.',{count:count??data.length}),duration:10000,action:{label:uiText('Ver pedidos'),onClick:()=>navigate('/notifications?tab=requests')}});
   }
  };
  refreshRef.current=()=>{void refresh();};
  const channel=supabase.channel(`friend-alerts-${user.id}`).on('postgres_changes',{event:'*',schema:'public',table:'friend_requests',filter:`receiver_id=eq.${user.id}`},()=>void refresh()).subscribe(status=>{if(status==='SUBSCRIBED')void refresh();});
  void refresh();
  const timer=setInterval(()=>void refresh(),60000);
  const onResume=()=>void refresh();
  window.addEventListener('focus',onResume);window.addEventListener('online',onResume);window.addEventListener('friend-requests-changed',onResume);document.addEventListener('visibilitychange',onResume);
  return()=>{disposed=true;++version;refreshRef.current=()=>{};clearInterval(timer);void supabase.removeChannel(channel);if(toastId!==undefined)toast.dismiss(toastId);window.removeEventListener('focus',onResume);window.removeEventListener('online',onResume);window.removeEventListener('friend-requests-changed',onResume);document.removeEventListener('visibilitychange',onResume);};
 },[user?.id,navigate]);
 return <Alerts.Provider value={{...state,refresh:()=>refreshRef.current()}}>{children}</Alerts.Provider>;
}
export function FriendNotificationBell(){
 const {count}=useFriendRequestAlerts(); const navigate=useNavigate();useUiLocale();
 return <Button variant="ghost" size="icon" className="relative h-11 w-11 shrink-0 rounded-full" aria-label={count?uiText('Tens {{count}} pedido(s) de amizade por responder.',{count}):uiText('Notificações')} onClick={()=>navigate('/notifications')}><Bell className="h-5 w-5"/>{count>0&&<span aria-hidden="true" className="absolute end-0 top-0 min-w-4 rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">{count>99?'99+':count}</span>}</Button>;
}
