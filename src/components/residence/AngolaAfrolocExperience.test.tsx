import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { AngolaAfrolocExperience } from './AngolaAfrolocExperience';
afterEach(cleanup);
it('shows the two official destinations only for Angola and responds to country changes', () => {
  const view = render(<AngolaAfrolocExperience country="AO" />);
  expect(screen.getByRole('link', {name:'Experimentar AFROLOC'})).toHaveAttribute('href','/afroloc');
  expect(screen.getByRole('link', {name:'Abrir mapa NJILA'})).toHaveAttribute('href','/afroloc');
  for (const country of ['PT','CD','',undefined]) {
    view.rerender(<AngolaAfrolocExperience country={country} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  }
  view.rerender(<AngolaAfrolocExperience country="AO" />);
  expect(screen.getAllByRole('link')).toHaveLength(2);
});
