import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { SEED_UPDATES, SEED_VERSION, seedEntities } from '../shared/seed.js'
import type { Entity, ImageMeta, VersionRecord } from '../shared/types.js'
import { ID_RE, validateEntityShape, ValidationError, verificationProblem } from '../shared/validate.js'

/* ------------------------------------------------------------------ */
/* HTTP helpers (plain Node req/res — works on Vercel and in Vite dev) */
/* ------------------------------------------------------------------ */
export type Req = IncomingMessage & { body?: unknown; query?: Record<string, string | string[]> }
export type Res = ServerResponse

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export function send(res: Res, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (!headers['Cache-Control']) res.setHeader('Cache-Control', 'no-store')
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  res.end(JSON.stringify(body))
}

export function query(req: Req, key: string): string | undefined {
  const url = new URL(req.url || '/', 'http://local')
  return url.searchParams.get(key) ?? undefined
}

const MAX_BODY = 4_200_000

export async function readJson<T = any>(req: Req): Promise<T> {
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body as T
  if (typeof req.body === 'string') return JSON.parse(req.body) as T
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > MAX_BODY) throw new HttpError(413, 'Request too large')
    chunks.push(chunk as Buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {} as T
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new HttpError(400, 'Invalid JSON')
  }
}

export function handler(methods: Record<string, (req: Req, res: Res) => Promise<void>>) {
  return async (req: Req, res: Res) => {
    const fn = methods[req.method || 'GET']
    if (!fn) return send(res, 405, { error: 'Method not allowed' })
    try {
      await fn(req, res)
    } catch (err) {
      const status = err instanceof HttpError ? err.status : err instanceof ValidationError ? 400 : 500
      if (status >= 500) console.error('[api]', err)
      send(res, status, { error: status >= 500 ? 'Server error — your change was not saved.' : (err as Error).message })
    }
  }
}

/* ------------------------------------------------------------------ */
/* Auth: single owner edit key (upgradeable to real users later)      */
/* ------------------------------------------------------------------ */
const hash = (s: string) => createHash('sha256').update(s).digest()

export function keyMatches(given: string | undefined | null): boolean {
  const expected = process.env.OPS_EDIT_KEY
  if (!expected || !given) return false
  return timingSafeEqual(hash(given), hash(expected))
}

export function requireEditor(req: Req) {
  if (!process.env.OPS_EDIT_KEY) throw new HttpError(503, 'Editing is not configured on this server (OPS_EDIT_KEY missing).')
  const given = req.headers['x-ops-key']
  if (!keyMatches(Array.isArray(given) ? given[0] : given)) throw new HttpError(401, 'Edit key required or incorrect.')
}

/* Read session (private mode).
 * Images can't send headers, so after a successful unlock the server sets an
 * HttpOnly cookie holding an HMAC derived from the key (never the key itself).
 * Rotating OPS_EDIT_KEY invalidates every outstanding session automatically. */
export const READ_COOKIE = 'ops_read'

export function readToken(): string | null {
  const key = process.env.OPS_EDIT_KEY
  return key ? createHmac('sha256', key).update('ops-read-session-v1').digest('base64url') : null
}

function cookie(req: Req, name: string): string | undefined {
  const raw = req.headers.cookie
  if (!raw) return undefined
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return undefined
}

export function hasReadSession(req: Req): boolean {
  const expected = readToken()
  const given = cookie(req, READ_COOKIE)
  if (!expected || !given) return false
  return timingSafeEqual(hash(given), hash(expected))
}

export function readCookieHeader(clear = false): string {
  const secure = process.env.VERCEL ? '; Secure' : ''
  return clear
    ? `${READ_COOKIE}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0${secure}`
    : `${READ_COOKIE}=${readToken()}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=15552000${secure}`
}

export const isPrivate = () => process.env.OPS_PRIVATE === '1'

/** Optional private mode: when OPS_PRIVATE=1 every read needs the key or a read session. */
export function requireReader(req: Req) {
  if (!isPrivate()) return
  const header = req.headers['x-ops-key']
  if (keyMatches(Array.isArray(header) ? header[0] : header)) return
  if (hasReadSession(req)) return
  throw new HttpError(401, 'This atlas is private. Enter your key.')
}

/* ------------------------------------------------------------------ */
/* Database                                                           */
/* ------------------------------------------------------------------ */
let _sql: NeonQueryFunction<false, false> | null = null
function db() {
  // Local development may inject an in-process Postgres (see server/dev-sql.ts).
  const injected = (globalThis as any).__opsDevSql
  if (injected) return injected as NeonQueryFunction<false, false>
  if (!_sql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new HttpError(503, 'Storage is not configured (DATABASE_URL missing).')
    _sql = neon(url)
  }
  return _sql
}

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS entities (
     id text PRIMARY KEY,
     type text NOT NULL,
     data jsonb NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now(),
     deleted_at timestamptz
   )`,
  `CREATE INDEX IF NOT EXISTS entities_type_idx ON entities(type)`,
  `CREATE TABLE IF NOT EXISTS entity_versions (
     id bigserial PRIMARY KEY,
     entity_id text NOT NULL,
     action text NOT NULL,
     note text,
     data jsonb NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS entity_versions_entity_idx ON entity_versions(entity_id, id DESC)`,
  `CREATE TABLE IF NOT EXISTS images (
     id text PRIMARY KEY,
     mime text NOT NULL,
     data text NOT NULL,
     width int,
     height int,
     bytes int,
     caption text,
     created_at timestamptz NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS app_meta (key text PRIMARY KEY, value jsonb NOT NULL)`,
]

let ready: Promise<void> | null = null

export function ensureReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const sql = db()
      for (const m of MIGRATIONS) await sql.query(m)
      const rows = await sql.query(`SELECT value FROM app_meta WHERE key = 'seed_version'`)
      if (rows.length === 0) {
        const queries = seedEntities.flatMap((e) => [
          sql.query(
            `INSERT INTO entities (id, type, data, created_at, updated_at) VALUES ($1, $2, $3, $4, $4) ON CONFLICT (id) DO NOTHING`,
            [e.id, e.type, JSON.stringify(e), e.createdAt],
          ),
          sql.query(`INSERT INTO entity_versions (entity_id, action, note, data) VALUES ($1, 'seed', 'Illustrative starter content', $2)`, [
            e.id,
            JSON.stringify(e),
          ]),
        ])
        queries.push(
          sql.query(`INSERT INTO app_meta (key, value) VALUES ('seed_version', $1) ON CONFLICT (key) DO NOTHING`, [JSON.stringify(SEED_VERSION)]),
        )
        await sql.transaction(queries)
      } else if (Number((rows[0] as any).value) < SEED_VERSION) {
        await applySeedUpdates(Number((rows[0] as any).value))
      }
    })().catch((err) => {
      ready = null
      throw err
    })
  }
  return ready
}

/**
 * Bring an existing database's starter content up to the current seed version
 * without ever overwriting someone's work:
 *  - new items are inserted;
 *  - existing items are replaced only while untouched (no `rev`, which every
 *    save through the API sets) and not deleted.
 * One transaction; an advisory lock plus a version check inside every
 * statement makes concurrent cold starts apply it exactly once.
 */
export async function applySeedUpdates(from: number): Promise<void> {
  const sql = db()
  const byId = new Map(seedEntities.map((e) => [e.id, e]))
  const pending = `(SELECT (value #>> '{}')::int FROM app_meta WHERE key = 'seed_version') < $5::int`
  const queries = [sql.query(`SELECT pg_advisory_xact_lock(7041977)`)]
  for (let v = from + 1; v <= SEED_VERSION; v++) {
    const step = SEED_UPDATES[v]
    if (!step) continue
    for (const id of step.ids) {
      const e = byId.get(id)
      if (!e) continue
      queries.push(
        sql.query(
          `WITH up AS (
             INSERT INTO entities (id, type, data, created_at, updated_at)
             SELECT $1::text, $2::text, $3::jsonb, $4::timestamptz, $4::timestamptz WHERE ${pending}
             ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
               WHERE entities.deleted_at IS NULL AND entities.data->>'rev' IS NULL AND entities.type = EXCLUDED.type
             RETURNING id, data
           )
           INSERT INTO entity_versions (entity_id, action, note, data) SELECT id, 'seed', $6::text, data FROM up`,
          [e.id, e.type, JSON.stringify(e), e.updatedAt, v, step.note],
        ),
      )
    }
  }
  queries.push(
    sql.query(`UPDATE app_meta SET value = $1 WHERE key = 'seed_version' AND (value #>> '{}')::int < $2`, [JSON.stringify(SEED_VERSION), SEED_VERSION]),
  )
  await sql.transaction(queries)
}

/* ------------------------------------------------------------------ */
/* Entities                                                           */
/* ------------------------------------------------------------------ */

export async function listEntities(): Promise<Entity[]> {
  await ensureReady()
  const rows = await db().query(`SELECT data FROM entities WHERE deleted_at IS NULL ORDER BY type, id`)
  return rows.map((r: any) => r.data as Entity)
}

export async function listImages(): Promise<ImageMeta[]> {
  await ensureReady()
  const rows = await db().query(`SELECT id, mime, width, height, bytes, caption, created_at FROM images ORDER BY created_at DESC`)
  return rows.map((r: any) => ({
    id: r.id,
    mime: r.mime,
    width: r.width ?? undefined,
    height: r.height ?? undefined,
    bytes: r.bytes ?? undefined,
    caption: r.caption ?? undefined,
    createdAt: new Date(r.created_at).toISOString(),
  }))
}


export async function saveEntity(raw: unknown, opts: { baseUpdatedAt?: string; note?: string; action?: 'restore' }): Promise<Entity> {
  await ensureReady()
  const entity = validateEntityShape(raw)
  const sql = db()
  if (entity.status === 'verified' && entity.type !== 'source' && !entity.source?.trim()) {
    const ids = entity.sourceIds || []
    const rows = ids.length ? await sql.query(`SELECT id, data FROM entities WHERE id = ANY($1) AND type = 'source' AND deleted_at IS NULL`, [ids]) : []
    const byId = new Map(rows.map((r: any) => [r.id, r.data]))
    const problem = verificationProblem(entity, (id) => byId.get(id))
    if (problem) throw new ValidationError(problem)
  }
  const existing = await sql.query(`SELECT data, deleted_at FROM entities WHERE id = $1`, [entity.id])
  const now = new Date().toISOString()
  const prev = existing[0] as { data: Entity; deleted_at: string | null } | undefined

  if (prev && !prev.deleted_at && opts.baseUpdatedAt && prev.data.updatedAt !== opts.baseUpdatedAt) {
    throw new HttpError(409, 'This item was changed somewhere else since you opened it. Reload to see the latest version.')
  }
  if (prev && prev.data.type !== entity.type) throw new HttpError(400, 'Entity type cannot change')

  const next: Entity = {
    ...entity,
    createdAt: prev?.data.createdAt ?? entity.createdAt ?? now,
    updatedAt: now,
    // Revision number shown in the document-control block (seed content is rev 1).
    rev: prev ? (prev.data.rev ?? 1) + 1 : 1,
  }
  // Verification can only be set deliberately; stamp the date when it is.
  if (next.status === 'verified' && (!prev || prev.data.status !== 'verified')) next.lastVerifiedAt = now

  const action = opts.action ?? (prev && !prev.deleted_at ? 'update' : 'create')
  await sql.transaction([
    sql.query(
      `INSERT INTO entities (id, type, data, created_at, updated_at, deleted_at) VALUES ($1, $2, $3, $4, $5, NULL)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at, deleted_at = NULL`,
      [next.id, next.type, JSON.stringify(next), next.createdAt, now],
    ),
    sql.query(`INSERT INTO entity_versions (entity_id, action, note, data) VALUES ($1, $2, $3, $4)`, [
      next.id,
      action,
      opts.note?.slice(0, 500) ?? null,
      JSON.stringify(next),
    ]),
  ])
  return next
}

export async function deleteEntity(id: string): Promise<void> {
  await ensureReady()
  if (!ID_RE.test(id)) throw new HttpError(400, 'Invalid id')
  const sql = db()
  const rows = await sql.query(`SELECT data FROM entities WHERE id = $1 AND deleted_at IS NULL`, [id])
  if (!rows.length) throw new HttpError(404, 'Not found')
  await sql.transaction([
    sql.query(`UPDATE entities SET deleted_at = now() WHERE id = $1`, [id]),
    sql.query(`INSERT INTO entity_versions (entity_id, action, data) VALUES ($1, 'delete', $2)`, [id, JSON.stringify((rows[0] as any).data)]),
  ])
}

/** Soft-deleted items, newest first — so deletes can be undone from the Review screen. */
export async function listDeleted(): Promise<(Entity & { deletedAt: string })[]> {
  await ensureReady()
  const rows = await db().query(`SELECT data, deleted_at FROM entities WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 200`)
  return rows.map((r: any) => ({ ...(r.data as Entity), deletedAt: new Date(r.deleted_at).toISOString() }))
}

export async function listVersions(id: string): Promise<VersionRecord[]> {
  await ensureReady()
  const rows = await db().query(
    `SELECT id, entity_id, action, note, data, created_at FROM entity_versions WHERE entity_id = $1 ORDER BY id DESC LIMIT 100`,
    [id],
  )
  return rows.map((r: any) => ({
    id: Number(r.id),
    entityId: r.entity_id,
    action: r.action,
    note: r.note ?? undefined,
    data: r.data,
    createdAt: new Date(r.created_at).toISOString(),
  }))
}

/* ------------------------------------------------------------------ */
/* Images (stored in Postgres; small personal-scale library)          */
/* ------------------------------------------------------------------ */
const MIME_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function saveImage(input: { dataUrl?: string; width?: number; height?: number; caption?: string }): Promise<ImageMeta> {
  await ensureReady()
  const m = /^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(input.dataUrl || '')
  if (!m) throw new HttpError(400, 'Expected a base64 image data URL')
  const mime = m[1]
  if (!MIME_OK.includes(mime)) throw new HttpError(415, 'Unsupported image type')
  const bytes = Math.floor((m[2].length * 3) / 4)
  if (bytes > 3_000_000) throw new HttpError(413, 'Image is too large after compression')
  const id = 'img-' + createHash('sha256').update(m[2]).digest('hex').slice(0, 20)
  const caption = typeof input.caption === 'string' ? input.caption.slice(0, 500) : null
  const width = Number.isFinite(input.width) ? Math.round(input.width!) : null
  const height = Number.isFinite(input.height) ? Math.round(input.height!) : null
  const rows = await db().query(
    `INSERT INTO images (id, mime, data, width, height, bytes, caption) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET caption = COALESCE(EXCLUDED.caption, images.caption)
     RETURNING created_at, caption`,
    [id, mime, m[2], width, height, bytes, caption],
  )
  return {
    id,
    mime,
    width: width ?? undefined,
    height: height ?? undefined,
    bytes,
    caption: (rows[0] as any).caption ?? undefined,
    createdAt: new Date((rows[0] as any).created_at).toISOString(),
  }
}

export async function updateImageCaption(id: string, caption: string): Promise<void> {
  await ensureReady()
  await db().query(`UPDATE images SET caption = $2 WHERE id = $1`, [id, caption.slice(0, 500)])
}

export async function readImage(id: string): Promise<{ mime: string; data: Buffer } | null> {
  await ensureReady()
  if (!/^img-[a-f0-9]{20}$/.test(id)) return null
  const rows = await db().query(`SELECT mime, data FROM images WHERE id = $1`, [id])
  if (!rows.length) return null
  return { mime: (rows[0] as any).mime, data: Buffer.from((rows[0] as any).data, 'base64') }
}
