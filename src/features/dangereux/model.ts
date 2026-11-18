// Schematic drawing units only. No point in the pilot denotes a geographic location.
export type Point = [number, number];
export type PlaceId = 'padaria' | 'mercado' | 'oficina' | 'espaco' | 'atelie';
export type Place = { id: PlaceId; name: string; category: 'Comércio' | 'Serviços' | 'Comunidade'; zone: string; info: string; reference: string; point?: Point; via?: Point[]; directions?: string };

export const entrance: Point = [94, 225];
export const square: Point = [215, 188];
export const junction: Point = [350, 148];
export const home: Point = [373, 246];
export type Grant = { person: string; expires: number; radius: number; revoked: boolean };
export function accessState(grant: Grant | null, person: string, distance: number, now: number) {
  if (!grant || grant.revoked || grant.expires <= now || grant.person !== person) return 'closed';
  return distance > grant.radius ? 'approach' : 'open';
}

export type Review = 'Por analisar' | 'Validado' | 'Em revisão';
export const examplePeople = ['Visita A', 'Visita B'];

export type PilotData = {
  places: Place[];
  admin?: { cases: { id: string; kind: string; zone: string }[]; zones: [string, number][] };
};
