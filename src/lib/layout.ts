import dagre from '@dagrejs/dagre'
import type { FlowEdge, FlowNode, NodeKind } from '../../shared/types'

export const NODE_SIZE: Record<NodeKind, { w: number; h: number }> = {
  start: { w: 220, h: 56 },
  end: { w: 220, h: 56 },
  step: { w: 248, h: 84 },
  decision: { w: 248, h: 96 },
  warning: { w: 248, h: 92 },
  unknown: { w: 248, h: 84 },
  link: { w: 248, h: 84 },
  parallel: { w: 300, h: 34 },
}

/**
 * Size a node will roughly render at: long names wrap, and hand-offs show the
 * destination underneath. Used for layout and routing so steps don't crowd.
 */
export function nodeSize(n: Pick<FlowNode, 'kind' | 'label'>): { w: number; h: number } {
  const s = NODE_SIZE[n.kind]
  if (n.kind === 'parallel' || n.kind === 'start' || n.kind === 'end') return s
  const lines = Math.max(1, Math.ceil((n.label?.length || 0) / 27))
  return { w: s.w, h: s.h + (lines - 1) * 20 + (n.kind === 'link' ? 40 : 0) }
}

/** Positions every node with a layered (Sugiyama) layout. Returns new nodes. */
export function autoLayout(nodes: FlowNode[], edges: FlowEdge[], direction: 'TB' | 'LR' = 'TB'): FlowNode[] {
  const g = new dagre.graphlib.Graph({ multigraph: true })
  g.setGraph({ rankdir: direction, nodesep: direction === 'TB' ? 36 : 40, ranksep: direction === 'TB' ? 64 : 90, marginx: 20, marginy: 20 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of nodes) {
    const s = nodeSize(n)
    g.setNode(n.id, { width: s.w, height: s.h })
  }
  for (const e of edges) {
    if (!g.hasNode(e.source) || !g.hasNode(e.target)) continue
    // Loop-back edges should not pull layers apart.
    g.setEdge(e.source, e.target, { weight: e.kind === 'loop' ? 0 : 1, minlen: 1 }, e.id)
  }
  dagre.layout(g)
  return nodes.map((n) => {
    const p = g.node(n.id)
    const s = nodeSize(n)
    return { ...n, x: Math.round(p.x - s.w / 2), y: Math.round(p.y - s.h / 2) }
  })
}

export function needsLayout(nodes: FlowNode[]) {
  return nodes.some((n) => typeof n.x !== 'number' || typeof n.y !== 'number')
}

/** Order nodes by walking the flow from its start(s) — used for the Steps list and prev/next. */
/**
 * Reading order for a workflow: a topological walk (loop-backs ignored), so a
 * step that several branches lead into — e.g. where parallel work comes back
 * together — is listed only after all of them, and branches stay grouped.
 * Remaining cycles are broken at the earliest-reached step; unreachable steps
 * go last.
 */
export function flowOrder(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const fwd = edges.filter((e) => e.kind !== 'loop' && byId.has(e.source) && byId.has(e.target) && e.source !== e.target)
  const waiting = new Map<string, number>()
  for (const e of fwd) waiting.set(e.target, (waiting.get(e.target) || 0) + 1)
  const out: FlowNode[] = []
  const seen = new Set<string>()
  const reached: string[] = []
  const ready = nodes.filter((n) => !waiting.get(n.id)).sort((a, b) => Number(b.kind === 'start') - Number(a.kind === 'start'))
  const emit = (n: FlowNode) => {
    seen.add(n.id)
    out.push(n)
    for (const e of fwd) {
      if (e.source !== n.id || seen.has(e.target)) continue
      const left = (waiting.get(e.target) || 0) - 1
      waiting.set(e.target, left)
      reached.push(e.target)
      if (left === 0) ready.push(byId.get(e.target)!)
    }
  }
  while (out.length < nodes.length) {
    const next = ready.shift()
    if (next) {
      if (!seen.has(next.id)) emit(next)
      continue
    }
    // Stuck on a cycle: release the earliest step we reached but haven't listed.
    const id = reached.find((r) => !seen.has(r))
    const n = id ? byId.get(id) : nodes.find((x) => !seen.has(x.id))
    if (!n) break
    emit(n)
  }
  return out
}
