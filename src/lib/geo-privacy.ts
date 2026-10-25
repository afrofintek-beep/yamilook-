// Quantiza coordenadas numa grelha Web Mercator nominal de 10 m antes do envio.
// Reduz a precisão, mas não anonimiza a localização nem certifica um endereço
// AFROLOC. Uma célula pode identificar uma residência; a partilha exige consentimento.

const EARTH_RADIUS = 6378137;
const MAX_LAT = 85.0511287798;
const GRID_M = 10; // resolução da célula (10 m)

function toMercator(lat: number, lng: number): { x: number; y: number } {
  const cl = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  return {
    x: EARTH_RADIUS * (lng * Math.PI / 180),
    y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + cl * Math.PI / 360)),
  };
}
function fromMercator(x: number, y: number): { lat: number; lng: number } {
  return {
    lng: (x / EARTH_RADIUS) * (180 / Math.PI),
    lat: (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * (180 / Math.PI),
  };
}

/** Centróide da célula da grelha (~10 m) que contém a coordenada. Idempotente. */
export function snapToGrid(lat: number, lng: number, gridM: number = GRID_M): { lat: number; lng: number } {
  const { x, y } = toMercator(lat, lng);
  const snap = (m: number) => {
    const idx = Math.floor(Math.abs(m) / gridM);
    const centered = (idx + 0.5) * gridM;
    return m < 0 ? -centered : centered;
  };
  return fromMercator(snap(x), snap(y));
}

/** Versão null-safe para payloads. */
export function snapCoords(
  lat: number | null | undefined,
  lng: number | null | undefined,
): { lat: number | null; lng: number | null } {
  if (lat == null || lng == null) return { lat: lat ?? null, lng: lng ?? null };
  return snapToGrid(lat, lng);
}
