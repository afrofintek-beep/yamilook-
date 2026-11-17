import {uiText as t,useUiLocale} from '@/i18n/ui-copy';
import {addNjilaMapBrand} from '@/components/brand/addNjilaMapBrand';
import {useEffect,useRef,useState} from 'react';import L from 'leaflet';import 'leaflet/dist/leaflet.css';
export type MapPoint={lat:number;lon:number};
export function AccessMap({point,approximate=false}:{point:MapPoint;approximate?:boolean}){
 const locale=useUiLocale();
 const host=useRef<HTMLDivElement>(null);const [error,setError]=useState('');
 useEffect(()=>{if(!host.current)return;setError('');
  const map=L.map(host.current,{scrollWheelZoom:false,zoomControl:false}).setView([point.lat,point.lon],approximate?13:18);
  addNjilaMapBrand(map);
  L.control.zoom({zoomInTitle:t('Aproximar'),zoomOutTitle:t('Afastar')}).addTo(map);
  const streets=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'});
  const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri — Esri, Maxar, Earthstar Geographics, GIS User Community'});
  for(const layer of [streets,satellite]){layer.on('tileerror',()=>setError('Algumas imagens não carregaram. Tenta a outra vista.'));layer.on('tileload',()=>setError(''));}
  streets.addTo(map);L.control.layers({[t('Mapa')]:streets,[t('Satélite')]:satellite},undefined,{collapsed:false}).addTo(map);
  if(approximate)L.circle([point.lat,point.lon],{radius:2000,color:'#c29b32',fillOpacity:0.12}).addTo(map);
  else L.circleMarker([point.lat,point.lon],{radius:10,color:'#fff',weight:3,fillColor:'#c29b32',fillOpacity:1}).addTo(map).bindTooltip(t('Endereço AFROLOC'));
  const resize=new ResizeObserver(()=>map.invalidateSize());resize.observe(host.current);
  return()=>{resize.disconnect();map.remove()};
 },[point.lat,point.lon,approximate,locale]);
 return <><div ref={host} role="region" aria-label={t(approximate?'Área aproximada':'Localização AFROLOC')} className="isolate overflow-hidden rounded-xl border" style={{height:'min(60dvh, 480px)',minHeight:300,width:'100%'}}/>{error&&<p role="status" className="text-sm">{t(error)}</p>}</>;
}
