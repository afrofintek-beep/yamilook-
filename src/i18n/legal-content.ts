import pt from './legal/pt.json';
import en from './legal/en.json';
import fr from './legal/fr.json';
import ar from './legal/ar.json';
import am from './legal/am.json';
import sw from './legal/sw.json';
import ln from './legal/ln.json';
import yo from './legal/yo.json';
import sn from './legal/sn.json';
import zu from './legal/zu.json';
const documents = { pt, en, fr, ar, am, sw, ln, yo, sn, zu };
export function legalContent(language: string) {
  const locale = language.toLowerCase().split(/[-_]/)[0] as keyof typeof documents;
  return documents[locale] || documents.pt;
}
export { legalLabel } from './legal-labels';
