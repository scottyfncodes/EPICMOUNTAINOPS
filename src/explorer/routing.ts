import type { FlowEdge, FlowNode, Status, Workflow } from '../../shared/types'
import { NODE_SIZE } from '../lib/layout'

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
