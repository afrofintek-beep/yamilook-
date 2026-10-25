import {test,expect} from '@playwright/test';
const image={name:'portrait.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1800"><rect width="800" height="1800" fill="teal"/></svg>')};
for(const [width,height] of [[320,568],[390,844],[430,932],[390,420]])test(`photo publish stays reachable ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});await page.goto('/e2e/status-upload/index.html');
 await page.locator('input[type=file]').first().setInputFiles(image);
 await expect(page.getByRole('img',{name:'Preview'})).toBeVisible();
 const publish=page.getByRole('button',{name:'Publicar Estado',exact:true});
 await expect(publish).toBeInViewport();await expect(publish).toBeEnabled();
 await expect(page.getByRole('button',{name:'Close',exact:true})).toBeInViewport();
 expect(await publish.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBeTruthy();
 if(width===390&&height===844)await page.screenshot({path:'/tmp/status-photo-preview.png'});
 await publish.click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('failed upload keeps the photo and permits retry',async({page})=>{
 await page.goto('/e2e/status-upload/index.html');await page.locator('input[type=file]').first().setInputFiles(image);
 await page.getByRole('textbox').fill('Falhar');await page.getByRole('button',{name:'Publicar Estado',exact:true}).click();
 await expect(page.getByText('Falha ao publicar',{exact:true})).toBeVisible();await expect(page.getByRole('img',{name:'Preview'})).toBeVisible();
 await page.getByRole('textbox').fill('Outra legenda');await page.getByRole('button',{name:'Publicar Estado',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
