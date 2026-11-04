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

/** Positions every node with a layered (Sugiyama) layout. Returns new nodes. */
export function autoLayout(nodes: FlowNode[], edges: FlowEdge[], direction: 'TB' | 'LR' = 'TB'): FlowNode[] {
  const g = new dagre.graphlib.Graph({ multigraph: true })
  g.setGraph({ rankdir: direction, nodesep: direction === 'TB' ? 36 : 40, ranksep: direction === 'TB' ? 64 : 90, marginx: 20, marginy: 20 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of nodes) {
    const s = NODE_SIZE[n.kind]
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
    const s = NODE_SIZE[n.kind]
    return { ...n, x: Math.round(p.x - s.w / 2), y: Math.round(p.y - s.h / 2) }
  })
}

export function needsLayout(nodes: FlowNode[]) {
  return nodes.some((n) => typeof n.x !== 'number' || typeof n.y !== 'number')
}

/** Order nodes by walking the flow from its start(s) — used for the Steps list and prev/next. */
export function flowOrder(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const incoming = new Map<string, number>()
  for (const e of edges) if (e.kind !== 'loop') incoming.set(e.target, (incoming.get(e.target) || 0) + 1)
  const starts = nodes.filter((n) => n.kind === 'start' || !incoming.get(n.id))
  const seen = new Set<string>()
  const out: FlowNode[] = []
  const queue = [...starts]
  while (queue.length) {
    const n = queue.shift()!
    if (seen.has(n.id)) continue
    seen.add(n.id)
    out.push(n)
    for (const e of edges) if (e.source === n.id && e.kind !== 'loop' && byId.has(e.target)) queue.push(byId.get(e.target)!)
  }
  for (const n of nodes) if (!seen.has(n.id)) out.push(n)
  return out
}
