/**
 * Screenshot a URL with real (not virtual) wait time, over the Chrome DevTools
 * Protocol. Edge's `--screenshot --virtual-time-budget` fires before real async
 * work such as DecompressionStream settles, which makes it useless for checking
 * anything that awaits a stream.
 *
 * Usage: node tools/shoot.mjs <url> <out.png> [waitMs] [width] [height]
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, out, waitMs = '2500', width = '1500', height = '900'] = process.argv.slice(2);
if (!url || !out) {
  console.error('Usage: node tools/shoot.mjs <url> <out.png> [waitMs] [width] [height]');
  process.exit(1);
}

const EDGE =
  process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const port = 9222 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), 'shoot-'));

const browser = spawn(EDGE, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  `--window-size=${width},${height}`,
  'about:blank',
]);

const cleanup = () => {
  browser.kill();
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* the browser may still hold a handle; harmless */
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function endpoint() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      return (await res.json()).webSocketDebuggerUrl;
    } catch {
      await sleep(150);
    }
  }
  throw new Error('Browser did not expose a debugging endpoint');
}

const ws = new WebSocket(await endpoint());
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let nextId = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  const resolve = pending.get(message.id);
  if (resolve) {
    pending.delete(message.id);
    resolve(message.result);
  }
};

const send = (method, params = {}, sessionId) =>
  new Promise((resolve) => {
    const id = (nextId += 1);
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  await send('Page.enable', {}, sessionId);
  // Edge refuses to size its window below roughly 500px, so narrow viewports
  // have to come from device emulation or a "mobile" screenshot is a lie.
  await send(
    'Emulation.setDeviceMetricsOverride',
    {
      width: Number(width),
      height: Number(height),
      deviceScaleFactor: 1,
      mobile: Number(width) < 700,
    },
    sessionId,
  );
  await send('Page.navigate', { url }, sessionId);
  await sleep(Number(waitMs));

  const { data } = await send(
    'Page.captureScreenshot',
    { format: 'png', captureBeyondViewport: false },
    sessionId,
  );
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log(`wrote ${out}`);
} finally {
  ws.close();
  cleanup();
}
