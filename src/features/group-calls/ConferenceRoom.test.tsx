import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ConferenceRoom from './ConferenceRoom';
vi.mock('@/integrations/supabase/client',()=>({supabase:{}}));
const m=vi.hoisted(()=>({end:vi.fn(),leave:vi.fn()}));
vi.mock('react-i18next',()=>({useTranslation:()=>({t:(key:string,opts?:{count?:number})=>opts?.count!==undefined?`Participants: ${opts.count}`:key})}));
vi.mock('@tanstack/react-query',()=>({useQuery:()=>({data:[{id:'a',display_name:'Ana Silva',avatar_url:'https://example.com/ana.jpg'},{id:'b',display_name:'Jessica Silva',avatar_url:null},{id:'c',display_name:'Antonio Henriques Silva',avatar_url:null}]})}));
vi.mock('@/components/ui/avatar',()=>({Avatar:({children}:any)=><div>{children}</div>,AvatarImage:({src,alt}:any)=>src?<img src={src} alt={alt}/>:null,AvatarFallback:({children}:any)=><span>{children}</span>}));
const participants=['a','b','c'].map(identity=>({identity:identity+':device',name:'Old name',getTrackPublication:()=>null,isSpeaking:identity==='c',isMicrophoneEnabled:true}));
function show(){return render(<ConferenceRoom conference={{id:'conf',name:'KOSOLOLA',created_at:new Date(Date.now()-65000).toISOString(),call_type:'voice'} as any} media={{participants,room:{localParticipant:participants[0]},connection:'connected',loading:false,toggle:vi.fn()} as any} onEnd={m.end} onLeave={m.leave} onInvite={vi.fn()} onMessages={vi.fn()} onMinimize={vi.fn()} onRetry={vi.fn()}/>);}
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('uses profile photos and full names, initials from first and last names, and no duplicate speaker tile',()=>{
 show();expect(screen.getByRole('img',{name:'Ana Silva'})).toHaveAttribute('src','https://example.com/ana.jpg');
 expect(screen.getAllByRole('button',{name:'Antonio Henriques Silva'})).toHaveLength(1);
 expect(screen.getByText('JS')).toBeInTheDocument();expect(screen.getAllByText('AS')).toHaveLength(2);
 expect(screen.getByText(/Participants: 3/)).toBeInTheDocument();expect(screen.getByText(/01:05/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Antonio Henriques Silva'}));
 expect(screen.getAllByRole('button',{name:'Antonio Henriques Silva'})).toHaveLength(1);
 expect(screen.getByRole('button',{name:'Antonio Henriques Silva'})).toHaveAttribute('aria-pressed','true');
});
it('labels controls and requires confirmation to end for everyone, while leaving is separate',()=>{
 show();expect(screen.getByText('groupCalls.addParticipant')).toBeInTheDocument();expect(screen.getByText('groupCalls.messages')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'groupCalls.endAll'}));expect(m.end).not.toHaveBeenCalled();
 expect(screen.getByRole('alertdialog')).toBeInTheDocument();fireEvent.click(screen.getByText('common.cancel'));expect(m.end).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'groupCalls.endAll'}));
 fireEvent.click(screen.getAllByRole('button',{name:'groupCalls.endAll'})[0]);expect(m.end).toHaveBeenCalledOnce();
});
