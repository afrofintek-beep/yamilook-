import {uiText as t,useUiLocale} from '@/i18n/ui-copy';
import {addNjilaMapBrand} from '@/components/brand/addNjilaMapBrand';
import {useEffect,useRef,useState} from 'react';import L from 'leaflet';import 'leaflet/dist/leaflet.css';
export type MapPoint={lat:number;lon:number};
export function AccessMap({point,approximate=false}:{point:MapPoint;approximate?:boolean}){
 const locale=useUiLocale();
 const [satellite, setSatellite] = useState(false);
 const layers=useRef<{map:L.Map;streets:L.TileLayer;imagery:L.TileLayer}|null>(null);
 const host=useRef<HTMLDivElement>(null);const [error,setError]=useState('');
 useEffect(()=>{if(!host.current)return;setError('');
  const map=L.map(host.current,{scrollWheelZoom:false,zoomControl:false}).setView([point.lat,point.lon],approximate?13:18);
  addNjilaMapBrand(map);
  L.control.zoom({zoomInTitle:t('Aproximar'),zoomOutTitle:t('Afastar')}).addTo(map);
  const streets=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'});
  const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri — Esri, Maxar, Earthstar Geographics, GIS User Community'});
  for(const layer of [streets,satellite]){layer.on('tileerror',()=>setError('Algumas imagens não carregaram. Tenta a outra vista.'));layer.on('tileload',()=>setError(''));}
  layers.current={map,streets,imagery:satellite};
  if(approximate)L.circle([point.lat,point.lon],{radius:2000,color:'#c29b32',fillOpacity:0.12}).addTo(map);
  else L.circleMarker([point.lat,point.lon],{radius:10,color:'#fff',weight:3,fillColor:'#c29b32',fillOpacity:1}).addTo(map).bindTooltip(t('Endereço AFROLOC'));
  const resize=new ResizeObserver(()=>map.invalidateSize());resize.observe(host.current);
  return()=>{layers.current=null;resize.disconnect();map.remove()};
 },[point.lat,point.lon,approximate,locale]);
 useEffect(()=>{
  if(!layers.current)return;
  const {map,streets,imagery}=layers.current;
  const layer=satellite?imagery:streets;
  layer.addTo(map);
  return ()=>{layer.remove()};
 },[satellite,point.lat,point.lon,approximate,locale]);
 const title = t(approximate ? 'Área aproximada' : 'Localização AFROLOC');
 const mapStyle = {height:'min(60dvh, 480px)', minHeight:300, width:'100%'};
 return <>
  <div className="relative isolate">
   <div ref={host} role="region" aria-label={title}
    className="isolate overflow-hidden rounded-xl border" style={mapStyle} />
   <button type="button" title={t(satellite?'Mapa':'Satélite')}
    className="absolute left-1/2 top-3 z-10 inline-flex min-h-11 items-center gap-1 px-2.5 -translate-x-1/2 rounded-full border-2 border-emerald-900 bg-white text-xs font-semibold text-emerald-900 shadow "
    onClick={()=>setSatellite(value=>!value)}>
    <span aria-hidden="true">•</span>{t(satellite?'Mapa':'Satélite')}
   </button>
  </div>
  {error && <p role="status" className="text-sm">{t(error)}</p>}
 </>;
}
