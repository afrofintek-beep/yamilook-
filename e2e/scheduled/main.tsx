import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ScheduleCallSheet} from '../../src/components/calls/ScheduleCallSheet';
import {Toaster} from '../../src/components/ui/toaster';
import '../../src/index.css';
function App(){const [open,setOpen]=useState(true);return <><button onClick={()=>setOpen(true)}>Novo agendamento</button><ScheduleCallSheet open={open} onOpenChange={setOpen}/><Toaster/></>;}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><App/></QueryClientProvider>);
