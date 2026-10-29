import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const artifacts = resolve('..', 'artifacts', 'qa-v2');
const phase = (page: Page) => page.locator('main[data-phase]');
const canvas = (page: Page) => page.locator('canvas');
const state = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('memorybox-v1') || '{}'));

async function expectPhase(page: Page, expected: string) {
  await expect(phase(page)).toHaveAttribute('data-phase', expected, {timeout:expected==='exploration'?60_000:12_000});
}

async function screenshot(page: Page, name: string) {
  await mkdir(artifacts, { recursive: true });
  await page.screenshot({ path: resolve(artifacts, name + '.png'), fullPage: true, animations: 'disabled' });
}

async function inputPage(page: Page) {
  await page.goto('/');
  await expect(canvas(page)).toBeVisible();
  await page.getByRole('button', { name: '打开记忆', exact: true }).click();
  await page.getByRole('button', { name: '挑选一段记忆', exact: true }).click();
  await expectPhase(page, 'template-select');
  await expect(page.getByRole('button', { name: /家的模样/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '选好了，继续', exact: true }).click();
  await expectPhase(page, 'memory-input');
}

async function explore(page: Page) {
  await page.getByRole('button', { name: '整理这段记忆', exact: true }).click();
  await expectPhase(page, 'memory-confirm');
  await page.getByRole('button', { name: '走进那一天', exact: true }).click();
  await expectPhase(page, 'exploration');
  await expect(canvas(page)).toHaveAttribute('data-world', 'memory', {timeout:60_000});
  await expect.poll(async () => Number(await canvas(page).getAttribute('data-mesh-count'))).toBeGreaterThan(100);
  await page.getByRole('button', { name: '房间总览', exact: true }).click();
  await expect(canvas(page)).toHaveAttribute('data-navigation-mode', 'overview');
  await expect.poll(async()=>{const p=(await canvas(page).getAttribute('data-camera-position'))!.split(',').map(Number);return p[1];}).toBeGreaterThan(6);
}

async function collect(page: Page, ids = ['tv', 'doll', 'photo']) {
  await expect(canvas(page)).toHaveAttribute('data-world','memory',{timeout:60_000});
  for (const id of ids) {
    await page.getByTestId('anchor-' + id).click();
    await expect(page.locator('.anchor-story')).toBeVisible();
    await page.getByRole('button', { name: '继续探索', exact: true }).click();
  }
}

async function choose(page: Page, branch: 'real' | 'imagined') {
  await page.getByRole('button', { name: '走到那扇门前', exact: true }).click();
  await expectPhase(page, 'decision');
  await page.getByRole('button', { name: branch === 'real' ? /重温真实路线/ : /多留一个下午/ }).click();
  await expectPhase(page, branch + '-branch');
}

test.afterEach(async ({ page, request }) => {
  // Every Playwright context has its own fresh random owner. Never enumerate or delete another owner's data.
  try {
    const token = await page.evaluate(() => localStorage.getItem('memorybox-owner'));
    if (!token) return;
    const headers = { 'X-MemoryBox-Token': token };
    const response = await request.get('http://127.0.0.1:8000/api/memories', { headers });
    if (response.ok()) {
      for (const item of await response.json()) {
        await request.delete(`http://127.0.0.1:8000/api/memories/${item.id}`, { headers });
      }
    }
  } catch { /* Browser-only offline tests require no server cleanup. */ }
});

test('full real 3D journey, two branches, exact letter, reload and replay preserve collection', async ({ page, request }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(canvas(page)).toHaveAttribute('data-world', 'present');
  await expect.poll(async () => Number(await canvas(page).getAttribute('data-mesh-count'))).toBeGreaterThan(100);
  await page.getByRole('button', { name: '放大文字', exact: true }).click();
  await expect(phase(page)).toHaveClass(/large-type/);
  await page.getByRole('button', { name: '恢复标准字号', exact: true }).click();
  await expect(phase(page)).not.toHaveClass(/large-type/);
  await page.getByRole('button', { name: '开启动画', exact: true }).click();
  await expect(phase(page)).not.toHaveClass(/reduced-motion/);
  await page.getByRole('button', { name: '减少动态效果', exact: true }).click();
  await expect(phase(page)).toHaveClass(/reduced-motion/);
  await page.getByRole('button', { name: '开启声音', exact: true }).click();
  await expect(page.getByRole('button', { name: '关闭声音', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭声音', exact: true }).click();
  await screenshot(page, '01-present-room-1366');
  await inputPage(page);
  await page.getByRole('button', { name: '用示例故事体验', exact: true }).click();
  await expect(page.locator('input[name="year"]')).toHaveValue('2005');
  await explore(page);
  await expect(page.getByRole('button', { name: /找到三件旧物/ })).toBeDisabled();
  await expect.poll(async () => (await state(page)).experience.visited.length).toBe(0);
  await screenshot(page, '02-old-home-1366');

  const before = await canvas(page).getAttribute('data-camera-position');
  const bounds = await canvas(page).boundingBox();
  if (!bounds) throw new Error('3D canvas has no visible bounds');
  await page.mouse.move(bounds.x + bounds.width * .55, bounds.y + bounds.height * .53);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .65, bounds.y + bounds.height * .57, { steps: 16 });
  await page.mouse.up();
  await expect.poll(() => canvas(page).getAttribute('data-camera-position')).not.toBe(before);
  await page.getByRole('button', { name: '重置视角', exact: true }).click();
  const initialCamera = before!.split(',').map(Number);
  await expect.poll(async () => {
    const current = (await canvas(page).getAttribute('data-camera-position'))!.split(',').map(Number);
    return Math.hypot(...current.map((value, index) => value - initialCamera[index]));
  }).toBeLessThan(.4);

  await expect.poll(async () => !!(await canvas(page).getAttribute('data-anchor-screen'))).toBe(true);
  const screen = JSON.parse((await canvas(page).getAttribute('data-anchor-screen'))!);
  await page.mouse.click(screen.tv.x, screen.tv.y);
  await expect(canvas(page)).toHaveAttribute('data-last-anchor-source', 'mesh:tv');
  await expect(page.locator('.anchor-story')).toContainText('电视');
  await page.getByRole('button', { name: '继续探索', exact: true }).click();
  await collect(page, ['doll', 'photo']);
  await expect.poll(async () => (await state(page)).experience.visited.length).toBe(3);
  await choose(page, 'real');
  await expect(page.locator('.branch-label')).toContainText('你确认的真实记忆');
  await expect(page.locator('.branch-story')).toContainText('离开');
  for (const id of ['tv', 'doll', 'photo']) await expect(page.getByTestId('anchor-' + id)).toHaveCount(0);
  await screenshot(page, '03-real-branch');
  await page.getByRole('button', { name: '重新选择', exact: true }).click();
  await page.getByRole('button', { name: /多留一个下午/ }).click();
  await expectPhase(page, 'imagined-branch');
  await expect(page.locator('.branch-label')).toHaveText(/AI 想象 · 并非真实历史/);
  await expect(page.locator('.branch-story')).toContainText(/两只茶杯|一杯茶/);
  for (const id of ['tv', 'doll', 'photo']) await expect(page.getByTestId('anchor-' + id)).toHaveCount(0);
  await screenshot(page, '04-imagined-branch');

  await page.getByRole('button', { name: '写一封信', exact: true }).click();
  await page.getByRole('combobox', { name: '收信人', exact: true }).selectOption('important-person');
  const letter = '奶奶，今天我记住了阳光落在地板上的样子。\n下次见面时，我想陪你慢慢喝一杯茶。';
  await page.getByLabel('信的内容', { exact: true }).fill('   ');
  await expect(page.getByRole('button', { name: '封好信，回到现在', exact: true })).toBeDisabled();
  await page.getByLabel('信的内容', { exact: true }).fill(letter);
  await page.getByRole('button', { name: '封好信，回到现在', exact: true }).click();
  await expectPhase(page, 'return-room');
  await expect(canvas(page)).toHaveAttribute('data-world', 'present');
  await expect.poll(async () => (await state(page)).collection.length).toBe(1);
  await screenshot(page, '05-return-room');
  await page.getByRole('button', { name: '打开我的收藏', exact: true }).click();
  await page.getByRole('button', { name: '打开信件', exact: true }).click();
  await expect(page.locator('.saved-letter')).toHaveText(letter);
  await expect(page.locator('.save-status')).toContainText('已存入本机数据库');

  const s = await state(page);
  const token = await page.evaluate(() => localStorage.getItem('memorybox-owner'));
  const stored = await request.get(`http://127.0.0.1:8000/api/memories/${s.collection[0].memoryId}`, { headers: { 'X-MemoryBox-Token': token! } });
  expect(stored.ok()).toBe(true);
  expect((await stored.json()).letters[0].text).toBe(letter);
  await screenshot(page, '06-saved-letter');
  await page.reload();
  await expectPhase(page, 'collection');
  await expect(page.locator('.collection-entry')).toHaveCount(1);
  await page.getByRole('button', { name: '再收藏一段时光', exact: true }).click();
  await expectPhase(page, 'template-select');
  expect((await state(page)).collection[0].text).toBe(letter);
  await page.getByRole('button', { name: /我的收藏/ }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /^删除回忆 / }).click();
  await expect(page.locator('.collection-entry')).toHaveCount(0);
  expect((await state(page)).collection).toEqual([]);
  expect(errors).toEqual([]);
});

test('custom facts, partial exploration refresh, exit and resume preserve the draft', async ({ page }) => {
  await inputPage(page);
  await page.getByLabel('记忆里重要的人', { exact: true }).fill('外公');
  await page.getByLabel('想珍藏的一件物品', { exact: true }).fill('邮票册');
  await page.getByRole('textbox', { name: '那一天，发生了什么？', exact: true }).fill('外公在老屋整理邮票，我坐在旁边帮忙。后来我决定留下来一起整理。');
  await page.getByLabel('当时，你做了怎样的选择？', { exact: true }).fill('我留下来和外公整理了邮票。');
  await explore(page);
  await collect(page, ['doll']);
  await page.reload();
  await expectPhase(page, 'exploration');
  expect((await state(page)).experience.visited).toEqual(['doll']);
  await page.getByRole('button', { name: '返回现实', exact: true }).click();
  await expectPhase(page, 'memory-room');
  await page.getByRole('button', { name: '继续未完成的旅程', exact: true }).click();
  await expectPhase(page, 'exploration');
  await collect(page, ['tv', 'photo']);
  await choose(page, 'real');
  await expect(page.locator('.branch-story')).toContainText('我留下来和外公整理了邮票。');
  await expect(page.locator('.branch-story')).not.toContainText('奶奶');
  await expect(page.locator('.branch-story h2')).not.toContainText(/挥手|告别|离开/);
});

test('offline backend and missing optional photo still allow the full experience and local letter', async ({ page }) => {
  await page.route('http://127.0.0.1:8000/**', route => route.abort());
  await page.route('**/assets/images/family-photo.png', route => route.abort());
  await inputPage(page);
  await expect(page.locator('.connection')).toContainText('离线演示模式');
  await explore(page);
  await collect(page);
  await choose(page, 'imagined');
  await page.getByRole('button', { name: '写一封信', exact: true }).click();
  await page.getByLabel('信的内容', { exact: true }).fill('离线时也能完整写下这段回忆。');
  await page.getByRole('button', { name: '封好信，回到现在', exact: true }).click();
  await expectPhase(page, 'return-room');
  await page.getByRole('button', { name: '打开我的收藏', exact: true }).click();
  await expect(page.locator('.save-status')).toContainText('仅保存在此浏览器');
  await expect(page.getByRole('button', { name: '同步到本机数据库', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '打开信件', exact: true }).click();
  await expect(page.locator('.saved-letter')).toHaveText('离线时也能完整写下这段回忆。');
  await page.unroute('http://127.0.0.1:8000/**');
  await page.getByRole('button', { name: '同步到本机数据库', exact: true }).click();
  await expect(page.locator('.save-status')).toContainText('已存入本机数据库');
});

for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }, { width: 319, height: 873 }]) {
  test(`viewport ${viewport.width}x${viewport.height} keeps landing and interview inside width`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(canvas(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await screenshot(page, `viewport-${viewport.width}-landing`);
    await inputPage(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole('button', { name: '整理这段记忆', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: '整理这段记忆', exact: true })).toBeInViewport();
    await screenshot(page, `viewport-${viewport.width}-interview`);
  });
}

test('390px portrait can explore, choose, write and revisit a letter without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await inputPage(page);
  await explore(page);
  await screenshot(page, 'mobile-390-exploration');
  await collect(page);
  await choose(page, 'imagined');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole('button', { name: '写一封信', exact: true }).click();
  await page.getByLabel('信的内容', { exact: true }).fill('在小小的屏幕上，也能完整走进那年夏天。');
  await screenshot(page, 'mobile-390-letter');
  await page.getByRole('button', { name: '封好信，回到现在', exact: true }).click();
  await expectPhase(page, 'return-room');
  await page.getByRole('button', { name: '打开我的收藏', exact: true }).click();
  await page.getByRole('button', { name: '打开信件', exact: true }).click();
  await expect(page.locator('.saved-letter')).toHaveText('在小小的屏幕上，也能完整走进那年夏天。');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await screenshot(page, 'mobile-390-collection');
});

test('lost save response can sync and reload without duplicating the committed letter', async ({ page, request }) => {
  await inputPage(page);
  await explore(page);
  await collect(page);
  await choose(page, 'imagined');
  await page.getByRole('button', { name: '写一封信', exact: true }).click();
  const letter = '这封信的服务器响应故意丢失，恢复后仍然只保存一份。';
  await page.getByLabel('信的内容', { exact: true }).fill(letter);
  let serverCommitted = false;
  const letterRoute = '**/api/memories/*/letters';
  await page.route(letterRoute, async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch();
    serverCommitted = response.ok();
    await route.abort('failed');
  });
  await page.getByRole('button', { name: '封好信，回到现在', exact: true }).click();
  await expectPhase(page, 'return-room');
  expect(serverCommitted).toBe(true);
  await page.getByRole('button', { name: '打开我的收藏', exact: true }).click();
  await expect(page.locator('.collection-entry')).toHaveCount(1);
  await expect(page.locator('.save-status')).toContainText('仅保存在此浏览器');
  await page.unroute(letterRoute);
  await page.getByRole('button', { name: '同步到本机数据库', exact: true }).click();
  await expect(page.locator('.save-status')).toContainText('已存入本机数据库');
  await expect(page.locator('.collection-entry')).toHaveCount(1);
  const token = await page.evaluate(() => localStorage.getItem('memorybox-owner'));
  const saved = await request.get('http://127.0.0.1:8000/api/memories', { headers: { 'X-MemoryBox-Token': token! } });
  const memories = await saved.json();
  expect(memories).toHaveLength(1);
  expect(memories[0].letters).toHaveLength(1);
  expect(memories[0].letters[0].text).toBe(letter);
  await page.reload();
  await expectPhase(page, 'collection');
  await expect(page.locator('.collection-entry')).toHaveCount(1);
  await expect(page.locator('.save-status')).toContainText('已存入本机数据库');
});

test('deleting a memory while its letter is being rewritten clears that draft and resume reference', async ({ page }) => {
  await inputPage(page);
  await explore(page);
  await collect(page);
  await choose(page, 'real');
  await page.getByRole('button', { name: '写一封信', exact: true }).click();
  await page.getByLabel('信的内容', { exact: true }).fill('这是一条只用于验证删除边界的测试回忆。');
  await page.getByRole('button', { name: '封好信，回到现在', exact: true }).click();
  await expectPhase(page, 'return-room');
  await page.getByRole('button', { name: '打开我的收藏', exact: true }).click();
  await page.getByRole('button', { name: '重写 / 再选分支', exact: true }).click();
  await expectPhase(page, 'letter');
  const deletedId = (await state(page)).experience.memoryId;
  expect(deletedId).toBeTruthy();
  await page.getByRole('button', { name: /我的收藏/ }).click();
  await expectPhase(page, 'collection');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /^删除回忆 / }).click();
  await expect(page.locator('.collection-entry')).toHaveCount(0);
  const cleared = await state(page);
  expect(cleared.experience.memoryId).not.toBe(deletedId);
  expect(cleared.resume).toBeNull();
  await page.reload();
  expect((await state(page)).experience.memoryId).not.toBe(deletedId);
  await expect(page.getByRole('button', { name: '继续未完成的旅程', exact: true })).toHaveCount(0);
});
