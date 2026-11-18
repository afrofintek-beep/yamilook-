import { useEffect, useState } from 'react';
import { ArrowUpRight, KeyRound, LockKeyhole, MapPin, ShieldCheck } from 'lucide-react';
import { accessState, examplePeople, type Grant } from './model';
import { Plan } from './Plan';

export function Residence({ grant, setGrant, showAtelier, setShowAtelier }: {grant: Grant | null; setGrant: (value: Grant) => void; showAtelier: boolean; setShowAtelier: (value: boolean) => void}) {
  const [person, setPerson] = useState(examplePeople[0]);
  const [hours, setHours] = useState(1);
  const [radius, setRadius] = useState(500);
  const [viewer, setViewer] = useState(examplePeople[0]);
  const [distance, setDistance] = useState(1000);
  const [preview, setPreview] = useState(Boolean(grant));
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!grant || grant.revoked) return;
    const refresh = () => setNow(Date.now());
    const timer = window.setTimeout(refresh, Math.max(0, grant.expires - Date.now()) + 5);
    window.addEventListener('focus',refresh);
    return () => { clearTimeout(timer); window.removeEventListener('focus',refresh); };
  }, [grant]);
  const active = grant && !grant.revoked && Math.max(now, Date.now()) < grant.expires;
  const state = accessState(grant, viewer, distance, Math.max(now,Date.now()));
  function invite() {
    const start = Date.now();
    setGrant({person, expires:start + hours * 3600000, radius, revoked:false});
    setNow(start); setViewer(person); setDistance(1000); setPreview(true);
  }
  return <div className="dg-two">
    <section className="dg-box">
      <div className="dg-kicker"><LockKeyhole size={15}/> AFROLOC · Residência de exemplo</div>
      <h2>O meu endereço</h2><p>O cartão desta casa é privado. Escolhe quem pode ver a localização e durante quanto tempo.</p>
      <div className="dg-address"><ShieldCheck size={28}/><div><b>Residência do Dangereux</b><small>Cartão fictício · Privado</small></div></div>
      <h3>Convidar alguém para minha casa</h3>
      <form onSubmit={e=>{e.preventDefault();invite();}}>
        <label>Quem vai visitar?<select value={person} onChange={e=>setPerson(e.target.value)}>{examplePeople.map(p=><option key={p}>{p}</option>)}</select></label>
        <div className="dg-fields"><label>Validade<select value={hours} onChange={e=>setHours(Number(e.target.value))}><option value="1">1 hora</option><option value="24">24 horas</option><option value="168">7 dias</option></select></label>
        <label>Revelar a morada<select value={radius} onChange={e=>setRadius(Number(e.target.value))}>{[100,250,500].map(n=><option key={n} value={n}>A {n} metros</option>)}</select></label></div>
        <button className="dg-btn primary"><KeyRound size={17}/>{active?'Substituir convite de exemplo':'Criar convite de exemplo'}</button>
      </form>
      {grant && <div className="dg-notice" role="status"><strong>{grant.revoked?'Convite revogado':active?'Convite activo':'Convite expirado'}</strong>
        {active && <><span>{grant.person} · Termina em {new Intl.DateTimeFormat('pt-PT',{dateStyle:'short',timeStyle:'short',timeZone:'Africa/Luanda'}).format(grant.expires)} (Luanda).</span><button className="dg-text" onClick={()=>setGrant({...grant,revoked:true})}>Revogar acesso</button></>}</div>}
      <a className="dg-account" href="/afroloc/cartao">Abrir o meu cartão AFROLOC na Yamilook <ArrowUpRight size={16}/></a>
      <p className="dg-fine">Para convidares uma pessoa real, abre o teu cartão, escolhe a pessoa em LOCACCESS e partilha a ligação autorizada.</p>
    </section>
    <div className="dg-stack">
      <section className="dg-box"><div className="dg-kicker"><MapPin size={15}/> LOCACCESS · Simulação neste ecrã</div>
        <h2>Vista do convidado</h2>
        {!preview ? <p>Cria um convite para experimentar a chegada de uma visita. A demonstração usa pessoas e distâncias fictícias.</p> : <>
          <div className="dg-fields"><label>Consultar como<select value={viewer} onChange={e=>setViewer(e.target.value)}>{examplePeople.map(p=><option key={p}>{p}</option>)}</select></label>
          <label>Distância simulada<select value={distance} onChange={e=>setDistance(Number(e.target.value))}>{[1000,500,250,100].map(n=><option value={n} key={n}>{n} m</option>)}</select></label></div>
          <div role="status" className="dg-notice">{state==='closed'?'Acesso fechado para esta visita.':state==='approach'?`Convite válido. A morada será revelada a ${grant!.radius} metros.`:'Visita autorizada. Percurso ilustrativo até à casa.'}</div>
          {state==='open' && <Plan destination="casa"/>}
        </>}
      </section>
      <section className="dg-box"><div className="dg-kicker">Negócio em casa</div><h3>Ateliê Linha da Banda</h3>
        <label className="dg-check"><input type="checkbox" checked={showAtelier} onChange={e=>setShowAtelier(e.target.checked)}/> Mostrar o meu serviço no directório</label>
        <p className="dg-fine">A morada do ateliê fica sempre privada. Experimenta mudar a opção e consultar o directório.</p>
      </section>
    </div>
  </div>;
}
