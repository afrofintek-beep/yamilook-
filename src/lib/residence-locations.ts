import countries from '@/data/residence-countries.json';
import { AFRICAN_LOCATIONS } from './african-locations';

export const RESIDENCE_COUNTRY_CODES = Object.keys(countries);
const loaders = import.meta.glob<{ default: Record<string, string[]> }>('../data/residence-cities/*.json');
const pending = new Map<string, Promise<Record<string, string[]>>>();

/** Country suggestions are loaded by region; the form also accepts unlisted places. */
export async function loadResidenceCities(countryCode: string): Promise<string[]> {
  const continent = countries[countryCode as keyof typeof countries];
  const local = AFRICAN_LOCATIONS.find(country => country.countryCode === countryCode)?.cities.map(city => city.name) || [];
  if (!continent) return local;
  let request = pending.get(continent);
  if (!request) {
    request = loaders[`../data/residence-cities/${continent}.json`]().then(module => module.default);
    pending.set(continent, request);
  }
  try {
    const data = await request;
    return [...new Set([...local, ...(data[countryCode] || [])])];
  } catch (error) {
    pending.delete(continent);
    throw error;
  }
}

export const normalizePlaceSearch = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim();
export function matchingResidenceCities(cities: string[], search: string, language: string): string[] {
  const query = normalizePlaceSearch(search);
  return cities.filter(name => normalizePlaceSearch(name).includes(query))
    .sort(new Intl.Collator(language.split(/[-_]/)[0]).compare).slice(0, 50);
}
