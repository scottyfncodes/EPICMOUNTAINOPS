#!/usr/bin/env node
/**
 * End-to-end suite for Epic Mountain Ops.
 *
 *   npm run test:e2e                 # boots isolated dev servers on throwaway Postgres (PGlite)
 *   BASE_URL=https://… OPS_EDIT_KEY=… npm run test:e2e   # runs against a deployed preview
 *
 * Against a deployment it WRITES test data — only point it at a preview
 * deployment backed by the preview database branch, never production.
 * Set VERCEL_SHARE=<_vercel_share token> to pass Vercel deployment protection.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
let pw
try {
  pw = require('playwright')
} catch {
  console.error('Playwright is required: npm i -g playwright && npx playwright install chromium')
  process.exit(2)
}
const { chromium, devices } = pw
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const REMOTE = process.env.BASE_URL?.replace(/\/$/, '')
const KEY = REMOTE ? process.env.OPS_EDIT_KEY : 'e2e-local-key-123'
const SHOTS = process.env.E2E_SHOTS
const PHONES = ['iPhone SE', 'iPhone 14 Pro', 'iPhone 15 Pro Max']
const results = []
let current = ''

const ok = (name, cond, extra = '') => {
  results.push({ suite: current, name, pass: Boolean(cond), extra })
  console.log(`${cond ? '  ✓' : '  ✗'} ${name}${extra ? ` — ${extra}` : ''}`)
}

/* ------------------------------------------------------------------ */
/* servers                                                             */
/* ------------------------------------------------------------------ */
async function startServer(port, env) {
  const dir = mkdtempSync(join(tmpdir(), 'ops-e2e-'))
  // Run Vite directly (not via npx) in its own process group so stopping it stops everything.
  const child = spawn(process.execPath, [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(port), '--host', '127.0.0.1', '--strictPort'], {
    cwd: ROOT,
    env: { ...process.env, OPS_DEV_DB: 'pglite', OPS_DEV_DB_DIR: dir, OPS_EDIT_KEY: KEY, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  const stop = () => {
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      child.kill('SIGTERM')
    }
    rmSync(dir, { recursive: true, force: true })
  }
  let log = ''
  child.stdout.on('data', (d) => (log += d))
  child.stderr.on('data', (d) => (log += d))
  const base = `http://127.0.0.1:${port}`
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(base + '/api/health')
      if (r.ok) return { base, stop }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  stop()
  throw new Error('Dev server did not start:\n' + log)
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
const share = process.env.VERCEL_SHARE ? `_vercel_share=${process.env.VERCEL_SHARE}` : ''
const withShare = (url) => (share ? url + (url.includes('?') ? '&' : '?') + share : url)

async function newPage(browser, deviceOrViewport, base) {
  const opts = typeof deviceOrViewport === 'string' ? { ...devices[deviceOrViewport] } : { viewport: deviceOrViewport }
  const ctx = await browser.newContext(opts)
  if (share) await (await ctx.newPage()).goto(withShare(base + '/api/health')).then(() => {})
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/401 \(Unauthorized\)/.test(t)) return // expected in auth tests
    errors.push(t)
  })
  return { ctx, page, errors }
}

async function unlockByStorage(page, base) {
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  await page.evaluate((k) => localStorage.setItem('ops.editKey', k), KEY)
}

const vp = (page) =>
  page.evaluate(() => {
    const m = new DOMMatrix(getComputedStyle(document.querySelector('.react-flow__viewport')).transform)
    return { x: m.e, y: m.f, z: m.a }
  })

async function api(base, path, init = {}) {
  const r = await fetch(withShare(base + path), init)
  let body = null
  try {
    body = await r.json()
  } catch {
    /* binary */
  }
  return { status: r.status, body, headers: r.headers }
}
const content = async (base) => (await api(base, '/api/content')).body.entities
const entity = async (base, id) => (await content(base)).find((e) => e.id === id)
const jsonPost = (body, key = KEY) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ops-key': key }, body: JSON.stringify(body) })

/* ------------------------------------------------------------------ */
/* suites                                                              */
/* ------------------------------------------------------------------ */
async function apiSuite(base) {
  current = 'API & integrity'
  console.log('\n' + current)
  const bad = await api(base, '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"key":"nope"}' })
  ok('wrong key rejected', bad.status === 401)
  const good = await api(base, '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: KEY }) })
  ok('right key accepted and opens a HttpOnly read session', good.status === 200 && /ops_read=.*HttpOnly/.test(good.headers.get('set-cookie') || ''))
  ok('write without key refused', (await api(base, '/api/entities', jsonPost({ entity: {} }, ''))).status === 401)
  ok('API sends nosniff', (await api(base, '/api/content')).headers.get('x-content-type-options') === 'nosniff')

  const wf = await entity(base, 'wf-snb-intake')
  const dup = { ...wf, nodes: [...wf.nodes, { ...wf.nodes[0] }] }
  const r1 = await api(base, '/api/entities', jsonPost({ entity: dup, baseUpdatedAt: wf.updatedAt }))
  ok('server rejects duplicate step ids', r1.status === 400 && /share the id/.test(r1.body.error))
  const dangling = { ...wf, edges: [...wf.edges, { id: 'x', source: 'start', target: 'ghost' }] }
  ok('server rejects dangling connections', (await api(base, '/api/entities', jsonPost({ entity: dangling, baseUpdatedAt: wf.updatedAt }))).status === 400)
  const gl = await entity(base, 'gl-fleet')
  const v1 = await api(base, '/api/entities', jsonPost({ entity: { ...gl, status: 'verified' }, baseUpdatedAt: gl.updatedAt }))
  ok('server refuses Verified backed only by the placeholder source', v1.status === 400 && /authorized/.test(v1.body.error))
  const stale = await api(base, '/api/entities', jsonPost({ entity: { ...gl, title: 'Fleet' }, baseUpdatedAt: 'stale' }))
  ok('stale edit refused (409) instead of overwriting', stale.status === 409)
  const saved = await api(base, '/api/entities', jsonPost({ entity: { ...gl, notes: 'e2e' }, baseUpdatedAt: gl.updatedAt }))
  ok('save increments the revision', saved.status === 200 && saved.body.entity.rev === 2, `rev=${saved.body?.entity?.rev}`)

  const del = await api(base, '/api/entities?id=gl-fleet', { method: 'DELETE', headers: { 'x-ops-key': KEY } })
  const listed = await api(base, '/api/entities?deleted=1')
  ok('delete is soft and listed for restore', del.status === 200 && listed.body.entities.some((e) => e.id === 'gl-fleet'))
  const restored = await api(base, '/api/entities', jsonPost({ entity: listed.body.entities.find((e) => e.id === 'gl-fleet'), action: 'restore' }))
  const vers = (await api(base, '/api/versions?id=gl-fleet')).body.versions.map((v) => v.action)
  ok('restore brings it back with full history', restored.status === 200 && vers.join() === 'restore,delete,update,seed', vers.join())

  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const up = await api(base, '/api/images', jsonPost({ dataUrl: 'data:image/png;base64,' + png, width: 1, height: 1 }))
  const img = await fetch(withShare(`${base}/api/images?id=${up.body.image.id}`))
  ok('image upload + immutable cached serving', img.status === 200 && img.headers.get('content-type') === 'image/png' && /immutable/.test(img.headers.get('cache-control')))
  ok('non-image uploads refused', [400, 415].includes((await api(base, '/api/images', jsonPost({ dataUrl: 'data:text/html;base64,PGgxPg==' }))).status))
}

const ROUTES = ['/', '/departments', '/departments/dept-ski', '/workflows', '/workflows/wf-ski-intake', '/workflows/wf-ski-intake?node=info', '/systems', '/systems/sys-reservations', '/equipment', '/glossary', '/glossary/gl-din', '/review', '/review/gaps', '/review/integrity', '/search?q=boot', '/add']

async function layoutSuite(browser, base) {
  current = 'iPhone layouts'
  console.log('\n' + current)
  for (const dev of PHONES) {
    const { ctx, page, errors } = await newPage(browser, dev, base)
    const widened = []
    for (const r of ROUTES) {
      await page.goto(base + r, { waitUntil: 'networkidle' })
      await page.waitForTimeout(200)
      if ((await page.evaluate(() => innerWidth)) > page.viewportSize().width) widened.push(r)
    }
    ok(`${dev}: no horizontal overflow on ${ROUTES.length} routes`, widened.length === 0, widened.join(' '))
    ok(`${dev}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
    await ctx.close()
  }
  const { ctx, page } = await newPage(browser, 'iPhone 14 Pro', base)
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('.rail__item, .topbar .iconbtn, .btn, .xctl, .qchip')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && (r.height < 36 || r.width < 36)
      })
      .map((el) => el.textContent.trim() || el.getAttribute('aria-label')),
  )
  ok('touch targets ≥ 36px', small.length === 0, small.join(', '))
  await ctx.close()
}

async function explorerSuite(browser, base) {
  current = 'Workflow explorer'
  console.log('\n' + current)
  const { ctx, page, errors } = await newPage(browser, 'iPhone 14 Pro', base)
  await page.goto(base + '/workflows/wf-ski-return', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.locator('.react-flow__node[data-id="damage"]').tap()
  await page.waitForTimeout(400)
  ok('tap a step opens its page', (await page.locator('.sheet--explorer .sheet__title').textContent()).includes('Damage'))
  ok('URL deep-links the step', page.url().includes('node=damage'))
  await page.locator('.nextbtn--yes').tap()
  await page.waitForTimeout(400)
  ok('branch buttons walk the flow', page.url().includes('node=tag'))
  await page.goto(base + '/workflows/wf-ski-return?node=to-shop', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.locator('.handoff').tap()
  await page.waitForTimeout(900)
  ok('hand-off opens the linked workflow', page.url().includes('/workflows/wf-jrt-repair'))
  ok('came-from breadcrumb leads back', await page.locator('.camefrom', { hasText: 'SKI-05' }).isVisible())
  const routes = await page.evaluate(() => [...document.querySelectorAll('.react-flow__edge')].length)
  ok('connectors render', routes > 8, String(routes))

  const cdp = await ctx.newCDPSession(page)
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) })
  const before = await vp(page)
  await touch('touchStart', [[165, 420], [225, 420]])
  for (let i = 1; i <= 10; i++) await touch('touchMove', [[165 - i * 9, 420], [225 + i * 9, 420]])
  await touch('touchEnd', [])
  await page.waitForTimeout(300)
  const pinch = await vp(page)
  ok('pinch-to-zoom', pinch.z > before.z * 1.3, `${before.z.toFixed(2)}→${pinch.z.toFixed(2)}`)
  await touch('touchStart', [[200, 450]])
  for (let i = 1; i <= 10; i++) await touch('touchMove', [[200 - i * 8, 450 - i * 10]])
  await touch('touchEnd', [])
  await page.waitForTimeout(300)
  const pan = await vp(page)
  ok('drag to pan', Math.abs(pan.x - pinch.x) > 40)
  await touch('touchStart', [[150, 450], [250, 450]])
  for (let i = 1; i <= 10; i++) await touch('touchMove', [[150 + i * 8, 450 + i * 6], [250 + i * 8, 450 + i * 6]])
  await touch('touchEnd', [])
  await page.waitForTimeout(300)
  ok('two-finger pan', Math.abs((await vp(page)).x - pan.x) > 30)
  await page.locator('button[aria-label="Fit whole workflow"]').tap()
  await page.waitForTimeout(700)
  ok('fit to screen', (await vp(page)).z < pinch.z)

  for (const lens of ['Status', 'Gaps', 'Systems']) {
    await page.getByRole('radio', { name: lens, exact: true }).tap()
    await page.waitForTimeout(250)
  }
  ok('lenses tint steps', (await page.locator('.opsnode.tone--hit, .opsnode.tone--gap, .opsnode.tone--unverified').count()) > 0)
  await page.getByRole('radio', { name: 'Gaps', exact: true }).tap()
  ok('gaps lens flags unknown steps', (await page.locator('.opsnode--unknown.tone--gap').count()) === 2)
  await page.getByRole('radio', { name: 'Flow', exact: true }).tap()
  await page.locator('button[aria-label="Step list view"]').tap()
  ok('step list view', (await page.locator('.steprow').count()) === 12)
  ok('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

async function editingSuite(browser, base) {
  current = 'Editing on iPhone'
  console.log('\n' + current)
  const { ctx, page, errors } = await newPage(browser, 'iPhone 14 Pro', base)
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  await page.locator('button[aria-label="Unlock editing"]').tap()
  await page.locator('#edit-key').fill('wrong')
  await page.locator('form .btn--block').tap()
  await page.waitForTimeout(900)
  ok('unlock: wrong key refused', await page.locator('.error-text').isVisible())
  await page.locator('#edit-key').fill(KEY)
  await page.locator('form .btn--block').tap()
  await page.waitForTimeout(1000)
  ok('unlock: key accepted', await page.locator('button[aria-label="Editing unlocked — tap to lock"]').isVisible())

  await page.goto(base + '/workflows/wf-snb-intake', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const count = () => page.locator('.react-flow__node').count()
  const n0 = await count()
  await page.locator('button[aria-label="Edit workflow map"]').tap()
  await page.locator('.react-flow__node[data-id="info"]').tap()
  await page.waitForTimeout(300)
  await page.locator('.nodeeditor button', { hasText: 'Next step' }).tap()
  await page.waitForTimeout(400)
  ok('add next step', (await count()) === n0 + 1)
  await page.locator('.sheet--explorer .nodeeditor input').first().fill('E2E step')
  await page.locator('.sheet--explorer .sheet__foot button[aria-label="Undo"]').tap()
  ok('undo groups typing into one step', (await page.locator('.react-flow__node', { hasText: 'E2E step' }).count()) === 0)
  await page.locator('.sheet--explorer .sheet__foot button[aria-label="Redo"]').tap()
  ok('redo', (await page.locator('.react-flow__node', { hasText: 'E2E step' }).count()) === 1)
  await page.locator('.sheet--explorer button[aria-label="Close panel"]').tap()
  await page.locator('.edgelabel', { hasText: 'Yes' }).first().tap()
  await page.locator('button', { hasText: 'Insert step here' }).tap()
  await page.waitForTimeout(500)
  ok('insert a step on a connector', (await count()) === n0 + 2)
  await page.waitForTimeout(700)
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  ok('unsaved edits survive a reload', (await page.locator('.restored').isVisible()) && (await count()) === n0 + 2)
  await page.locator('.sheet--explorer .sheet__foot button', { hasText: 'Save' }).tap()
  await page.waitForTimeout(1500)
  const saved = await entity(base, 'wf-snb-intake')
  ok('saved to the database', saved.nodes.length === n0 + 2 && saved.nodes.some((n) => n.label === 'E2E step'))
  ok('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

async function captureSuite(browser, base) {
  current = 'Field capture'
  console.log('\n' + current)
  const { ctx, page, errors } = await newPage(browser, 'iPhone 14 Pro', base)
  await unlockByStorage(page, base)
  await page.goto(base + '/systems/sys-inventory', { waitUntil: 'networkidle' })
  await page.locator('button[aria-label="Capture information"]').tap()
  ok('capture pre-links the current page', (await page.locator('.aboutbar__chip').textContent()).includes('inventory'))
  await page.locator('.captile', { hasText: 'Observation' }).tap()
  await page.locator('.qchip', { hasText: 'Tip from a coworker' }).tap()
  await page.locator('button', { hasText: 'Save observation' }).tap()
  await page.waitForTimeout(1200)
  const obs = (await content(base)).find((e) => e.type === 'note' && e.title === 'Tip from a coworker')
  ok('observation saved as Observed, first-hand source, linked', obs?.status === 'observed' && /First-hand/.test(obs.source) && obs.links[0].id === 'sys-inventory')

  const file = join(tmpdir(), `ops-e2e-${Date.now()}.png`)
  // 600×1200 PNG: white with a red band (stand-in for customer details)
  const shot = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 600
    c.height = 1200
    const g = c.getContext('2d')
    g.fillStyle = '#fff'
    g.fillRect(0, 0, 600, 1200)
    g.fillStyle = '#dc1e1e'
    g.fillRect(60, 300, 480, 100)
    return c.toDataURL('image/png').split(',')[1]
  })
  writeFileSync(file, Buffer.from(shot, 'base64'))
  await page.goto(base + '/workflows/wf-ski-intake?node=lookup', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.locator('.sheet--explorer .quickcap__btn', { hasText: 'Screenshot' }).tap()
  await page.setInputFiles('.sheet--capture input[type=file]', file)
  await page.waitForTimeout(1200)
  const box = await page.locator('.annot__canvas').boundingBox()
  const fx = (x) => box.x + (x / 600) * box.width
  const fy = (y) => box.y + (y / 1200) * box.height
  await page.locator('.annot__tool', { hasText: 'Redact' }).tap()
  await page.mouse.move(fx(40), fy(280))
  await page.mouse.down()
  await page.mouse.move(fx(560), fy(420), { steps: 5 })
  await page.mouse.up()
  await page.locator('.annot__tool', { hasText: 'Arrow' }).tap()
  await page.mouse.move(fx(100), fy(900))
  await page.mouse.down()
  await page.mouse.move(fx(400), fy(700), { steps: 5 })
  await page.mouse.up()
  ok('annotator records marks across the whole image', (await page.locator('.annot__canvas').getAttribute('data-marks')) === '2')
  await page.locator('.annot button', { hasText: 'Use image' }).tap()
  await page.locator('.qchip', { hasText: 'System screen' }).tap()
  await page.locator('.sheet--capture .btn--primary', { hasText: 'Attach to' }).tap()
  await page.waitForTimeout(2000)
  const node = (await entity(base, 'wf-ski-intake')).nodes.find((n) => n.id === 'lookup')
  const imgId = node.imageIds?.[0]
  ok('screenshot attached to the step', Boolean(imgId))
  const px = await page.evaluate(async (id) => {
    const img = new Image()
    img.src = '/api/images?id=' + id
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    return [...g.getImageData(Math.round(img.naturalWidth / 2), Math.round(img.naturalHeight * (350 / 1200)), 1, 1).data]
  }, imgId)
  ok('redaction is baked into the uploaded pixels', px[0] < 60, JSON.stringify(px))
  rmSync(file, { force: true })
  ok('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

async function reviewSuite(browser, base) {
  current = 'Review & verification'
  console.log('\n' + current)
  const { ctx, page, errors } = await newPage(browser, 'iPhone 14 Pro', base)
  await unlockByStorage(page, base)
  await page.goto(base + '/review', { waitUntil: 'networkidle' })
  await page.locator('.reviewrow', { hasText: 'Camber' }).locator('button', { hasText: 'Review' }).tap()
  const sheet = page.locator('.sheet--status')
  await sheet.getByRole('radio', { name: /^Verified/ }).tap()
  await sheet.locator('button', { hasText: 'Save review' }).tap()
  await page.waitForTimeout(300)
  ok('Verified blocked without an authorized source', await sheet.locator('.editor-foot__err').isVisible())
  await sheet.getByRole('radio', { name: /^Observed/ }).tap()
  await sheet.locator('.qchip', { hasText: 'First-hand observation' }).tap()
  await sheet.locator('#review-note').fill('Seen at the bench')
  await sheet.locator('button', { hasText: 'Save review' }).tap()
  await page.waitForTimeout(1200)
  const cam = await entity(base, 'gl-camber')
  ok('status changed deliberately with source', cam.status === 'observed' && /First-hand/.test(cam.source))
  const v = (await api(base, '/api/versions?id=gl-camber')).body.versions[0]
  ok('change recorded in history', /Unverified → Observed: Seen at the bench/.test(v.note || ''))
  await page.locator('#q-res-system button', { hasText: 'Answer' }).tap()
  await page.locator('#ans-q-res-system').fill('Not confirmed yet — ask at next shift')
  await page.locator('#q-res-system button', { hasText: 'Resolve' }).tap()
  await page.waitForTimeout(1000)
  ok('questions resolve inline', (await entity(base, 'q-res-system')).resolved === true)
  await page.goto(base + '/review/gaps', { waitUntil: 'networkidle' })
  ok('gaps list every unknown step', (await page.locator('.gapitem--unknown').count()) === 5)
  await page.goto(base + '/review/integrity', { waitUntil: 'networkidle' })
  ok('integrity report clean', await page.locator('.empty__title', { hasText: 'intact' }).isVisible())
  ok('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

async function desktopSuite(browser, base) {
  current = 'Desktop'
  console.log('\n' + current)
  const { ctx, page, errors } = await newPage(browser, { width: 1440, height: 900 }, base)
  await page.goto(base + '/workflows/wf-jrt-repair', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const a = await vp(page)
  await page.mouse.move(600, 450)
  await page.mouse.wheel(0, -300)
  await page.waitForTimeout(300)
  const b = await vp(page)
  ok('mouse wheel zooms', b.z > a.z)
  await page.evaluate(() => {
    const el = document.querySelector('.react-flow__pane')
    for (let i = 0; i < 6; i++) el.dispatchEvent(new WheelEvent('wheel', { deltaX: 12.5, deltaY: 18.25, bubbles: true, cancelable: true, clientX: 600, clientY: 400 }))
  })
  await page.waitForTimeout(300)
  const c = await vp(page)
  ok('trackpad scroll pans without zooming', Math.abs(c.z - b.z) < 0.001 && (c.x !== b.x || c.y !== b.y))
  await page.evaluate(() => {
    const el = document.querySelector('.react-flow__pane')
    for (let i = 0; i < 6; i++) el.dispatchEvent(new WheelEvent('wheel', { deltaY: -8, ctrlKey: true, bubbles: true, cancelable: true, clientX: 600, clientY: 400 }))
  })
  await page.waitForTimeout(300)
  ok('trackpad pinch zooms', (await vp(page)).z > c.z)
  ok('minimap shows every step', (await page.locator('.react-flow__minimap-node').count()) === 12)
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'desktop-explorer.png') })
  ok('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

async function a11ySuite(browser, base) {
  current = 'Accessibility (axe-core)'
  console.log('\n' + current)
  const axe = require('axe-core').source
  const { ctx, page } = await newPage(browser, 'iPhone 14 Pro', base)
  for (const r of ['/', '/departments/dept-jr-trades', '/workflows', '/workflows/wf-ski-intake?node=has-res', '/systems/sys-rental-record', '/glossary', '/review', '/search?q=bsl']) {
    await page.goto(base + r, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await page.addScriptTag({ content: axe })
    const res = await page.evaluate(async () => {
      // React Flow's internal ARIA live region and the decorative canvas are excluded.
      const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'], resultTypes: ['violations'] })
      return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} (${v.nodes.length})`)
    })
    ok(`${r}: no serious/critical WCAG A/AA violations`, res.length === 0, res.join(', '))
  }
  await ctx.close()
}

async function privateSuite(browser) {
  current = 'Private mode'
  console.log('\n' + current)
  const srv = await startServer(5199, { OPS_PRIVATE: '1' })
  try {
    const base = srv.base
    ok('reads refused without a key', (await api(base, '/api/content')).status === 401)
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const up = await api(base, '/api/images', jsonPost({ dataUrl: 'data:image/png;base64,' + png, width: 1, height: 1 }))
    ok('images refused without a session', (await fetch(`${base}/api/images?id=${up.body.image.id}`)).status === 401)
    const { ctx, page, errors } = await newPage(browser, 'iPhone 14 Pro', base)
    await page.goto(base + '/', { waitUntil: 'networkidle' })
    ok('lock screen instead of content', await page.locator('h1', { hasText: 'This atlas is private' }).isVisible())
    await page.locator('button', { hasText: 'Enter key' }).tap()
    await page.locator('#edit-key').fill(KEY)
    await page.locator('form .btn--block').tap()
    await page.waitForTimeout(1500)
    ok('unlocking loads the atlas', await page.locator('.masthead__title').isVisible())
    const imgOk = await page.evaluate(async (id) => (await fetch('/api/images?id=' + id)).status, up.body.image.id)
    ok('read session cookie lets images load (no key in URLs)', imgOk === 200)
    page.once('dialog', (d) => d.accept())
    await page.locator('button[aria-label="Editing unlocked — tap to lock"]').tap()
    await page.waitForTimeout(800)
    ok('locking shows the lock screen again', await page.locator('h1', { hasText: 'This atlas is private' }).isVisible())
    const after = await page.evaluate(async () => (await fetch('/api/content')).status)
    ok('locking ends the read session', after === 401)
    ok('cached copy cleared on lock', (await page.evaluate(() => localStorage.getItem('ops.cache.v1'))) === null)
    ok('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    await ctx.close()
  } finally {
    srv.stop()
  }
}

/* ------------------------------------------------------------------ */
async function main() {
  const browser = await chromium.launch()
  let srv = null
  try {
    const base = REMOTE || (srv = await startServer(5198, {})).base
    console.log(`Epic Mountain Ops E2E → ${base}`)
    await apiSuite(base)
    await layoutSuite(browser, base)
    await explorerSuite(browser, base)
    await editingSuite(browser, base)
    await captureSuite(browser, base)
    await reviewSuite(browser, base)
    await desktopSuite(browser, base)
    await a11ySuite(browser, base)
    if (!REMOTE) await privateSuite(browser)
  } catch (err) {
    results.push({ suite: current, name: 'suite crashed', pass: false, extra: String(err?.message || err).split('\n')[0] })
    console.error(err)
  } finally {
    await browser.close()
    srv?.stop()
  }
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) {
    for (const f of failed) console.log(`  ✗ [${f.suite}] ${f.name} ${f.extra}`)
    process.exit(1)
  }
  process.exit(0)
}

main()
