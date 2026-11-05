import type { Department, Workflow } from '../../shared/types'

/**
 * The "operation route map": how workflows chain together through hand-off
 * (link) steps. Derived purely from existing hand-offs — nothing is inferred.
 *
 * Each department is a line. Its workflows are stations, ordered by following
 * hand-offs within the line. Where no hand-off links two consecutive stations
 * the line is broken (a new segment), which makes missing links visible.
 */
export interface Station {
  workflow: Workflow
  /** Hand-offs to workflows on other lines (interchanges). */
  out: Workflow[]
  /** Hand-offs arriving from workflows on other lines. */
  in: Workflow[]
}

export interface RouteLine {
  department: Department
  /** Each segment is a run of stations connected by hand-offs. */
  segments: Station[][]
}

const codeOf = (w: Workflow) => w.code || w.title

export function buildRoutes(departments: Department[], workflows: Workflow[]): RouteLine[] {
  const byId = new Map(workflows.map((w) => [w.id, w]))
  const primary = (w: Workflow) => w.departmentIds[0]
  const handoffs = new Map<string, string[]>() // wf id -> target wf ids (in step order)
  const inbound = new Map<string, string[]>()
  for (const w of workflows) {
    for (const n of w.nodes) {
      if (n.kind !== 'link' || !n.linkWorkflowId || !byId.has(n.linkWorkflowId) || n.linkWorkflowId === w.id) continue
      const list = handoffs.get(w.id) || []
      if (!list.includes(n.linkWorkflowId)) list.push(n.linkWorkflowId)
      handoffs.set(w.id, list)
      const inList = inbound.get(n.linkWorkflowId) || []
      if (!inList.includes(w.id)) inList.push(w.id)
      inbound.set(n.linkWorkflowId, inList)
    }
  }

  return departments.map((d) => {
    const mine = workflows.filter((w) => primary(w) === d.id).sort((a, b) => codeOf(a).localeCompare(codeOf(b)))
    const onLine = new Set(mine.map((w) => w.id))
    const nextOnLine = (id: string) => (handoffs.get(id) || []).filter((t) => onLine.has(t))
    const hasInboundOnLine = (id: string) => (inbound.get(id) || []).some((s) => onLine.has(s))
    const seen = new Set<string>()
    const segments: Station[][] = []
    const station = (w: Workflow): Station => ({
      workflow: w,
      out: (handoffs.get(w.id) || []).filter((t) => !onLine.has(t)).map((t) => byId.get(t)!),
      in: (inbound.get(w.id) || []).filter((s) => !onLine.has(s)).map((s) => byId.get(s)!),
    })
    // Heads first (nothing on this line hands off to them), then anything left (cycles).
    const heads = [...mine.filter((w) => !hasInboundOnLine(w.id)), ...mine]
    for (const head of heads) {
      if (seen.has(head.id)) continue
      const seg: Station[] = []
      let cur: Workflow | undefined = head
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id)
        seg.push(station(cur))
        const nxt: string | undefined = nextOnLine(cur.id).find((t) => !seen.has(t))
        cur = nxt ? byId.get(nxt) : undefined
      }
      segments.push(seg)
    }
    return { department: d, segments }
  })
}

/** Count of hand-offs that cross between departments — the "interchanges". */
export function interchangeCount(lines: RouteLine[]) {
  return lines.reduce((n, l) => n + l.segments.flat().reduce((m, s) => m + s.out.length, 0), 0)
}
