// M3 screenshot capture for Solmar Bay: serves game/ locally, opens each staged
// ?shot= view from shots.json in headless Chrome, waits for the game to signal it
// rendered, and saves the canvas as a JPEG in screenshots/. Usage from the repo root:
//   node shots-capture.mjs [port]
// It prints console errors and failed requests per page so a bad frame is loud.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire('/home/hatch/workspace/makefun/work-game/capture/package.json');
const puppeteer = require('puppeteer-core');

const repoDir = '/home/hatch/workspace/makefun/entries/gta6-01';
const port = Number(process.argv[2] ?? 8091);
const outDir = join(repoDir, 'screenshots');
mkdirSync(outDir, { recursive: true });
const shots = JSON.parse(readFileSync(join(repoDir, 'shots.json'), 'utf8'));

const server = spawn('node', ['serve.ts', '--port', String(port)], {
  cwd: repoDir,
  stdio: 'pipe',
});
await new Promise((r) => setTimeout(r, 1500));

const browser = await puppeteer.launch({
  executablePath: process.env.HOME + '/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome',
  headless: true,
  protocolTimeout: 120000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
});

try {
  for (const shot of shots) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    const problems = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
    page.on('requestfailed', (req) => problems.push(`reqfail: ${req.url()}`));
    page.on('request', (req) => {
      if (!req.url().startsWith('http://localhost') && !req.url().startsWith('data:')) {
        problems.push(`external request: ${req.url()}`);
      }
    });
    const url = `http://localhost:${port}/index.html${shot.query}`;
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction('window.__solmarReady === true', { timeout: 60000 });
    await new Promise((r) => setTimeout(r, 400));
    const canvas = await page.$('#app canvas');
    await canvas.screenshot({ type: 'jpeg', quality: 86, path: join(outDir, shot.name) });
    console.log(`${shot.name} <- ${shot.query} problems=${problems.length}`);
    for (const p of problems) console.log(`  ${p}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log('capture done');
