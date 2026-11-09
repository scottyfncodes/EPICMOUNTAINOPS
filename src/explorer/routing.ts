import type { FlowEdge, FlowNode, Status, Workflow } from '../../shared/types'
import { NODE_SIZE, nodeSize } from '../lib/layout'

export type Side = 'top' | 'right' | 'bottom' | 'left'

/**
 * Choose which side each connection leaves and enters, so branches fan out
 * sideways instead of stacking on one handle, and loop-backs travel around
 * the outside of the flow instead of cutting through it.
 */
export function routeEdge(src: FlowNode, tgt: FlowNode, direction: 'TB' | 'LR' = 'TB'): { from: Side; to: Side } {
  const ss = NODE_SIZE[src.kind]
  const ts = NODE_SIZE[tgt.kind]
  const sx = (src.x ?? 0) + ss.w / 2
  const sy = (src.y ?? 0) + ss.h / 2
  const tx = (tgt.x ?? 0) + ts.w / 2
  const ty = (tgt.y ?? 0) + ts.h / 2
  const dx = tx - sx
  const dy = ty - sy
  const fans = src.kind === 'decision' || src.kind === 'parallel'

  if (direction === 'TB') {
    if (dy < -10) return { from: 'right', to: 'right' } // loop back up, around the right side
    if (fans && Math.abs(dx) > ss.w / 2) return { from: dx < 0 ? 'left' : 'right', to: 'top' }
    return { from: 'bottom', to: 'top' }
  }
  if (dx < -10) return { from: 'bottom', to: 'bottom' }
  if (fans && Math.abs(dy) > ss.h / 2) return { from: dy < 0 ? 'top' : 'bottom', to: 'left' }
  return { from: 'right', to: 'left' }
}

/**
 * Route every connection, then make sure branches leaving the same decision or
 * split never share a side: when several would leave from the bottom (their
 * targets are stacked in one column), the nearest keeps the bottom and the
 * others go round the side and enter their target from that side — so labels
 * don't collide and lines don't run behind the step in between.
 */
export type Route = { from: Side; to: Side; /** How far a side route travels out, to clear steps in between. */ offset?: number }

export function routeAll(nodes: FlowNode[], edges: FlowEdge[], direction: 'TB' | 'LR' = 'TB'): Map<string, Route> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out = new Map<string, Route>()
  for (const e of edges) {
    const s = byId.get(e.source)
    const t = byId.get(e.target)
    if (s && t) out.set(e.id, routeEdge(s, t, direction))
  }
  const main: Side = direction === 'TB' ? 'bottom' : 'right'
  const sides: Side[] = direction === 'TB' ? ['right', 'left'] : ['bottom', 'top']
  const axis = (n: FlowNode) => (direction === 'TB' ? (n.y ?? 0) : (n.x ?? 0))
  for (const src of nodes) {
    if (src.kind !== 'decision' && src.kind !== 'parallel') continue
    const mine = edges.filter((e) => e.source === src.id && e.kind !== 'loop' && out.get(e.id))
    const stacked = mine.filter((e) => out.get(e.id)!.from === main).sort((a, b) => axis(byId.get(a.target)!) - axis(byId.get(b.target)!))
    if (stacked.length < 2) continue
    const free = sides.filter((side) => !mine.some((e) => out.get(e.id)!.from === side))
    stacked.slice(1).forEach((e, i) => {
      const side = free[i]
      if (side) out.set(e.id, { from: side, to: side, offset: clearance(src, byId.get(e.target)!, side, nodes, direction) })
    })
  }
  return out
}

/** Offset that takes a side route past every step lying between its two ends. */
function clearance(src: FlowNode, tgt: FlowNode, side: Side, nodes: FlowNode[], direction: 'TB' | 'LR'): number {
  const lo = (n: FlowNode) => (direction === 'TB' ? (n.y ?? 0) : (n.x ?? 0))
  const len = (n: FlowNode) => (direction === 'TB' ? nodeSize(n).h : nodeSize(n).w)
  const across = (n: FlowNode, far: boolean) => {
    const start = direction === 'TB' ? (n.x ?? 0) : (n.y ?? 0)
    return far ? start + (direction === 'TB' ? nodeSize(n).w : nodeSize(n).h) : start
  }
  const far = side === 'right' || side === 'bottom'
  const a = lo(src) + len(src)
  const b = lo(tgt)
  const between = nodes.filter((n) => n !== src && n !== tgt && lo(n) < b && lo(n) + len(n) > a)
  const edgeOf = (n: FlowNode) => across(n, far)
  const base = far ? Math.max(edgeOf(src), edgeOf(tgt)) : Math.min(edgeOf(src), edgeOf(tgt))
  const reach = between.reduce((m, n) => (far ? Math.max(m, edgeOf(n)) : Math.min(m, edgeOf(n))), base)
  return Math.max(20, Math.abs(reach - base) + 22)
}

/* ------------------------------------------------------------------ */
/* Lenses — ways of reading a map at a glance                          */
/* ------------------------------------------------------------------ */
export type Lens = 'flow' | 'status' | 'gaps' | 'systems'

export const LENSES: { id: Lens; label: string; help: string }[] = [
  { id: 'flow', label: 'Flow', help: 'The process as drawn' },
  { id: 'status', label: 'Status', help: 'Colour every step by how trustworthy it is' },
  { id: 'gaps', label: 'Gaps', help: 'Unknown steps and missing details' },
  { id: 'systems', label: 'Systems', help: 'Where each system is used' },
]

/** Details we expect a normal step to explain; missing ones count as gaps. */
export const GAP_FIELDS = ['what', 'why', 'who'] as const

export function stepGaps(n: FlowNode): string[] {
  if (n.kind === 'start' || n.kind === 'end' || n.kind === 'parallel' || n.kind === 'link') return []
  const missing: string[] = GAP_FIELDS.filter((f) => !n[f]?.trim())
  return missing
}

/** Effective status of a step: its own, else inherited from the workflow. */
export function effectiveStatus(n: FlowNode, wf: Pick<Workflow, 'status'>): { status: Status; inherited: boolean } {
  return n.status ? { status: n.status, inherited: false } : { status: wf.status, inherited: true }
}

export interface LensMark {
  /** Visually de-emphasise this step under the current lens. */
  dim: boolean
  /** Short badge text (e.g. "3 gaps"). */
  badge?: string
  tone?: Status | 'gap' | 'hit'
}

export function lensMark(lens: Lens, n: FlowNode, wf: Workflow, systemId?: string): LensMark {
  switch (lens) {
    case 'flow':
      return { dim: false }
    case 'status': {
      if (n.kind === 'start' || n.kind === 'end' || n.kind === 'parallel') return { dim: true }
      const { status } = effectiveStatus(n, wf)
      return { dim: false, tone: status }
    }
    case 'gaps': {
      if (n.kind === 'unknown') return { dim: false, tone: 'gap', badge: 'Unknown' }
      const g = stepGaps(n)
      return g.length ? { dim: false, tone: 'gap', badge: `${g.length} missing` } : { dim: true }
    }
    case 'systems': {
      if (!systemId) return { dim: false }
      const hit = n.systemIds?.includes(systemId) || n.equipmentIds?.includes(systemId)
      return hit ? { dim: false, tone: 'hit' } : { dim: true }
    }
  }
}

/** Systems/equipment used anywhere in a workflow, most-used first. */
export function systemsInWorkflow(wf: Workflow): { id: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const id of [...wf.systemIds, ...wf.equipmentIds]) counts.set(id, counts.get(id) || 0)
  for (const n of wf.nodes) for (const id of [...(n.systemIds || []), ...(n.equipmentIds || [])]) counts.set(id, (counts.get(id) || 0) + 1)
  return [...counts.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count)
}

export function edgeKey(e: FlowEdge) {
  return e.id
}
