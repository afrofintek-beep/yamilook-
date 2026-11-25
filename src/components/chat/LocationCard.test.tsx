import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const integrations=vi.hoisted(()=>({googleMaps:true,maguela:false,loading:false}));
vi.mock('@/features/integration-access/useIntegrationAccess',()=>({useIntegrationAccess:()=>integrations}));
import { LocationCard } from './LocationCard';
beforeEach(()=>Object.assign(integrations,{googleMaps:true,maguela:false,loading:false}));
afterEach(cleanup);
it('shows a reference and safe map and directions links without loading external maps', () => {
  const { container } = render(<LocationCard location={{ latitude: -8.93, longitude: 13.18, caption: 'Escritório · portão azul' }} />);
  expect(screen.getByText('Escritório · portão azul')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Como chegar' })).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=-8.93,13.18');
  expect(screen.getByRole('link', { name: 'Abrir mapa' })).toHaveAttribute('rel', 'noopener noreferrer');
  expect(container.querySelector('iframe, img')).toBeNull();
});
it.each([false,true])('preserves received location text but hides Google links without access (loading=%s)',loading=>{
 Object.assign(integrations,{googleMaps:loading,loading});
 render(<LocationCard location={{latitude:-8.93,longitude:13.18,caption:'Escritório · portão azul'}}/>);
 expect(screen.getByText('Escritório · portão azul')).toBeVisible();
 expect(screen.getByText(/-8.93000, 13.18000/)).toBeVisible();
 expect(screen.queryByRole('link')).toBeNull();
});
