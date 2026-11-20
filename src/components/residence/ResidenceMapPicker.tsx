import {addNjilaMapBrand} from '@/components/brand/addNjilaMapBrand';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { uiText as t, useUiLocale } from '@/i18n/ui-copy';

type Point = {lat:number;lng:number};
interface Props {place?:boolean; point?:Point; onChange:(point:Point)=>void; disabled?:boolean}
/** A declared home point, never the current device location. No point is selected by default. */
export default function ResidenceMapPicker({point,onChange,disabled=false,place=false}:Props) {
 const locale=useUiLocale();
 const container=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),marker=useRef<L.Marker|null>(null);
 const callbacks=useRef({onChange,disabled});callbacks.current={onChange,disabled};
 const tilesReady=useRef(false);
 const initial=useRef(point),[zoom,setZoom]=useState(point?18:11),[error,setError]=useState('');
 const [loaded,setLoaded]=useState(false);
 const select=useRef<(p:Point)=>void>(()=>{});
 useEffect(()=>{
  if(!container.current)return;
  const m=L.map(container.current,{zoomControl:false,scrollWheelZoom:false,maxZoom:19,minZoom:5,maxBounds:[[-19,10],[-3,25]],maxBoundsViscosity:1}).setView(initial.current||{lat:-8.839,lng:13.289},initial.current?18:11);
  map.current=m;
  addNjilaMapBrand(m);
  L.control.zoom({zoomInTitle:t('Aproximar'),zoomOutTitle:t('Afastar')}).addTo(m);
  const streets=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'});
  const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, GIS User Community'});
  for(const layer of [streets,satellite]){
   layer.on('tileload',()=>{tilesReady.current=true;setLoaded(true);setError('');});
   layer.on('tileerror',()=>setError(t('Algumas imagens do mapa não carregaram. Tenta a outra vista ou volta mais tarde.')));
  }
  streets.addTo(m);
  L.control.layers({[t('Mapa')]:streets,[t('Satélite')]:satellite},undefined,{collapsed:false}).addTo(m);
  const icon=L.divIcon({className:'',html:'<span style="display:block;width:24px;height:24px;background:#d2aa2e;border:3px solid #fff;border-radius:50%;box-shadow:0 1px 6px #0009"></span>',iconSize:[24,24],iconAnchor:[12,12]});
  select.current=p=>{
   if(callbacks.current.disabled||!tilesReady.current||m.getZoom()<17)return;
   if(p.lat< -18.1||p.lat> -4.3||p.lng<11.3||p.lng>24.1){setError(t(place?'Selecciona um local em Angola.':'Selecciona uma residência em Angola.'));return;}
   callbacks.current.onChange({lat:p.lat,lng:p.lng});
  };
  m.on('click',(e:L.LeafletMouseEvent)=>select.current(e.latlng));
  m.on('zoomend',()=>setZoom(m.getZoom()));
  marker.current=L.marker(initial.current||m.getCenter(),{icon,interactive:false});
  if(initial.current)marker.current.addTo(m);
  const resize=new ResizeObserver(()=>m.invalidateSize());resize.observe(container.current);
  return()=>{resize.disconnect();m.remove();map.current=null;marker.current=null;};
 },[locale,place]);
 useEffect(()=>{if(!map.current||!marker.current)return;if(point)marker.current.setLatLng(point).addTo(map.current);else marker.current.remove();},[point,locale]);
 return <div className="space-y-2">
  <p className="text-sm">{t(place?'Aproxima o mapa e toca no local que pretendes cadastrar.':'Arrasta o mapa até à tua casa, aproxima e toca no edifício. Podes alternar entre mapa e satélite.')}</p>
  <div className="relative isolate overflow-hidden rounded-xl border">
   <div ref={container} role="region" aria-label={t(place?'Seleccionar local no mapa NJILA':'Seleccionar residência no mapa')} style={{height:320,width:'100%'}}/>
   <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-1/2 text-2xl font-bold text-black" style={{textShadow:'0 0 3px white'}}>+</span>
   {disabled&&<div className="absolute inset-0 z-[1000] bg-background/40"/>}
  </div>
  <Button type="button" variant="outline" className="w-full h-auto whitespace-normal" disabled={disabled||zoom<17||!loaded} onClick={()=>{if(map.current)select.current(map.current.getCenter());}}>{t(place?'Marcar o local no centro do mapa':'Marcar a casa no centro do mapa')}</Button>
  <p role="status" className="text-xs text-muted-foreground">{place?t(zoom<17?'Aproxima o mapa para marcar o ponto.':point?'Ponto seleccionado.':'Toca no local para marcar o ponto.'):t(zoom<17?'Aproxima o mapa até veres a casa para marcar o ponto.':point?'Ponto seleccionado. Confirma abaixo que é a tua residência.':'Toca na tua casa para seleccionar o ponto.')}</p>
  {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
 </div>;
}
