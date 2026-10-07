// Verificación visual/DOM en Chrome headless por CDP. No modifica datos del negocio.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const raw = fs.readFileSync('.env', 'utf8').match(/^DATABASE_URL\s*=\s*(.*)$/m)?.[1];
process.env.DATABASE_URL = raw.trim().replace(/^["']|["']$/g, '');
const prisma = new PrismaClient();
const output = path.resolve('.next/responsive-qa');
fs.mkdirSync(output, { recursive: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let ws, seq = 0;
const requests = new Set();
let lastNetwork = 0;
const pending = new Map();
function command(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
    pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(expression)) return; await sleep(200); }
  throw new Error(`No se cumplió la condición: ${expression}`);
}
async function viewport(width, height = 900) {
  await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await command('Emulation.setTouchEmulationEnabled', { enabled: width < 1024, maxTouchPoints: 1 });
  await sleep(180);
}
async function settle() {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (!requests.size && Date.now() - lastNetwork > 600) return;
    await sleep(200);
  }
  throw new Error('Las solicitudes de la página no terminaron');
}
async function capture(name) {
  const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(output, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
}
const probe = `(() => {
  const width = innerWidth;
  const offenders = [...document.querySelectorAll('main *, .flowbite-drawer-overlay *, dialog[open] *')].filter(el => {
    const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
    if (!rect.width || style.visibility === 'hidden' || style.display === 'none') return false;
    if (rect.right <= width + 2 && rect.left >= -2) return false;
    for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (['auto','scroll','hidden'].includes(getComputedStyle(ancestor).overflowX) && ancestor.getBoundingClientRect().width <= width) return false;
    }
    return true;
  }).slice(0, 12).map(el => ({ tag: el.tagName, class: String(el.className), text: el.textContent.trim().slice(0, 65), width: Math.round(el.getBoundingClientRect().width) }));
  return { width, scrollWidth: document.documentElement.scrollWidth, offenders };
})()`;
async function check(name) {
  const result = await evaluate(probe);
  await capture(name);
  console.log(JSON.stringify({ name, ...result }));
  return result;
}
const clickText = text => evaluate(`([...document.querySelectorAll('button,[role="button"]')].find(el => el.textContent.trim().includes(${JSON.stringify(text)}) && el.getBoundingClientRect().width) || {}).click?.()`);
async function navigate(route) {
  requests.clear();
  await command('Page.navigate', { url: `http://localhost:3000${route}` });
  await waitFor(`document.readyState === 'complete' && !!document.querySelector(${JSON.stringify(route === '/login' ? 'form' : 'main')})`);
  await sleep(500);
  await settle();
  await waitFor(`!document.body.innerText.includes('Cargando')`);
}
async function main() {
  const targets = await (await fetch('http://localhost:9222/json')).json();
  const target = targets.find(item => item.type === 'page');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const result = JSON.parse(event.data);
    if (result.method === 'Network.requestWillBeSent' && ['Fetch', 'XHR'].includes(result.params.type)) { requests.add(result.params.requestId); lastNetwork = Date.now(); }
    if (['Network.loadingFinished', 'Network.loadingFailed'].includes(result.method) && requests.delete(result.params.requestId)) lastNetwork = Date.now();
    const item = pending.get(result.id); if (!item) return;
    clearTimeout(item.timer); pending.delete(result.id); result.error ? item.reject(new Error(result.error.message)) : item.resolve(result.result);
  };
  await command('Page.enable'); await command('Runtime.enable'); await command('Network.enable');
  const session = await prisma.session.findFirstOrThrow({ where: { expiresAt: { gt: new Date() }, user: { isActive: true, username: 'admin' } } });
  await command('Network.setCookie', { name: 'sessionToken', value: session.sessionToken, url: 'http://localhost:3000', httpOnly: true });
  const results = [];
  if (!process.argv.includes('--finish')) {
  for (const route of ['/', '/operations', '/treasury', '/contacts', '/accounts', '/settings', '/audit', '/sql-console', '/manual', '/login']) {
    await viewport(1440); await navigate(route);
    for (const width of [1440, 768, 360, 320]) { await viewport(width); results.push(await check(`${route.replaceAll('/', '') || 'dashboard'}-${width}`)); }
  }
  await viewport(360); await navigate('/operations');
  const menu = await evaluate(`(() => { const r = document.querySelector('#app-menu-toggle').getBoundingClientRect(); return { x: r.x+r.width/2, y:r.y+r.height/2 }; })()`);
  await command('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [menu] });
  await command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await waitFor(`document.querySelector('.app-sidebar').classList.contains('is-open')`);
  await capture('navigation-360');
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await waitFor(`!document.querySelector('.app-sidebar').classList.contains('is-open')`);
  await clickText('Nueva Operación'); await sleep(250); results.push(await check('operation-selector-360'));
  await evaluate(`[...document.querySelectorAll('.flowbite-drawer-overlay div')].find(el => el.textContent.trim().startsWith('1. Venta distribuida') && el.style.cursor === 'pointer')?.click()`);
  await waitFor(`!!document.querySelector('#distributed-form')`);
  await settle();
  for (const width of [1440, 768, 360, 320]) { await viewport(width); results.push(await check(`operation-form-${width}`)); }
  await viewport(360); await clickText('Agregar línea');
  assert.equal(await evaluate(`document.querySelectorAll('.operation-client-table tbody tr').length`), 2);
  await evaluate(`document.querySelector('.operation-modal-body').scrollTop = document.querySelector('.operation-modal-body').scrollHeight`);
  results.push(await check('operation-client-fields-360'));
  await evaluate(`document.querySelector('.operation-client-table tr:last-child button.liquid-select-trigger')?.scrollIntoView({ block: 'center' })`);
  await evaluate(`document.querySelector('.operation-client-table tr:last-child button.liquid-select-trigger')?.click()`);
  await sleep(200); results.push(await check('operation-select-360'));
  await navigate('/operations'); await clickText('Nueva Operación'); await sleep(250);
  await evaluate(`document.querySelector('.flowbite-drawer-overlay').querySelectorAll('div[style]') && [...document.querySelectorAll('.flowbite-drawer-overlay div')].find(el => el.textContent.trim().startsWith('2. Operación Estándar') && el.style.cursor === 'pointer')?.click()`);
  await waitFor(`!!document.querySelector('#distributed-form')`); await settle();
  assert.equal(await evaluate(`document.querySelectorAll('.operation-client-table tbody tr').length`), 1);
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(el => el.textContent.includes('Agregar línea'))`), false);
  results.push(await check('single-operation-360'));
  await viewport(844, 390); results.push(await check('single-operation-landscape'));
  await viewport(360);
  await command('Page.navigate', { url: 'http://localhost:3000/treasury' });
  await waitFor(`!!document.querySelector('main') && !document.body.innerText.includes('Cargando')`); await sleep(500);
  await clickText('Historial'); await sleep(900); results.push(await check('treasury-history-360'));
  await clickText('Ingreso / extracción'); await waitFor(`!!document.querySelector('dialog[open]')`); results.push(await check('treasury-movement-360'));
  }
  await viewport(360);
  await navigate('/contacts'); await clickText('Nuevo Contacto'); await sleep(350); results.push(await check('contact-form-360'));
  await navigate('/accounts'); await clickText('Nuevo Movimiento'); await sleep(350); results.push(await check('account-form-360'));
  await navigate('/accounts');
  if (await evaluate(`[...document.querySelectorAll('button')].some(el => el.textContent.trim() === 'Mayor' && el.getBoundingClientRect().width)`)) {
    await clickText('Mayor'); await settle(); results.push(await check('account-ledger-360'));
  }
  await navigate('/settings');
  assert.equal(await evaluate(`document.body.innerText.includes('Ajustes del Sistema')`), true, 'Configuración debe cargar los controles del administrador');
  await clickText('Nueva Moneda'); await sleep(300); results.push(await check('currency-form-360'));
  await navigate('/settings'); await clickText('Nuevo Usuario'); await sleep(300); results.push(await check('user-form-360'));
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  await command('Browser.close');
  const issues = results.filter(result => result.scrollWidth > result.width + 2 || result.offenders.length);
  console.log(`Verificación completa: ${results.length} capturas; ${issues.length} con desbordes. Menú probado con toque sintetizado en Chromium.`);
  if (issues.length) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; ws?.close(); }).finally(() => prisma.$disconnect());
