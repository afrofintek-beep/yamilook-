import labels from './legal-labels.json';
export function legalLabel(language: string, label: keyof typeof labels.pt) {
  const locale = language.toLowerCase().split(/[-_]/)[0] as keyof typeof labels;
  return (labels[locale] || labels.pt)[label];
}
