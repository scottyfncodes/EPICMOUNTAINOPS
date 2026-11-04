import { describe, expect, it } from 'vitest'
import { seedEntities } from '../../shared/seed'
import type { Workflow } from '../../shared/types'
import { integrityReport, validateEntityShape, validateWorkflowGraph, ValidationError } from '../../shared/validate'

const wf = () => structuredClone(seedEntities.find((e) => e.id === 'wf-ski-intake')) as Workflow

describe('entity validation', () => {
  it('accepts every seeded entity (production content stays valid)', () => {
    for (const e of seedEntities) expect(() => validateEntityShape(e), e.id).not.toThrow()
  })

  it('refuses Verified without a source — nothing is promoted silently', () => {
    const e = { ...wf(), status: 'verified', source: '', sourceIds: [] }
    expect(() => validateEntityShape(e)).toThrow(ValidationError)
    expect(() => validateEntityShape({ ...e, source: 'Shop lead demo, Nov 4' })).not.toThrow()
    expect(() => validateEntityShape({ ...e, sourceIds: ['src-starter'] })).not.toThrow()
  })

  it('allows a Source itself to be verified without a source', () => {
    const src = seedEntities.find((e) => e.type === 'source')!
    expect(() => validateEntityShape({ ...src, status: 'verified', sourceIds: [] })).not.toThrow()
  })

  it('rejects bad ids, types and statuses', () => {
    expect(() => validateEntityShape({ ...wf(), id: '../etc' })).toThrow()
    expect(() => validateEntityShape({ ...wf(), type: 'user' })).toThrow()
    expect(() => validateEntityShape({ ...wf(), status: 'confirmed' })).toThrow()
    expect(() => validateEntityShape({ ...wf(), title: '   ' })).toThrow()
  })
})

describe('workflow graph integrity', () => {
  it('detects duplicate step ids', () => {
    const w = wf()
    w.nodes.push({ ...w.nodes[0] })
    expect(validateWorkflowGraph(w.nodes, w.edges)).toMatch(/share the id/)
  })
  it('detects connections to missing steps', () => {
    const w = wf()
    w.edges.push({ id: 'x', source: 'start', target: 'ghost' })
    expect(validateWorkflowGraph(w.nodes, w.edges)).toMatch(/no longer exists/)
  })
  it('detects self-loops and nameless steps', () => {
    const w = wf()
    expect(validateWorkflowGraph(w.nodes, [...w.edges, { id: 'y', source: 'info', target: 'info' }])).toMatch(/itself/)
    expect(validateWorkflowGraph([...w.nodes, { id: 'z', kind: 'step', label: '' }], w.edges)).toMatch(/name/)
  })
})

describe('integrity report', () => {
  it('finds no broken references in the seed', () => {
    expect(integrityReport(seedEntities, new Set())).toEqual([])
  })
  it('reports references to deleted items and dangling hand-offs', () => {
    const without = seedEntities.filter((e) => e.id !== 'wf-jrt-repair' && e.id !== 'sys-repair-tag')
    const issues = integrityReport(without, new Set())
    expect(issues.some((i) => i.kind === 'missing-link' && i.entityId === 'wf-ski-return')).toBe(true)
    expect(issues.some((i) => i.kind === 'missing-ref' && i.detail.includes('sys-repair-tag'))).toBe(true)
  })
})

import { verificationProblem } from '../../shared/validate'

describe('verification requires an authorized source', () => {
  const starter = { authorized: false }
  const manual = { authorized: true }
  const look = (id: string) => (id === 'src-starter' ? starter : id === 'src-manual' ? manual : undefined)
  const base = { type: 'glossary' as const, status: 'verified' as const }
  it('rejects verifying with only the placeholder starter source', () => {
    expect(verificationProblem({ ...base, sourceIds: ['src-starter'] }, look)).toMatch(/authorized/)
  })
  it('accepts an authorized linked source or a written reference', () => {
    expect(verificationProblem({ ...base, sourceIds: ['src-starter', 'src-manual'] }, look)).toBeNull()
    expect(verificationProblem({ ...base, source: 'Rental training manual, p.12' }, look)).toBeNull()
  })
  it('ignores non-verified statuses', () => {
    expect(verificationProblem({ ...base, status: 'observed', sourceIds: [] }, look)).toBeNull()
  })
})
