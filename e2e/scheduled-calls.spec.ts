import {test,expect} from '@playwright/test';
for(const width of [320,390,430])test(`form remains usable at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/e2e/scheduled/index.html');
 await expect(page.getByRole('button',{name:'Close',exact:true})).toBeVisible();
 const date=page.getByRole('button',{name:/\d{2}\/\d{2}\/\d{4}/});const time=page.getByLabel('Hora');
 await time.scrollIntoViewIfNeeded();const d=await date.boundingBox();const t=await time.boundingBox();
 expect(d&&t&&(d.x+d.width<=t.x+1||d.y+d.height<=t.y+1)).toBeTruthy();
 await page.getByLabel('Título *').fill('Reunião');
 await expect(page.getByRole('button',{name:'Agendar chamada',exact:true})).toBeInViewport();
 await page.getByText('Não há contactos para convidar').scrollIntoViewIfNeeded();
 await expect(page.getByRole('button',{name:'Close',exact:true})).toBeInViewport();
 await expect(page.getByRole('button',{name:'Agendar chamada',exact:true})).toBeInViewport();
 await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('rejected save retains form, successful save closes it',async({page})=>{
 await page.clock.install({time:new Date('2026-10-25T01:00:00')});await page.goto('/e2e/scheduled/index.html');
 await page.getByLabel('Título *').fill('Falhar');await page.getByRole('button',{name:'Agendar chamada',exact:true}).click();
 await expect(page.getByText('Só podes convidar pessoas dos teus contactos.')).toBeVisible();await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByLabel('Título *').fill('Confirmada');await page.getByRole('button',{name:'Agendar chamada',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
