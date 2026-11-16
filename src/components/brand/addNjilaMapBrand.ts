import L from 'leaflet';
import wordmark from '@/assets/brand/njila-wordmark.svg';

/** Add before zoom so Leaflet stacks the controls without overlap on narrow screens. */
export function addNjilaMapBrand(map: L.Map) {
 const brand = new L.Control({ position: 'topleft' });
 brand.onAdd = () => {
  const badge = L.DomUtil.create('div', 'njila-map-brand');
  Object.assign(badge.style, {
   display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
   padding: '7px 10px', borderRadius: '8px', background: '#f7f4ec',
   border: '1px solid #1f403726', boxShadow: '0 2px 8px #17231f26',
   pointerEvents: 'none', userSelect: 'none',
  });
  const logo = document.createElement('img');
  logo.src = wordmark;
  logo.alt = 'NJILA';
  logo.width = 78;
  logo.height = 24;
  logo.draggable = false;
  const owner = document.createElement('span');
  owner.textContent = 'AFROFINTEK GmbH';
  Object.assign(owner.style, { color: '#1f4037', fontSize: '9px', lineHeight: '12px', letterSpacing: '0.3px' });
  badge.append(logo, owner);
  return badge;
 };
 brand.addTo(map);
 return brand;
}
