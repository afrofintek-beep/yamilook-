import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, Compass, Croissant, Home, Landmark, LockKeyhole, MapPin, Route, Scissors, Search, ShoppingBasket, Store, Users, Wrench, X } from 'lucide-react';
import { Plan } from './Plan';
import { Residence } from './Residence';
import { cases, places, type Grant, type PlaceId, type Review } from './model';
import './piloto.css';

const tabs = [{ id:'explorar', name:'Explorar o bairro', Icon:Compass }, { id:'morador', name:'O meu endereço', Icon:Home }, { id:'administracao', name:'Administração', Icon:Landmark }] as const;
type Tab = typeof tabs[number]['id'];
const icons = {padaria:Croissant,mercado:ShoppingBasket,oficina:Wrench,espaco:Users,atelie:Scissors};
function readTab(): Tab {
  return tabs.find(t => '#'+t.id === window.location.hash)?.id ?? 'explorar';
}

function Pilot() {
  const [tab,setTab] = useState<Tab>(readTab);
  const [selected,setSelected] = useState<PlaceId>();
  const [category,setCategory] = useState('Todos');
  const [query,setQuery] = useState('');
  const [atelier,setAtelier] = useState(true);
  const [grant,setGrant] = useState<Grant | null>(null);
  const [reviews,setReviews] = useState<Record<string, Review>>({});
  const [pickedCase,setPickedCase] = useState('');
  const plan = useRef<HTMLDivElement>(null);
  const mainHeading = useRef<HTMLHeadingElement>(null);
  const activePlace = places.find(p=>p.id === selected);
  useEffect(()=>{
    const onHash = () => {setTab(readTab()); setSelected(undefined);};
    window.addEventListener('hashchange',onHash);
    return ()=>window.removeEventListener('hashchange',onHash);
  },[]);
  function changeTab(value: Tab) {
    if(window.location.hash !== '#'+value) window.location.hash = value;
    setTab(value); setSelected(undefined);
    window.scrollTo({top:0});
    requestAnimationFrame(()=>mainHeading.current?.focus({preventScroll:true}));
  }
  function openRoute(id: PlaceId) {
    setSelected(id);
    if (id !== 'atelie') requestAnimationFrame(()=>{
      plan.current?.scrollIntoView({block:'center',behavior:'instant'});
      plan.current?.focus({preventScroll:true});
    });
  }
  const visiblePlaces = places.filter(p=>p.id !== 'atelie' || atelier);
  const normalise = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const filtered = visiblePlaces.filter(p=>(category === 'Todos' || p.category === category) && normalise([p.name,p.info,p.category,p.zone].join(' ')).includes(normalise(query.trim())));
  const metrics = [
    {Icon: Home, label: 'Residências registadas', value: 18},
    {Icon: Store, label: 'Negócios e equipamentos', value: places.length},
    {Icon: BookOpen, label: 'Pedidos por analisar', value: cases.filter(c => !reviews[c.id]).length},
  ];
  const heading = tab==='explorar'?'Dangereux':tab==='morador'?'Área do morador':'Administração do bairro';
  return <div className="dg-root">
    <a className="dg-skip" href="#dg-content" onClick={e=>{e.preventDefault();document.getElementById("dg-content")?.focus();}}>Saltar para o conteúdo</a>
    <header className="dg-header"><div className="dg-wrap dg-mast">
      <a className="dg-brand" href="/dangereux/" aria-label="Dangereux, início"><span className="dg-seal"><Landmark size={21}/></span><b>Bairro Digital</b></a>
      <span className="dg-project">Projecto-piloto AFROFINTEK</span>
      <a className="dg-yami" href="/"><img src="/yamilook-logo.png" alt="Yamilook"/><ArrowUpRight size={15}/></a>
    </div></header>
    <div className="dg-nav-bg"><nav className="dg-wrap dg-nav" aria-label="Áreas do bairro">{tabs.map(({id,name,Icon})=><a key={id} href={'#'+id} aria-current={tab===id?'page':undefined} onClick={e=>{e.preventDefault();changeTab(id);}}><Icon size={17}/>{name}</a>)}</nav></div>
    <main id="dg-content" tabIndex={-1}>
      <div className={'dg-hero '+(tab==='explorar'?'':'dg-short')}><div className="dg-wrap dg-hero-in">
        <div className="dg-intro"><div className="dg-overline"><span/> Talatona <ChevronRight size={12}/> {tab==='explorar'?'Bairro digital':'Dangereux'}</div>
          <h1 ref={mainHeading} tabIndex={-1}>{heading}</h1>
          {tab==='explorar' ? <><div className="dg-subhead">Administração Digital do Bairro</div>
            <p>Encontra quem presta serviços no bairro. Decide quem pode chegar à tua porta.</p>
            <div className="dg-actions"><button className="dg-btn gold" onClick={()=>openRoute('padaria')}><Route size={18}/>Encontrar uma padaria</button>
            <button className="dg-btn on-dark" onClick={()=>changeTab('morador')}><Home size={17}/>Convidar alguém</button></div>
            <small className="dg-sample">Demonstração com locais e percursos fictícios.</small>
          </> : <p>{tab==='morador'?'Experimenta o cartão AFROLOC e as autorizações de visita.':'Consulta indicadores e acompanha pedidos de validação fictícios.'}</p>}
        </div>
        {tab==='explorar' && <div className="dg-map-slot" ref={plan} tabIndex={-1} aria-label="Mapa e percurso"><Plan destination={activePlace?.point ? activePlace.id : undefined} onSelect={openRoute}/>
        {activePlace?.point && <div className="dg-route-info" role="status"><div><strong>{activePlace.name}</strong><span>AFROLOC · {activePlace.reference}</span><p>{activePlace.directions}</p></div><button aria-label="Fechar percurso" onClick={()=>setSelected(undefined)}><X size={18}/></button></div>}</div>}
      </div></div>
      <div className="dg-wrap dg-content">
        {tab==='explorar' && <><div className="dg-sectionhead"><div><div className="dg-kicker"><span className="dg-rule"/> Directório público</div><h2>Locais e serviços</h2></div><label className="dg-search"><Search size={17}/><input aria-label="Procurar no directório" value={query} placeholder="Procurar no bairro" onChange={e=>setQuery(e.target.value)}/></label></div>
          <div className="dg-filter" aria-label="Categorias">{['Todos','Comércio','Serviços','Comunidade'].map(value=><button key={value} aria-pressed={category===value} onClick={()=>setCategory(value)}>{value}</button>)}<small aria-live="polite">{filtered.length} {filtered.length===1?'resultado':'resultados'}</small></div>
          <div className="dg-directory">{filtered.map(place=>{const Icon = icons[place.id];return <article key={place.id} className="dg-place">
            <div className="dg-cardtop"><span className={'dg-icon '+place.id}><Icon size={22}/></span><small>{place.category}</small></div><h3>{place.name}</h3><div className="dg-zone">{place.point?<MapPin size={13}/>:<LockKeyhole size={13}/>} {place.zone}</div><p>{place.info}</p>
            {place.point?<button className="dg-text" onClick={()=>openRoute(place.id)}>Como chegar <ArrowUpRight size={16}/></button>:<button className="dg-text" onClick={()=>changeTab('morador')}>Ver como funciona a privacidade <ArrowRight size={15}/></button>}
          </article>})}</div>
          {filtered.length===0 && <div className="dg-box"><h3>Nenhum local encontrado</h3><button className="dg-text" onClick={()=>{setCategory('Todos');setQuery('');}}>Limpar pesquisa e filtros</button></div>}
        </>}
        {tab==='morador' && <Residence grant={grant} setGrant={setGrant} showAtelier={atelier} setShowAtelier={setAtelier}/>}
        {tab==='administracao' && <><div className="dg-kicker"><span className="dg-rule"/> Painel de demonstração</div><h2>Cadastro do bairro</h2><p className="dg-fine">Os registos são fictícios. As decisões que experimentares duram até recarregares a página.</p>
          <div className="dg-metrics">{metrics.map(({Icon,label,value})=><div key={label} className="dg-box"><Icon size={20}/><b>{value}</b><span>{label}</span></div>)}</div>
          <div className="dg-two admin"><section className="dg-box"><h3>Pedidos de validação</h3><p>Selecciona um pedido para simular a decisão do operador.</p>{cases.map(c=><div className="dg-case" key={c.id}><div><b>{c.kind} · {c.id}</b><small>{c.zone} · {reviews[c.id]||'Por analisar'}</small></div>{!reviews[c.id]&&<button className="dg-text" aria-expanded={pickedCase===c.id} onClick={()=>setPickedCase(pickedCase===c.id?'':c.id)}>Analisar <ChevronRight size={14}/></button>}
          {pickedCase===c.id && <div className="dg-caseactions">{(['Validado','Em revisão'] as const).map(status=><button key={status} className="dg-btn pale" onClick={()=>{setReviews({...reviews,[c.id]:status});setPickedCase('');}}>{status==='Validado'?<Check size={15}/>:<ArrowLeft size={15}/>} {status==='Validado'?'Validar':'Pedir revisão'}</button>)}</div>}</div>)}</section>
          <section className="dg-box"><div className="dg-kicker">Residências</div><h3>Distribuição por zona</h3>{[['Zona central',8],['Zona nascente',6],['Zona poente',4]].map(([name,num])=><div key={name} className="dg-meter"><div>{name}<b>{num}</b></div><span><i style={{width:`${Number(num)/8*100}%`}}/></span></div>)}<p className="dg-fine">O painel apresenta totais por zona. Os nomes, as moradas e as autorizações individuais ficam privados.</p></section></div></>}
      </div>
    </main>
    <footer className="dg-footer"><div className="dg-wrap"><span>AFROFINTEK <i/> Yamilook · AFROLOC · NJILA · LOCACCESS</span><a href="/"><ArrowLeft size={14}/> Voltar à Yamilook</a></div></footer>
  </div>;
}
createRoot(document.getElementById('bairro')!).render(<Pilot/>);
