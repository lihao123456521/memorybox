import {test,expect} from '@playwright/test';

test('dragging the solid music box only rotates it and a deliberate mesh click opens it',async({page})=>{
  await page.goto('/');const canvas=page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-box-screen',/"x":/,{timeout:60_000});
  const before=await canvas.getAttribute('data-box-screen');const p=JSON.parse(before!);
  await page.mouse.move(p.x,p.y);await page.mouse.down();
  await page.mouse.move(p.x+18,p.y+5,{steps:5});await page.mouse.up();
  await expect(page.locator('main')).toHaveAttribute('data-phase','landing');
  await expect(canvas).toHaveAttribute('data-box-open','false');
  await expect.poll(()=>canvas.getAttribute('data-box-screen')).not.toBe(before);
  const target=JSON.parse((await canvas.getAttribute('data-box-screen'))!);
  await page.mouse.click(target.x,target.y);
  await expect(page.locator('main')).toHaveAttribute('data-phase','memory-room');
  await expect(canvas).toHaveAttribute('data-box-open','true');
  await expect.poll(async()=>Number(await canvas.getAttribute('data-box-lid-angle'))).toBeLessThan(-1.2);
});
