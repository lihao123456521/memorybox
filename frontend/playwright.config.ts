import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const browserCandidates = [
  process.env.MEMORYBOX_BROWSER,
  'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter((candidate): candidate is string => !!candidate);
const executablePath = browserCandidates.find(candidate => existsSync(candidate));

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 12_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['json', { outputFile: '../artifacts/playwright-results.json' }]],
  outputDir: './test-results',
  use: {
    baseURL: process.env.MEMORYBOX_URL || 'http://127.0.0.1:5173',
    viewport: { width: 1366, height: 768 },
    reducedMotion: 'reduce',
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath,
      args: ['--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-swiftshader'],
    },
  },
});
