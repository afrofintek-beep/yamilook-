import {render,cleanup} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {CardPreview} from './CardPreview';
afterEach(cleanup);
it.each([false,true])('reserves photo space and preserves full long fields (rtl=%s)',rtl=>{
 const name='António Henriques da Silva';
 const code='AO-LUA-TAL-TAL-GEN-G10-X6AI6-Y4A2H';
 const {container}=render(<CardPreview name={name} code={code} photo="data:image/png;base64,AA==" rtl={rtl} title="Cartão de endereço digital" notice="Dados à data de geração." lines={[{label:'Complemento',value:'Edifício com um nome muito longo e apartamento 123',group:'location'},{label:'Cartão gerado em',value:'15/11/2026',group:'footer'}]}/>);
 const photo=container.querySelector('[data-card-photo]')!,block=container.querySelector('[data-card-code]')!;
 expect(Number(block.getAttribute('y'))).toBeGreaterThanOrEqual(Number(photo.getAttribute('y'))+Number(photo.getAttribute('height')));
 expect(container.textContent).toContain('apartamento 123');
 expect(container.querySelector('svg')?.getAttribute('aria-label')).toContain(code);
 expect(container.textContent).not.toContain('Africa/Luanda');
});
