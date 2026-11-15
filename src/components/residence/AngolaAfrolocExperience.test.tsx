import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { AngolaAfrolocExperience } from './AngolaAfrolocExperience';
afterEach(cleanup);
it('shows the two official destinations only for Angola and responds to country changes', () => {
  const view = render(<AngolaAfrolocExperience country="AO" hasAddress />);
  expect(screen.getByRole('link', {name:'Experimentar AFROLOC'})).toHaveAttribute('href','/afroloc');
  expect(screen.getByRole('link', {name:'Ver o meu cartão AFROLOC'})).toHaveAttribute('href','/afroloc/cartao');
  expect(screen.getByRole('link', {name:'Abrir mapa NJILA'})).toHaveAttribute('href','/afroloc');
  for (const country of ['PT','CD','',undefined]) {
    view.rerender(<AngolaAfrolocExperience country={country} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  }
  view.rerender(<AngolaAfrolocExperience country="AO" hasAddress />);
  expect(screen.getAllByRole('link')).toHaveLength(3);
});

it('offers creation for a new resident and the card only when an address exists',()=>{
 const view=render(<AngolaAfrolocExperience country="AO" onCreate={()=>{}}/>);
 expect(screen.getByRole('button',{name:'Criar o meu endereço AFROLOC'})).toBeVisible();
 expect(screen.queryByRole('link',{name:'Ver o meu cartão AFROLOC'})).not.toBeInTheDocument();
 view.rerender(<AngolaAfrolocExperience country="AO" hasAddress onCreate={()=>{}}/>);
 expect(screen.queryByRole('button',{name:'Criar o meu endereço AFROLOC'})).not.toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Ver o meu cartão AFROLOC'})).toBeVisible();
});
