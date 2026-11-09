import { beforeAll, describe, expect, it } from 'vitest'
import { applySeedUpdates, ensureReady, listEntities, saveEntity } from '../../server/core'
import { createDevSql } from '../../server/dev-sql'
import { SEED_UPDATES, SEED_VERSION, seedEntities } from '../../shared/seed'
import type { Department, Note } from '../../shared/types'

/**
 * Production was seeded at content v1 and may hold the owner's edits.
 * The v2 update must add the Junior Trade content, refresh untouched
 * starter items, and never overwrite an edit or resurrect a deletion.
 */
let sql: any

beforeAll(async () => {
  sql = await createDevSql('memory://')
  ;(globalThis as any).__opsDevSql = sql
  await ensureReady()
  // Rewind to a v1-shaped database.
  const v2 = SEED_UPDATES[2].ids
  const v2new = v2.filter((id) => !['dept-jr-trades', 'gl-jr', 'q-jr-meaning'].includes(id))
  await sql.query(`DELETE FROM entities WHERE id = ANY($1)`, [v2new])
  await sql.query(`UPDATE entities SET data = jsonb_set(data, '{tagline}', '"Servicing, repair & inspection"') WHERE id = 'dept-jr-trades'`)
  await sql.query(`UPDATE entities SET data = jsonb_set(data, '{resolved}', 'false') WHERE id = 'q-jr-meaning'`)
  await sql.query(`UPDATE app_meta SET value = '1' WHERE key = 'seed_version'`)
  // The owner edited the JR glossary entry and deleted a v2 item that existed earlier.
  await sql.query(`UPDATE entities SET data = data || '{"rev": 2, "definition": "Owner wrote this."}'::jsonb WHERE id = 'gl-jr'`)
  await sql.query(`INSERT INTO entities (id, type, data, deleted_at) SELECT id, type, data, now() FROM (SELECT 'gl-goldilocks' AS id, 'glossary' AS type, $1::jsonb AS data) x`, [
    JSON.stringify(seedEntities.find((e) => e.id === 'gl-goldilocks')),
  ])
})

describe('content migration v1 → v2', () => {
  it('adds the Junior Trade content and refreshes untouched starter items', async () => {
    await applySeedUpdates(1)
    const all = await listEntities()
    const ids = new Set(all.map((e) => e.id))
    for (const id of ['wf-jrt-fitting', 'wf-jrt-out-of-stock', 'sys-jrt-checkin', 'src-jrt-field-notes', 'q-jrt-astm']) expect(ids.has(id)).toBe(true)
    const dept = all.find((e) => e.id === 'dept-jr-trades') as Department
    expect(dept.tagline).toMatch(/Junior Trade/)
    expect(dept.sections[0].workflowIds).toContain('wf-jrt-fitting')
    expect((all.find((e) => e.id === 'q-jr-meaning') as Note).resolved).toBe(true)
    const meta = await sql.query(`SELECT value FROM app_meta WHERE key = 'seed_version'`)
    expect(Number(meta[0].value)).toBe(SEED_VERSION)
  })

  it('never overwrites an edited item or resurrects a deleted one', async () => {
    const all = await listEntities()
    expect((all.find((e) => e.id === 'gl-jr') as any).definition).toBe('Owner wrote this.')
    expect(all.some((e) => e.id === 'gl-goldilocks')).toBe(false)
  })

  it('records history for what it changed, and runs only once', async () => {
    const before = await sql.query(`SELECT count(*)::int AS n FROM entity_versions WHERE note = $1`, [SEED_UPDATES[2].note])
    expect(before[0].n).toBeGreaterThan(10)
    await applySeedUpdates(1) // a second cold start racing the first
    const after = await sql.query(`SELECT count(*)::int AS n FROM entity_versions WHERE note = $1`, [SEED_UPDATES[2].note])
    expect(after[0].n).toBe(before[0].n)
  })

  it('leaves migrated items editable through the normal save path', async () => {
    const wf = (await listEntities()).find((e) => e.id === 'wf-jrt-out-of-stock')!
    const saved = await saveEntity({ ...wf, summary: 'Edited' }, { baseUpdatedAt: wf.updatedAt })
    expect(saved.rev).toBe(2)
  })
})
