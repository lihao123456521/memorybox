import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const canvas = (page: Page) => page.locator('canvas');
type Position = [number, number, number];

async function playerPosition(page: Page): Promise<Position> {
  const raw = await canvas(page).getAttribute('data-player-position');
  if (!raw) throw new Error('The walk controller did not publish its player position');
  return raw.split(',').map(Number) as Position;
}

const floorDistance = (a: Position, b: Position) => Math.hypot(a[0] - b[0], a[2] - b[2]);

async function holdUntil(page: Page, key: string, assertion: () => Promise<void>) {
  await page.keyboard.down(key);
  try { await assertion(); } finally { await page.keyboard.up(key); }
}

async function walkTo(page: Page, key: string, coordinate: 0 | 2, target: number, direction: 'less' | 'greater') {
  await holdUntil(page, key, async () => {
    const movement = expect.poll(async () => (await playerPosition(page))[coordinate], { timeout: 20_000, intervals: [50] });
    if (direction === 'less') await movement.toBeLessThan(target);
    else await movement.toBeGreaterThan(target);
  });
}

async function enterWalk(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '打开记忆', exact: true }).click();
  await page.getByRole('button', { name: '挑选一段记忆', exact: true }).click();
  await page.getByRole('button', { name: '选好了，继续', exact: true }).click();
  await page.getByRole('button', { name: '整理这段记忆', exact: true }).click();
  await page.getByRole('button', { name: '走进那一天', exact: true }).click();
  await expect(page.locator('main')).toHaveAttribute('data-phase', 'exploration');
  await expect(canvas(page)).toHaveAttribute('data-world', 'memory');
  await expect(canvas(page)).toHaveAttribute('data-navigation-mode', 'walk');
  await expect(canvas(page)).toHaveAttribute('data-navigation-paused', 'false');
}

async function screenshot(page: Page, name: string) {
  const directory = resolve('..', 'artifacts', 'qa-v2');
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, name + '.png'), fullPage: true, animations: 'disabled' });
}

test.afterEach(async ({ page, request }) => {
  try {
    const token = await page.evaluate(() => localStorage.getItem('memorybox-owner'));
    if (!token) return;
    const headers = { 'X-MemoryBox-Token': token };
    const memories = await request.get('http://127.0.0.1:8000/api/memories', { headers });
    if (!memories.ok()) return;
    for (const memory of await memories.json()) {
      await request.delete(`http://127.0.0.1:8000/api/memories/${memory.id}`, { headers });
    }
  } catch { /* The isolated browser owner may have been offline. */ }
});

test('WASD and arrow keys move an eye-height camera without pointer lock', async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = function () {
      throw new Error('Pointer Lock intentionally unavailable in this browser acceptance check');
    };
  });
  await enterWalk(page);
  const start = await playerPosition(page);
  await holdUntil(page, 'a', async () => {
    await expect.poll(async () => floorDistance(start, await playerPosition(page))).toBeGreaterThan(.45);
  });
  const afterWASD = await playerPosition(page);
  expect(afterWASD[0]).toBeLessThan(start[0] - .3);
  await holdUntil(page, 'ArrowRight', async () => {
    await expect.poll(async () => (await playerPosition(page))[0]).toBeGreaterThan(afterWASD[0] + .3);
  });
  const position = await playerPosition(page);
  const eye = (await canvas(page).getAttribute('data-camera-position'))!.split(',').map(Number);
  expect(Math.abs(eye[1] - 1.64)).toBeLessThan(.05);
  expect(Math.hypot(eye[0] - position[0], eye[2] - position[2])).toBeLessThan(.08);
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  await screenshot(page, 'walk-01-eye-height');
});

test('walking into the back wall stops the player outside the wall', async ({ page }) => {
  await enterWalk(page);
  const collisions = Number(await canvas(page).getAttribute('data-collision-count'));
  await holdUntil(page, 's', async () => {
    await expect.poll(async () => Number(await canvas(page).getAttribute('data-collision-count'))).toBeGreaterThan(collisions);
  });
  const stopped = await playerPosition(page);
  expect(stopped[2]).toBeGreaterThan(3.15);
  expect(stopped[2]).toBeLessThanOrEqual(3.32);
  await holdUntil(page, 'a', async () => {
    await expect.poll(async () => (await playerPosition(page))[0]).toBeLessThan(stopped[0] - .3);
  });
  expect((await playerPosition(page))[2]).toBeLessThanOrEqual(3.32);
});

test('the coffee table blocks walking and the kitchen and balcony can be reached through their openings', async ({ page }) => {
  test.setTimeout(150_000);
  await enterWalk(page);
  await expect(canvas(page)).toHaveAttribute('data-zone', 'living');
  const collisions = Number(await canvas(page).getAttribute('data-collision-count'));
  await holdUntil(page, 'w', async () => {
    await expect.poll(async () => Number(await canvas(page).getAttribute('data-collision-count')), { timeout: 20_000 }).toBeGreaterThan(collisions);
  });
  // The visible coffee table occupies z=-.8..+.3; the player radius stops the eye outside z=+.5.
  const beforeTable = await playerPosition(page);
  expect(beforeTable[2]).toBeGreaterThanOrEqual(.48);
  expect(beforeTable[2]).toBeLessThan(.67);
  expect(Math.abs(beforeTable[0])).toBeLessThan(.08);
  await screenshot(page, 'walk-02-coffee-table-collision');

  await walkTo(page, 'a', 0, -1.45, 'less');
  await walkTo(page, 'w', 2, -4.05, 'less');
  await expect(canvas(page)).toHaveAttribute('data-zone', 'kitchen');
  await expect(page.locator('.zone-indicator')).toContainText('正在厨房');
  await screenshot(page, 'walk-03-kitchen');

  await page.getByRole('button', { name: '重置视角', exact: true }).click();
  await expect.poll(async () => floorDistance(await playerPosition(page), [0, 1.64, 2.5])).toBeLessThan(.08);
  await walkTo(page, 'd', 0, 2.15, 'greater');
  await walkTo(page, 'w', 2, .1, 'less');
  await walkTo(page, 'd', 0, 4.5, 'greater');
  await expect(canvas(page)).toHaveAttribute('data-zone', 'balcony');
  await expect(page.locator('.zone-indicator')).toContainText('正在阳台');
  await screenshot(page, 'walk-04-balcony');
});

test('overview and close-up can return to the same walking position', async ({ page }) => {
  await enterWalk(page);
  await walkTo(page, 'a', 0, -.5, 'less');
  const before = await playerPosition(page);
  const lookBefore = await canvas(page).getAttribute('data-camera-look');
  await page.getByRole('button', { name: '房间总览', exact: true }).click();
  await expect(canvas(page)).toHaveAttribute('data-navigation-mode', 'overview');
  await screenshot(page, 'walk-05-overview');
  await page.getByRole('button', { name: '室内漫游', exact: true }).click();
  await expect(canvas(page)).toHaveAttribute('data-navigation-mode', 'walk');
  expect(floorDistance(before, await playerPosition(page))).toBeLessThan(.08);
  await expect(canvas(page)).toHaveAttribute('data-camera-look', lookBefore!);
  await page.getByRole('button', { name: '房间总览', exact: true }).click();
  await page.getByTestId('anchor-doll').click();
  await expect(page.locator('.anchor-story')).toBeVisible();
  await page.getByRole('button', { name: '继续探索', exact: true }).click();
  await page.getByRole('button', { name: '室内漫游', exact: true }).click();
  expect(floorDistance(before, await playerPosition(page))).toBeLessThan(.08);
});

test('four adult companion presets switch their scene model and persist after reload', async ({ page }) => {
  test.setTimeout(150_000);
  await enterWalk(page);
  await walkTo(page, 'a', 0, -1.45, 'less');
  await walkTo(page, 'w', 2, .35, 'less');
  const bounds = await canvas(page).boundingBox();
  if (!bounds) throw new Error('The interior canvas has no visible bounds');
  await page.mouse.move(bounds.x + bounds.width * .52, bounds.y + bounds.height * .48);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .52 - 135, bounds.y + bounds.height * .48, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => JSON.parse((await canvas(page).getAttribute('data-camera-look'))!).yaw).toBeGreaterThan(.3);
  const people = [
    { id: 'young-man', label: '青年男性' },
    { id: 'elder-man', label: '长者男性' },
    { id: 'young-woman', label: '青年女性' },
    { id: 'elder-woman', label: '长者女性' },
  ];
  for (const person of people) {
    await page.getByRole('button', { name: '切换人物', exact: true }).click();
    await expect(canvas(page)).toHaveAttribute('data-navigation-paused', 'true');
    const before = await playerPosition(page);
    await page.keyboard.down('w');
    await page.waitForTimeout(450);
    await page.keyboard.up('w');
    expect(floorDistance(before, await playerPosition(page))).toBeLessThan(.02);
    await page.getByRole('button', { name: new RegExp(person.label) }).click();
    await page.getByRole('button', { name: '让这位陪伴我', exact: true }).click();
    await expect(canvas(page)).toHaveAttribute('data-companion', person.id);
    expect(await page.evaluate(() => localStorage.getItem('memorybox-companion'))).toBe(person.id);
    await page.waitForLoadState('networkidle');
    await screenshot(page, `walk-character-${person.id}`);
  }
  await page.reload();
  await expect(canvas(page)).toHaveAttribute('data-companion', 'elder-woman');
  await page.getByRole('button', { name: '切换人物', exact: true }).click();
  await expect(page.getByRole('button', { name: /长者女性/ })).toHaveAttribute('aria-pressed', 'true');
});

test('portrait direction controls move without keyboard and letter input does not move the player', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterWalk(page);
  const before = await playerPosition(page);
  const move = page.getByRole('button', { name: '向左移动', exact: true });
  await move.hover();
  await page.mouse.down();
  try {
    await expect.poll(async () => (await playerPosition(page))[0]).toBeLessThan(before[0] - .3);
  } finally { await page.mouse.up(); }
  await page.getByRole('button', { name: '房间总览', exact: true }).click();
  for (const id of ['tv', 'doll', 'photo']) {
    await page.getByTestId('anchor-' + id).click();
    await page.getByRole('button', { name: '继续探索', exact: true }).click();
  }
  await page.getByRole('button', { name: '室内漫游', exact: true }).click();
  await page.getByRole('button', { name: '走到那扇门前', exact: true }).click();
  await page.getByRole('button', { name: /多留一个下午/ }).click();
  await page.getByRole('button', { name: '写一封信', exact: true }).click();
  const atLetter = await playerPosition(page);
  await page.getByLabel('信的内容', { exact: true }).fill('WASD wasd，方向键只移动文字光标。');
  await page.getByLabel('信的内容', { exact: true }).press('ArrowLeft');
  await expect(canvas(page)).toHaveAttribute('data-navigation-paused', 'true');
  expect(floorDistance(atLetter, await playerPosition(page))).toBeLessThan(.02);
  await screenshot(page, 'walk-06-mobile-letter');
});
