/**
 * Content integrity rules shared by the API (authoritative) and the client
 * (early feedback). Pure functions — unit tested in tests/unit.
 */
import type { Entity, EntityType, FlowEdge, FlowNode, NodeKind, Source, Status, Workflow } from './types'

export const ENTITY_TYPES: EntityType[] = ['department', 'workflow', 'system', 'equipment', 'glossary', 'note', 'source']
export const STATUS_VALUES: Status[] = ['verified', 'observed', 'unverified', 'outdated']
export const NODE_KINDS: NodeKind[] = ['start', 'step', 'decision', 'warning', 'parallel', 'link', 'unknown', 'end']
export const ID_RE = /^[a-z0-9][a-z0-9_-]{0,79}$/i
export const MAX_NODES = 400

export class ValidationError extends Error {}

const isStr = (v: unknown): v is string => typeof v === 'string'

/** Verified must always be traceable to a source; nothing is promoted implicitly. */
export function hasSource(e: Pick<Entity, 'source' | 'sourceIds'>) {
  return Boolean((e.source && e.source.trim()) || (e.sourceIds && e.sourceIds.length))
}

/**
 * Verified means "confirmed against an authorized source". A written reference
 * counts (e.g. "Rental training manual, p.12"); a linked Source only counts when
 * it is marked authorized — so placeholder sources can never verify content.
 */
export function verificationProblem(
  e: Pick<Entity, 'type' | 'status' | 'source' | 'sourceIds'>,
  lookupSource: (id: string) => Pick<Source, 'authorized'> | undefined,
): string | null {
  if (e.status !== 'verified' || e.type === 'source') return null
  if (e.source && e.source.trim()) return null
  const linked = (e.sourceIds || []).map(lookupSource).filter(Boolean) as Pick<Source, 'authorized'>[]
  if (linked.some((s) => s.authorized)) return null
  return linked.length
    ? 'Verified needs an authorized source — the linked source isn’t marked as authorized. Describe the authorized source you confirmed it against.'
    : 'Verified items need a source or reference.'
}

export function validateWorkflowGraph(nodes: FlowNode[], edges: FlowEdge[]): string | null {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return 'Workflow steps are malformed.'
  if (nodes.length > MAX_NODES) return `A workflow can hold at most ${MAX_NODES} steps.`
  const ids = new Set<string>()
  for (const n of nodes) {
    if (!n || !isStr(n.id) || !n.id) return 'Every step needs an id.'
    if (ids.has(n.id)) return `Two steps share the id “${n.id}”.`
    ids.add(n.id)
    if (!NODE_KINDS.includes(n.kind)) return `Step “${n.label}” has an unknown shape.`
    if (!isStr(n.label) || !n.label.trim()) return 'Every step needs a name.'
    if (n.label.length > 300) return 'A step name is too long.'
    if (n.status !== undefined && !STATUS_VALUES.includes(n.status)) return `Step “${n.label}” has an invalid status.`
  }
  const edgeIds = new Set<string>()
  for (const e of edges) {
    if (!e || !isStr(e.id) || !e.id) return 'Every connection needs an id.'
    if (edgeIds.has(e.id)) return 'Two connections share the same id.'
    edgeIds.add(e.id)
    if (!ids.has(e.source) || !ids.has(e.target)) return 'A connection points to a step that no longer exists.'
    if (e.source === e.target) return 'A step cannot connect to itself.'
  }
  return null
}

/** Throws ValidationError with a user-readable message. */
export function validateEntityShape(input: unknown): Entity {
  const e = input as Record<string, any>
  if (!e || typeof e !== 'object' || Array.isArray(e)) throw new ValidationError('Missing entity.')
  if (!ENTITY_TYPES.includes(e.type)) throw new ValidationError('Unknown entity type.')
  if (!isStr(e.id) || !ID_RE.test(e.id)) throw new ValidationError('Invalid id.')
  if (!isStr(e.title) || !e.title.trim()) throw new ValidationError('A title is required.')
  if (e.title.length > 300) throw new ValidationError('Title is too long.')
  if (!STATUS_VALUES.includes(e.status)) throw new ValidationError('Invalid status.')
  if (e.status === 'verified' && e.type !== 'source' && !hasSource(e as Entity))
    throw new ValidationError('Verified items need a source or reference.')
  if (e.type === 'workflow') {
    const problem = validateWorkflowGraph((e as Workflow).nodes, (e as Workflow).edges)
    if (problem) throw new ValidationError(problem)
  }
  if (JSON.stringify(e).length > 1_000_000) throw new ValidationError('Entity is too large.')
  return e as Entity
}

/* ------------------------------------------------------------------ */
/* Cross-reference integrity (used by the Review → Integrity report)   */
/* ------------------------------------------------------------------ */
export interface IntegrityIssue {
  entityId: string
  nodeId?: string
  kind: 'missing-ref' | 'missing-link' | 'missing-image' | 'orphan-step'
  detail: string
}

const REF_FIELDS = ['departmentIds', 'systemIds', 'equipmentIds', 'workflowIds', 'sourceIds'] as const

export function integrityReport(entities: Entity[], imageIds: Set<string>): IntegrityIssue[] {
  const byId = new Map(entities.map((e) => [e.id, e]))
  const out: IntegrityIssue[] = []
  const checkRefs = (owner: Entity, obj: Record<string, any>, nodeId?: string) => {
    for (const f of [...REF_FIELDS, 'relatedWorkflowIds'] as const) {
      for (const id of (obj[f] as string[] | undefined) || [])
        if (!byId.has(id)) out.push({ entityId: owner.id, nodeId, kind: 'missing-ref', detail: `${f} → ${id}` })
    }
    for (const img of (obj.imageIds as string[] | undefined) || [])
      if (!imageIds.has(img)) out.push({ entityId: owner.id, nodeId, kind: 'missing-image', detail: img })
  }
  for (const e of entities) {
    checkRefs(e, e as any)
    if (e.type === 'department')
      for (const s of e.sections)
        for (const w of s.workflowIds) if (!byId.has(w)) out.push({ entityId: e.id, kind: 'missing-ref', detail: `section “${s.title}” → ${w}` })
    if (e.type === 'note') for (const l of e.links) if (!byId.has(l.id)) out.push({ entityId: e.id, kind: 'missing-ref', detail: `about → ${l.id}` })
    if (e.type === 'workflow') {
      const connected = new Set<string>()
      for (const ed of e.edges) {
        connected.add(ed.source)
        connected.add(ed.target)
      }
      for (const n of e.nodes) {
        checkRefs(e, n as any, n.id)
        if (n.kind === 'link' && (!n.linkWorkflowId || !byId.has(n.linkWorkflowId)))
          out.push({ entityId: e.id, nodeId: n.id, kind: 'missing-link', detail: n.linkWorkflowId || 'no destination chosen' })
        if (e.nodes.length > 1 && !connected.has(n.id)) out.push({ entityId: e.id, nodeId: n.id, kind: 'orphan-step', detail: n.label })
      }
    }
  }
  return out
}
