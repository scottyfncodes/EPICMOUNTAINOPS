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
// Never run (it writes test data) against the production site.
if (REMOTE && /^https?:\/\/epic-mountain-ops\.vercel\.app$/i.test(REMOTE)) {
  console.error('Refusing to run against production. Use a preview deployment URL.')
  process.exit(2)
}
const RUN_START = new Date().toISOString()
const RUN_TAG = `E2E ${Date.now().toString(36)}`
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
let shareCookie = ''
/** Exchange a Vercel share token for its access cookie (Node fetch has no cookie jar). */
async function initShare(base) {
  if (!share) return
  const r = await fetch(`${base}/?${share}`, { redirect: 'manual' })
  const cookies = (r.headers.getSetCookie?.() || []).map((c) => c.split(';')[0])
  shareCookie = cookies.join('; ')
  if (!shareCookie) throw new Error(`Vercel did not accept the share token (HTTP ${r.status})`)
  const probe = await fetch(base + '/api/health', { headers: { cookie: shareCookie }, redirect: 'manual' })
  if (probe.status !== 200) throw new Error(`Share cookie did not grant access (HTTP ${probe.status})`)
}
const withCookie = (init = {}) => (shareCookie ? { ...init, headers: { ...(init.headers || {}), cookie: shareCookie } } : init)

async function newPage(browser, deviceOrViewport, base, extra = {}) {
  const opts = { ...(typeof deviceOrViewport === 'string' ? { ...devices[deviceOrViewport] } : { viewport: deviceOrViewport }), ...extra }
  const ctx = await browser.newContext(opts)
  if (share) await (await ctx.newPage()).goto(`${base}/?${share}`).then(() => {})
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
  const r = await fetch(base + path, withCookie(init))
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
  ok('save increments the revision', saved.status === 200 && saved.body.entity.rev === (gl.rev ?? 1) + 1, `rev ${gl.rev ?? 1}→${saved.body?.entity?.rev}`)

  const del = await api(base, '/api/entities?id=gl-fleet', { method: 'DELETE', headers: { 'x-ops-key': KEY } })
  const listed = await api(base, '/api/entities?deleted=1')
  ok('delete is soft and listed for restore', del.status === 200 && listed.body.entities.some((e) => e.id === 'gl-fleet'))
  const restored = await api(base, '/api/entities', jsonPost({ entity: listed.body.entities.find((e) => e.id === 'gl-fleet'), action: 'restore' }))
  const vers = (await api(base, '/api/versions?id=gl-fleet')).body.versions.map((v) => v.action)
  ok('restore brings it back with full history', restored.status === 200 && vers.slice(0, 3).join() === 'restore,delete,update' && vers.at(-1) === 'seed', vers.join())

  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const up = await api(base, '/api/images', jsonPost({ dataUrl: 'data:image/png;base64,' + png, width: 1, height: 1 }))
  const img = await fetch(`${base}/api/images?id=${up.body.image.id}`, withCookie())
  ok('image upload + immutable cached serving', img.status === 200 && img.headers.get('content-type') === 'image/png' && /immutable/.test(img.headers.get('cache-control')))
  ok('non-image uploads refused', [400, 415].includes((await api(base, '/api/images', jsonPost({ dataUrl: 'data:text/html;base64,PGgxPg==' }))).status))
}

const ROUTES = ['/', '/departments', '/departments/dept-ski', '/workflows', '/workflows/wf-ski-intake', '/workflows/wf-ski-intake?node=info', '/workflows/wf-ski-intake?view=guide', '/systems', '/systems/sys-reservations', '/equipment', '/glossary', '/glossary/gl-din', '/review', '/review/gaps', '/review/integrity', '/search?q=boot', '/add']

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
  const repair = await entity(base, 'wf-jrt-repair')
  const unknownHere = repair.nodes.filter((n) => n.kind === 'unknown').length
  ok('gaps lens flags unknown steps', (await page.locator('.opsnode--unknown.tone--gap').count()) === unknownHere, String(unknownHere))
  await page.getByRole('radio', { name: 'Flow', exact: true }).tap()
  await page.locator('button[aria-label="Field guide view"]').tap()
  await page.waitForTimeout(300)
  ok('guide view lists every step in order', (await page.locator('.guidestep, .guidemark').count()) === repair.nodes.length, String(repair.nodes.length))
  ok('guide groups steps into Do / Know / Check', (await page.locator('.guide .dkc--check').count()) > 0)
  ok('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

async function learningSuite(browser, base) {
  current = 'Learning & navigation'
  console.log('\n' + current)
  const all = await content(base)
  const wfs = all.filter((e) => e.type === 'workflow')
  const { ctx, page, errors } = await newPage(browser, 'iPhone 14 Pro', base)

  // route map on the home screen mirrors the hand-off data
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  ok('route map shows every workflow once', (await page.locator('.routemap .station').count()) === wfs.length, `${wfs.length} workflows`)
  const handoffs = wfs.flatMap((w) => w.nodes.filter((n) => n.kind === 'link' && n.linkWorkflowId).map((n) => [w, wfs.find((x) => x.id === n.linkWorkflowId)]))
  const crossing = handoffs.filter(([a, b]) => b && a.departmentIds[0] !== b.departmentIds[0]).length
  ok('route map interchanges match cross-department hand-offs', (await page.locator('.routemap .xfer--out').count()) === crossing, String(crossing))
  ok('route map breaks where no hand-off exists', (await page.locator('.routemap .route__gap').count()) >= 1)
  ok('route map fits in the first screen', (await page.locator('.routemap').boundingBox()).y < page.viewportSize().height)

  // resume where you left off
  await page.goto(base + '/workflows/wf-ski-boot-fit?node=bsl', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.goto(base + '/', { waitUntil: 'networkidle' })
  const resume = page.locator('.resume')
  ok('home offers to resume the exact step', (await resume.getAttribute('href')) === '/workflows/wf-ski-boot-fit?node=bsl')
  ok('resume card is above the fold', (await resume.boundingBox()).y + 40 < page.viewportSize().height)

  // department hub: each workflow once on the line, topics as an index
  await page.goto(base + '/departments/dept-ski', { waitUntil: 'networkidle' })
  const skiWf = wfs.filter((w) => w.departmentIds[0] === 'dept-ski')
  const stationHrefs = await page.locator('.routemap .station__link').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  ok('hub line lists each workflow exactly once', stationHrefs.length === skiWf.length && new Set(stationHrefs).size === stationHrefs.length, `${stationHrefs.length}`)
  const ski = all.find((e) => e.id === 'dept-ski')
  ok('hub keeps every topic', (await page.locator('.topic').count()) >= ski.sections.length)

  // guide: decisions jump to the right step; show on map selects it
  await page.goto(base + '/workflows/wf-ski-intake?view=guide', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.locator('.choice', { hasText: 'Yes' }).first().tap()
  await page.waitForTimeout(700)
  const top = await page.locator('#g-lookup').boundingBox()
  ok('guide choice jumps to its step', top.y < 260, `y=${Math.round(top.y)}`)
  await page.locator('#g-lookup .guidestep__foot button', { hasText: 'Show on map' }).tap()
  await page.waitForTimeout(800)
  ok('show on map opens that step on the map', page.url().includes('node=lookup') && (await page.locator('.react-flow__node.selected[data-id="lookup"]').count()) === 1)
  ok('step panel organises Do / Know / Check', (await page.locator('.sheet--explorer .dkc--do').count()) === 1)

  // glossary terms explain themselves in place
  await page.goto(base + '/workflows/wf-ski-boot-fit?node=bsl', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const here = page.url()
  await page.locator('.sheet--explorer a.gloss').first().tap()
  await page.waitForTimeout(300)
  ok('glossary term opens a definition without leaving the map', page.url() === here && (await page.locator('.peek__def').isVisible()))
  await page.keyboard.press('Escape')
  ok('definition closes', !(await page.locator('.peek').isVisible()))
  ok('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()

  // phones on their side: the panel docks beside the map
  for (const dev of ['iPhone SE landscape', 'iPhone 14 Pro landscape', 'iPhone 15 Pro Max landscape']) {
    const l = await newPage(browser, dev, base)
    await l.page.goto(base + '/workflows/wf-ski-boot-fit?node=bsl', { waitUntil: 'networkidle' })
    await l.page.waitForTimeout(800)
    const r = await l.page.evaluate(() => {
      const s = document.querySelector('.sheet--explorer').getBoundingClientRect()
      const n = document.querySelector('.react-flow__node.selected').getBoundingClientRect()
      return { beside: n.right <= s.left + 4 && n.left >= 0, tall: s.height > innerHeight * 0.6, overflow: document.documentElement.scrollWidth > innerWidth }
    })
    ok(`${dev}: step panel docks beside the map`, r.beside && r.tall && !r.overflow, JSON.stringify(r))
    await l.ctx.close()
  }
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
  await page.locator('.sheet--explorer .nodeeditor input').first().fill(RUN_TAG)
  await page.locator('.sheet--explorer .sheet__foot button[aria-label="Undo"]').tap()
  ok('undo groups typing into one step', (await page.locator('.react-flow__node', { hasText: RUN_TAG }).count()) === 0)
  await page.locator('.sheet--explorer .sheet__foot button[aria-label="Redo"]').tap()
  ok('redo', (await page.locator('.react-flow__node', { hasText: RUN_TAG }).count()) === 1)
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
  ok('saved to the database', saved.nodes.length === n0 + 2 && saved.nodes.some((n) => n.label === RUN_TAG))
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
  const obs = (await content(base))
    .filter((e) => e.type === 'note' && e.title === 'Tip from a coworker' && e.createdAt >= RUN_START)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .pop()
  ok('observation saved as Observed, first-hand source, linked', obs?.status === 'observed' && /First-hand/.test(obs.source) && obs.links[0].id === 'sys-inventory')

  const file = join(tmpdir(), `ops-e2e-${Date.now()}.png`)
  // 600×1200 PNG: white with a red band (stand-in for customer details)
  const shot = await page.evaluate((tag) => {
    const c = document.createElement('canvas')
    c.width = 600
    c.height = 1200
    const g = c.getContext('2d')
    g.fillStyle = '#fff'
    g.fillRect(0, 0, 600, 1200)
    g.fillStyle = '#dc1e1e'
    g.fillRect(60, 300, 480, 100)
    g.fillStyle = '#333'
    g.font = '28px sans-serif'
    g.fillText(tag, 60, 1100) // makes each run's image unique
    return c.toDataURL('image/png').split(',')[1]
  }, RUN_TAG)
  writeFileSync(file, Buffer.from(shot, 'base64'))
  const imagesBefore = new Set((await entity(base, 'wf-ski-intake')).nodes.find((n) => n.id === 'lookup').imageIds || [])
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
  const imgId = (node.imageIds || []).find((i) => !imagesBefore.has(i))
  ok('screenshot attached to the step', Boolean(imgId))
  if (!imgId) throw new Error('no new image attached')
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
  // First unverified glossary entry still in the queue (fresh each run).
  const row = page.locator('.reviewrow').filter({ has: page.locator('a[href^="/glossary/"]') }).first()
  const targetId = decodeURIComponent((await row.locator('a').getAttribute('href')).split('/').pop())
  await row.locator('button', { hasText: 'Review' }).tap()
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
  const cam = await entity(base, targetId)
  ok('status changed deliberately with source', cam.status === 'observed' && /First-hand/.test(cam.source), targetId)
  const v = (await api(base, '/api/versions?id=' + encodeURIComponent(targetId))).body.versions[0]
  ok('change recorded in history', /Unverified → Observed: Seen at the bench/.test(v.note || ''))
  const qCard = page.locator('.notecard--question:not(.is-resolved)').first()
  const qId = await qCard.getAttribute('id')
  await qCard.locator('button', { hasText: 'Answer' }).tap()
  await page.locator(`#ans-${qId}`).fill('E2E acceptance answer')
  await qCard.locator('button', { hasText: 'Resolve' }).tap()
  await page.waitForTimeout(1000)
  ok('questions resolve inline', (await entity(base, qId)).resolved === true, qId)
  await page.goto(base + '/review/gaps', { waitUntil: 'networkidle' })
  const allUnknown = (await content(base)).filter((e) => e.type === 'workflow').reduce((n, w) => n + w.nodes.filter((x) => x.kind === 'unknown').length, 0)
  ok('gaps list every unknown step', (await page.locator('.gapitem--unknown').count()) === allUnknown, String(allUnknown))
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
  const nRepair = (await entity(base, 'wf-jrt-repair')).nodes.length
  ok('minimap shows every step', (await page.locator('.react-flow__minimap-node').count()) === nRepair, String(nRepair))
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'desktop-explorer.png') })
  ok('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  await ctx.close()
}

async function a11ySuite(browser, base) {
  current = 'Accessibility (axe-core)'
  console.log('\n' + current)
  const axe = require('axe-core').source
  // The app's CSP (correctly) blocks injected inline scripts; only this audit context bypasses it.
  const { ctx, page } = await newPage(browser, 'iPhone 14 Pro', base, { bypassCSP: true })
  for (const r of ['/', '/departments', '/departments/dept-jr-trades', '/workflows', '/workflows/wf-ski-intake?node=has-res', '/workflows/wf-ski-intake?view=guide', '/systems/sys-rental-record', '/glossary', '/review', '/search?q=bsl']) {
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
    await initShare(base)
    await apiSuite(base)
    await layoutSuite(browser, base)
    await explorerSuite(browser, base)
    await learningSuite(browser, base)
    await editingSuite(browser, base)
    await captureSuite(browser, base)
    await reviewSuite(browser, base)
    await desktopSuite(browser, base)
    await a11ySuite(browser, base)
    if (!REMOTE) await privateSuite(browser)
    else console.log('\nPrivate mode: skipped against a deployment (needs a server started with OPS_PRIVATE=1) — run locally.')
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
