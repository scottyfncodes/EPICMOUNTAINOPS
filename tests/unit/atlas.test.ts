import { describe, expect, it } from 'vitest'
import { seedEntities } from '../../shared/seed'
import type { Workflow } from '../../shared/types'
import { autoLayout, flowOrder, needsLayout } from '../../src/lib/layout'
import { buildIndex, runSearch } from '../../src/lib/search'
import { buildAtlas } from '../../src/lib/store'

const atlas = buildAtlas(seedEntities, [])

describe('relationships', () => {
  it('finds every workflow (and step) that uses a system', () => {
    const refs = atlas.workflowsForSystem('sys-rental-record')
    expect(refs.map((r) => r.workflow.id)).toContain('wf-ski-intake')
    expect(refs.find((r) => r.workflow.id === 'wf-ski-intake')!.nodes.map((n) => n.id)).toContain('walkin')
  })
  it('maps hand-offs between departments', () => {
    const conns = atlas.departmentConnections('dept-ski')
    expect(conns.some((c) => c.direction === 'out' && c.department.id === 'dept-jr-trades')).toBe(true)
    expect(atlas.inboundLinks('wf-jrt-repair').length).toBeGreaterThanOrEqual(2)
  })
  it('attaches notes to specific steps', () => {
    expect(atlas.notesFor('workflow', 'wf-ski-intake', 'agreement').map((n) => n.id)).toContain('q-agreement')
  })
})

describe('search', () => {
  const ms = buildIndex(atlas)
  it('matches acronyms exactly and partial words', () => {
    expect(runSearch(ms, 'BSL')[0].title).toBe('BSL')
    expect(runSearch(ms, 'walk').some((h) => h.kind === 'step' && h.title.includes('walk-in'))).toBe(true)
  })
  it('deep-links step results to their node', () => {
    const hit = runSearch(ms, 'boot sole length').find((h) => h.kind === 'step')!
    expect(hit.href).toBe('/workflows/wf-ski-boot-fit?node=bsl')
  })
})

describe('layout', () => {
  const w = seedEntities.find((e) => e.id === 'wf-jrt-repair') as Workflow
  it('positions every node and walks the flow from the start', () => {
    expect(needsLayout(w.nodes)).toBe(true)
    const laid = autoLayout(w.nodes, w.edges)
    expect(needsLayout(laid)).toBe(false)
    expect(flowOrder(laid, w.edges)[0].id).toBe('start')
  })
})
