import { uiText } from '@/i18n/ui-copy';
import { childrenOf, type AdministrativeAddress } from '@/lib/angola-administrative';
interface Props {value:AdministrativeAddress;onChange:(v:AdministrativeAddress)=>void;disabled?:boolean}
export function AdministrativeFields({value:a,onChange,disabled}:Props){
 const communes=childrenOf(a.municipality,3);
 const cls='w-full rounded-xl border bg-background px-3 py-3 text-base';
 return <fieldset disabled={disabled} className="space-y-4 min-w-0">
  {([
   ['province',uiText('Província'),childrenOf('',1),false],
   ['municipality',uiText('Município'),childrenOf(a.province,2),!a.province],
   ['commune',uiText('Comuna'),communes,!a.municipality||!communes.length],
  ] as const).map(([key,label,items,off])=><label key={key} className="block text-sm">{label}<select className={cls} value={a[key]} disabled={off} onChange={e=>onChange({...a,[key]:e.target.value,...(key==='province'?{municipality:'',commune:''}:key==='municipality'?{commune:''}:{})})}><option value="">{key==='commune'&&a.municipality&&!communes.length?uiText('Sem comunas'):uiText('Selecciona uma opção')}</option>{items.map(d=><option key={d.code} value={d.code}>{d.name}</option>)}</select></label>)}
 </fieldset>;
}
