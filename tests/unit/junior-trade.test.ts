import { describe, expect, it } from 'vitest'
import { SEED_UPDATES, seedEntities } from '../../shared/seed'
import type { Entity, Workflow } from '../../shared/types'
import { validateEntityShape, ValidationError } from '../../shared/validate'
import { flowOrder } from '../../src/lib/layout'
import { buildIndex, runSearch } from '../../src/lib/search'
import { buildAtlas } from '../../src/lib/store'

const byId = new Map(seedEntities.map((e) => [e.id, e]))
const fitting = byId.get('wf-jrt-fitting') as Workflow
const atlas = buildAtlas(seedEntities, [])

describe('Junior Trade workflow content', () => {
  it('walks the eight field-note stages in order, each stage contiguous', () => {
    const phases = flowOrder(fitting.nodes, fitting.edges).map((n) => n.phase)
    const runs = phases.filter((p, i) => p !== phases[i - 1])
    expect(runs).toEqual([
      'Guest arrival',
      'Prepare for fitting',
      'Boot fitting',
      'Ski sizing',
      'Trade-in value',
      'Equipment entry & ASTM authorization',
      'ASTM procedure',
      'Final signature & release',
    ])
  })

  it('lists the paperwork/fitting join only after both branches', () => {
    const ids = flowOrder(fitting.nodes, fitting.edges).map((n) => n.id)
    expect(ids.indexOf('join')).toBeGreaterThan(ids.indexOf('form'))
    expect(ids.indexOf('join')).toBeGreaterThan(ids.indexOf('tradein'))
    expect(ids.indexOf('goldilocks')).toBeGreaterThan(ids.indexOf('boot-out'))
  })

  it('shares one out-of-stock playbook between boots and skis', () => {
    const links = fitting.nodes.filter((n) => n.kind === 'link')
    expect(links.map((n) => n.linkWorkflowId)).toEqual(['wf-jrt-out-of-stock', 'wf-jrt-out-of-stock'])
    expect(atlas.inboundLinks('wf-jrt-out-of-stock')).toHaveLength(2)
  })

  it('marks every ASTM step safety-critical and asserts no procedure details', () => {
    const critical = fitting.nodes.filter((n) => n.critical).map((n) => n.id)
    expect(critical).toEqual(['authorize', 'astm-warn', 'astm', 'signature', 'complete'])
    expect(fitting.nodes.find((n) => n.id === 'astm')!.kind).toBe('unknown')
    const text = JSON.stringify(fitting)
    expect(text).not.toMatch(/\b(DIN|torque)\s*(value|setting)?\s*[:=]?\s*\d/i)
  })

  it('labels prices as employee-reported estimates and the trade-in figure as published', () => {
    const callouts = fitting.nodes.flatMap((n) => n.callouts || [])
    for (const c of callouts.filter((c) => /\$\d/.test(c.text))) expect(c.kind).toBe('estimate')
    const pub = callouts.find((c) => c.kind === 'published')!
    expect(pub.text).toMatch(/50%/)
    expect(pub.url).toBe('https://www.epicmountaingear.com/pages/junior-trade')
  })

  it('never claims Verified: field notes are Observed, unknown systems are pending identification', () => {
    for (const id of SEED_UPDATES[2].ids) expect((byId.get(id) as Entity).status, id).not.toBe('verified')
    for (const id of ['sys-jrt-checkin', 'sys-jrt-parent-form', 'sys-jrt-astm-record']) expect(byId.get(id)!.title).toMatch(/pending identification/)
    expect(fitting.status).toBe('observed')
  })

  it('lists every update id in the seed', () => {
    for (const ids of Object.values(SEED_UPDATES)) for (const id of ids.ids) expect(byId.has(id), id).toBe(true)
  })

  it('is findable by glossary terms and callout text', () => {
    const ms = buildIndex(atlas)
    expect(runSearch(ms, 'Goldilocks').some((h) => h.kind === 'glossary')).toBe(true)
    expect(runSearch(ms, 'height and weight').some((h) => h.href === '/workflows/wf-jrt-fitting?node=checkin-appt')).toBe(true)
  })
})

describe('callout and sizing validation', () => {
  const clone = () => structuredClone(fitting)
  it('accepts the seeded workflow', () => expect(() => validateEntityShape(clone())).not.toThrow())
  it('rejects non-https links', () => {
    const w = clone()
    w.nodes.find((n) => n.id === 'tradein')!.callouts![0].url = 'javascript:alert(1)'
    expect(() => validateEntityShape(w)).toThrow(ValidationError)
  })
  it('rejects unknown callout kinds and inverted sizing bands', () => {
    const a = clone()
    ;(a.nodes.find((n) => n.id === 'tradein')!.callouts![0] as any).kind = 'rumour'
    expect(() => validateEntityShape(a)).toThrow(ValidationError)
    const b = clone()
    b.nodes.find((n) => n.id === 'ski-size')!.sizing![0] = { label: 'Bad', from: 'nose', to: 'chin' }
    expect(() => validateEntityShape(b)).toThrow(/lower to a higher/)
  })
  it('rejects a source link that is not https', () => {
    const s = structuredClone(byId.get('src-jrt-website')) as any
    s.url = 'http://example.com'
    expect(() => validateEntityShape(s)).toThrow(ValidationError)
  })
})
