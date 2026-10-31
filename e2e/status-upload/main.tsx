import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import i18n from 'i18next';import {initReactI18next} from 'react-i18next';
import pt from '../../src/i18n/locales/pt.json';
import {CreateStatusSheet} from '../../src/components/status/CreateStatusSheet';
import {Toaster} from '../../src/components/ui/toaster';
import '../../src/index.css';
i18n.use(initReactI18next).init({lng:'pt',resources:{pt:{translation:pt}},interpolation:{escapeValue:false}});
function App(){const [open,setOpen]=useState(true);return <><button onClick={()=>setOpen(true)}>Novo estado</button><CreateStatusSheet open={open} onOpenChange={setOpen}/><Toaster/></>;}
createRoot(document.getElementById('root')!).render(<App/>);
