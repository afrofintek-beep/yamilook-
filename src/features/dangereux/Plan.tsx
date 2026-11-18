import { Compass, Flag, LocateFixed } from 'lucide-react';
import { useId } from 'react';
import njila from '@/assets/brand/njila-wordmark.svg';
import { entrance, home, junction, places, square, type PlaceId, type Point } from './model';

type Props = { destination?: PlaceId | 'casa'; onSelect?: (id: PlaceId) => void };
const asLine = (points: Point[]) => points.map(point => point.join(',')).join(' ');
const streets = [
  'M-40 265 L520 100 L630 46', 'M-35 139 L495 -17', 'M1 345 L574 173',
  'M-25 75 L235 -3', 'M342 319 L630 233', 'M102 324 L27 60 L8 -5',
  'M250 309 L160 -5', 'M394 330 L309 -15', 'M535 304 L440 -18',
];
const blocks = Array.from({ length: 145 }, (_, i) => {
  const row = Math.floor(i / 17), col = i % 17;
  return { x: col * 44 - 98 + (row % 2) * 7, y: row * 48 - 102, width: 21 + (i * 13) % 17, height: 17 + (i * 7) % 19 };
});

export function Plan({ destination, onSelect }: Props) {
  const pattern = useId().replace(/:/g, '');
  const chosen = places.find(place => place.id === destination);
  const isVisit = destination === 'casa';
  const route = isVisit ? [entrance, square, junction, home] : chosen?.point ? [entrance, ...(chosen.via ?? []), chosen.point] : [];
  const label = isVisit ? 'Residência de demonstração' : chosen?.name;
  return <figure className="dg-map">
    <div className="dg-map-top"><span><i /> Mapa do bairro</span><span><Compass size={15} /> N</span></div>
    <svg className="dg-plan" viewBox="0 0 560 300" aria-label="Planta ilustrativa do bairro" role="group">
      <defs><pattern id={pattern} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><line x1="0" y1="0" x2="0" y2="9" stroke="#a4c49a" strokeWidth="2" /></pattern></defs>
      <rect width="560" height="300" fill="#e7e4d1" />
      <g transform="rotate(-16 280 148)">{blocks.map((b, i) => <g key={i}><rect {...b} rx="2" fill={['#d2c4a7','#d6c6a8','#c9c7aa','#d9cdb5','#d5c5a9'][i % 5]} stroke="#c2b595" strokeWidth="1" /><path d={`M${b.x+3} ${b.y+b.height/2}h${b.width-6}`} stroke="#ece3cc" strokeWidth="1.7" /></g>)}</g>
      <path d="M0 0H158L144 18 97 28 81 47 44 58 19 85 0 113Z" fill="#b0c5a1" /><path d="M0 0H158L144 18 97 28 81 47 44 58 19 85 0 113Z" fill={`url(#${pattern})`}/>
      <path d="M560 218L513 234 486 261 433 279 421 300H560Z" fill="#b4c7a5"/>
      <g fill="none" strokeLinejoin="round">{streets.map((d, i) => <g key={d}><path d={d} stroke="#bea987" strokeWidth={i === 0 ? 15 : 9}/><path d={d} stroke={i === 0 ? '#fff5d5' : '#f6f2dc'} strokeWidth={i === 0 ? 12 : 7}/></g>)}</g>
      <path d="M-8 76Q96 51 140 -3" stroke="#76aaa0" strokeWidth="7" fill="none"/>
      <path d="M-8 76Q96 51 140 -3" stroke="#b6d7c8" strokeWidth="2" fill="none"/>
      <g className="dg-streetnames"><text x="100" y="153" transform="rotate(-16 100 153)">ZONA POENTE</text><text x="245" y="242" transform="rotate(-16 245 242)">ZONA CENTRAL</text><text x="394" y="61" transform="rotate(-16 394 61)">ZONA NASCENTE</text></g>
      {route.length > 0 && <g fill="none" strokeLinejoin="round" strokeLinecap="round"><polyline points={asLine(route)} stroke="#fff" strokeWidth="9"/><polyline points={asLine(route)} stroke="#ac4e27" strokeWidth="5" strokeDasharray="8 5"/><circle cx={entrance[0]} cy={entrance[1]} r="7" fill="#fff" stroke="#ac4e27" strokeWidth="3"/></g>}
      {places.filter(p=>p.point).map(place => {
        const [x,y] = place.point!;
        const selected = chosen?.id === place.id;
        const action = onSelect ? () => onSelect(place.id) : undefined;
        return <g key={place.id} transform={`translate(${x} ${y})`} className={action?'dg-pin active':'dg-pin'} role={action?'button':'img'} aria-label={`Ver ${place.name}`} tabIndex={action ? 0 : undefined} onClick={action}
          onKeyDown={e=>{if(action && (e.key === 'Enter' || e.key === ' ')){e.preventDefault();action();}}}>
          <title>{place.name}</title><circle r="20" fill="transparent"/><circle r={selected?17:13} fill={selected?'#ae4d28':'#1e5145'} stroke="#fff9e7" strokeWidth="2"/>
          <text y="4.3" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">{String(places.indexOf(place)+1).padStart(2,'0')}</text>
        </g>;
      })}
      {isVisit && <g><circle cx={home[0]} cy={home[1]} r="11" fill="#ae4d28" stroke="#fff" strokeWidth="3"/><text x={home[0]+15} y={home[1]+4} fill="#163e34" fontSize="11" fontWeight="700">Visita</text></g>}
    </svg>
    <figcaption><img src={njila} alt="NJILA"/><span>{route.length ? <Flag size={13}/> : <LocateFixed size={13}/>} {label ? `Destino · ${label}` : 'Planta ilustrativa'}</span></figcaption>
  </figure>;
}
