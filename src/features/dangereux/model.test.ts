import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { accessState, type Grant } from './model';

describe('Dangereux pilot', () => {
  const grant: Grant = { person: 'Visita A', radius: 250, expires: 10000, revoked: false };
  it('reveals the sample route only to the granted visitor inside the selected distance', () => {
    expect(accessState(null, 'Visita A', 0, 100)).toBe('closed');
    expect(accessState(grant, 'Visita B', 0, 100)).toBe('closed');
    expect(accessState(grant, 'Visita A', 251, 100)).toBe('approach');
    expect(accessState(grant, 'Visita A', 250, 100)).toBe('open');
  });
  it('closes at expiry and on revocation, even if the visitor is close', () => {
    expect(accessState(grant, 'Visita A', 1, grant.expires)).toBe('closed');
    expect(accessState({...grant, revoked: true}, 'Visita A', 1, 100)).toBe('closed');
  });
  it('publishes the at-home service without a map point or public route', () => {
    const migration = readFileSync('supabase/migrations/20261118171933_dangereux_access.sql', 'utf8');
    const places: import('./model').Place[] = JSON.parse(migration.split('$places$')[1]);
    const atelier = places.find(place => place.id === 'atelie');
    expect(atelier).toBeDefined();
    expect(atelier?.point).toBeUndefined();
    expect(atelier?.via).toBeUndefined();
  });
});
