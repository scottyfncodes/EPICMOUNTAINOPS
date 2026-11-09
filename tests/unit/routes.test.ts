import { describe, expect, it } from 'vitest'
import { seedEntities } from '../../shared/seed'
import type { Department, Workflow } from '../../shared/types'
import { buildRoutes, interchangeCount } from '../../src/lib/routes'

const depts = seedEntities.filter((e) => e.type === 'department') as Department[]
const wfs = seedEntities.filter((e) => e.type === 'workflow') as Workflow[]
const lines = buildRoutes(depts, wfs)
const codes = (id: string) => lines.find((l) => l.department.id === id)!.segments.map((s) => s.map((st) => st.workflow.code))

describe('operation route map', () => {
  it('follows hand-offs within a line, in order', () => {
    expect(codes('dept-ski')).toEqual([['SKI-01', 'SKI-02', 'SKI-03', 'SKI-04'], ['SKI-05']])
    expect(codes('dept-snowboard')).toEqual([['SNB-01', 'SNB-02', 'SNB-03']])
    expect(codes('dept-jr-trades')).toEqual([['JRT-02', 'JRT-03', 'JRT-01'], ['JRT-04', 'JRT-05']])
  })
  it('breaks the line where no hand-off exists (never invents a link)', () => {
    // Issuance (SKI-04) has no hand-off to Return (SKI-05) in the data.
    expect(codes('dept-ski')).toHaveLength(2)
  })
  it('records cross-department interchanges both ways', () => {
    const ski = lines.find((l) => l.department.id === 'dept-ski')!.segments.flat()
    expect(ski.find((s) => s.workflow.code === 'SKI-05')!.out.map((w) => w.code)).toEqual(['JRT-01'])
    const repair = lines.find((l) => l.department.id === 'dept-jr-trades')!.segments.flat().find((s) => s.workflow.code === 'JRT-01')!
    expect(repair.in.map((w) => w.code).sort()).toEqual(['SKI-05', 'SNB-03'])
    expect(interchangeCount(lines)).toBe(2)
  })
  it('places every workflow exactly once', () => {
    const all = lines.flatMap((l) => l.segments.flat().map((s) => s.workflow.id))
    expect(new Set(all).size).toBe(all.length)
    expect(all.length).toBe(wfs.length)
  })
})
