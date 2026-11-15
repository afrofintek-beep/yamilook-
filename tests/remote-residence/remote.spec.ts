import {test,expect} from '@playwright/test';
test('a registered travelling resident can select home and open the pending card',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:()=>{throw new Error('Remote flow requested device GPS');}}});});
 // Deterministic test tiles. No real residence or third-party tile traffic in this test.
 await page.route(/tile\.openstreetmap\.org|server\.arcgisonline\.com/,r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#ddd"/><path d="M0 128H256M128 0V256" stroke="#aaa" stroke-width="12"/></svg>'}));
 await page.goto('/tests/remote-residence/harness.html');
 await expect(page.getByRole('link',{name:'Ver o meu cartão AFROLOC'})).toHaveCount(0);
 await page.getByRole('button',{name:'Criar o meu endereço AFROLOC'}).click();
 await expect(page.getByLabel('Bairro / povoação / localidade')).toHaveValue('Ingombota');
 await expect(page.getByRole('combobox',{name:/^Município/})).toHaveValue('AO-LDA-INGOMBOTA');
 await page.getByRole('button',{name:'Escolher a minha casa no mapa'}).click();
 const save=page.getByRole('button',{name:'Criar endereço e cartão'});
 await expect(save).toBeDisabled();
 for(let i=0;i<7;i++){await page.getByRole('button',{name:'Aproximar',exact:true}).click();await page.waitForTimeout(300);}
 await page.getByRole('button',{name:'Marcar a casa no centro do mapa'}).click();
 await expect(save).toBeDisabled();
 await page.getByRole('checkbox',{name:'Confirmo que o ponto marcado corresponde à minha residência. A validação fica pendente.'}).check();
 await expect(save).toBeEnabled();
 await expect(page.locator('body')).toHaveJSProperty('scrollWidth',393);
 await save.click();
 await expect(page).toHaveURL(/\/afroloc\/cartao$/);
 await expect(page.getByText('Residência declarada — validação pendente',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Guardar imagem'})).toBeEnabled();
 const payload=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('remote-payload')!));
 expect(payload.p_method).toBe('map');expect(payload.p_accuracy).toBeNull();expect(payload.p_lat).toBeCloseTo(-8.839,2);expect(payload.p_lng).toBeCloseTo(13.289,2);expect(payload.p_complement).toBe('Casa 12');
 expect(errors).toEqual([]);
});
