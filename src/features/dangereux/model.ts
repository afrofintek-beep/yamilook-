// Schematic drawing units only. No point in the pilot denotes a geographic location.
export type Point = [number, number];
export type PlaceId = 'padaria' | 'mercado' | 'oficina' | 'espaco' | 'atelie';
export type Place = { id: PlaceId; name: string; category: 'Comércio' | 'Serviços' | 'Comunidade'; zone: string; info: string; reference: string; point?: Point; via?: Point[]; directions?: string };

export const entrance: Point = [94, 225];
export const square: Point = [215, 188];
export const junction: Point = [350, 148];
export const places: Place[] = [
  { id: 'padaria', name: 'Padaria da Banda', category: 'Comércio', zone: 'Zona central', info: 'Pão fresco e bolos de fabrico local.', reference: 'DEMO · 001', point: [335, 83], via: [square, junction], directions: 'Da entrada, segue pela avenida até ao largo. Vira à esquerda para a travessa da padaria.' },
  { id: 'mercado', name: 'Mercado do Largo', category: 'Comércio', zone: 'Zona central', info: 'Bancas de fruta, hortícolas e mercearia.', reference: 'DEMO · 002', point: [222, 215], via: [square], directions: 'Segue pela avenida até à praça. O mercado fica à direita, junto à entrada da praça.' },
  { id: 'oficina', name: 'Oficina de Bicicletas', category: 'Serviços', zone: 'Zona nascente', info: 'Reparação de bicicletas e afinação de travões.', reference: 'DEMO · 003', point: [440, 122], via: [square, junction], directions: 'Segue pela avenida, atravessa o largo e continua até à oficina.' },
  { id: 'espaco', name: 'Espaço Comunitário', category: 'Comunidade', zone: 'Zona poente', info: 'Encontros, oficinas e actividades para moradores.', reference: 'DEMO · 004', point: [184, 83], via: [square], directions: 'Na praça, vira à esquerda e sobe a rua até ao espaço comunitário.' },
  { id: 'atelie', name: 'Ateliê Linha da Banda', category: 'Serviços', zone: 'Por marcação', info: 'Costura e arranjos num ateliê em casa. A costureira divulga apenas o serviço.', reference: 'DEMO · 005' },
];

export const home: Point = [373, 246];
export type Grant = { person: string; expires: number; radius: number; revoked: boolean };
export function accessState(grant: Grant | null, person: string, distance: number, now: number) {
  if (!grant || grant.revoked || grant.expires <= now || grant.person !== person) return 'closed';
  return distance > grant.radius ? 'approach' : 'open';
}

export const cases = [
  { id: 'DB-021', kind: 'Residência', zone: 'Zona central' },
  { id: 'DB-022', kind: 'Negócio', zone: 'Zona nascente' },
  { id: 'DB-023', kind: 'Residência', zone: 'Zona poente' },
];
export type Review = 'Por analisar' | 'Validado' | 'Em revisão';
export const examplePeople = ['Visita A', 'Visita B'];
