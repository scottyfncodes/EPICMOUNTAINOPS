import type { AccentKey, Entity, EntityRef, EntityType, NodeKind, Status } from '../../shared/types'

export const STATUS_META: Record<Status, { label: string; short: string; help: string }> = {
  verified: { label: 'Verified', short: 'VER', help: 'Confirmed against an authorized source or procedure.' },
  observed: { label: 'Observed', short: 'OBS', help: 'Based on first-hand experience.' },
  unverified: { label: 'Unverified', short: 'UNV', help: 'Needs clarification.' },
  outdated: { label: 'Outdated', short: 'OUT', help: 'Previously valid; requires review.' },
}

export const TYPE_META: Record<EntityType, { label: string; plural: string }> = {
  department: { label: 'Department', plural: 'Departments' },
  workflow: { label: 'Workflow', plural: 'Workflows' },
  system: { label: 'System', plural: 'Systems & programs' },
  equipment: { label: 'Equipment', plural: 'Equipment' },
  glossary: { label: 'Glossary', plural: 'Glossary' },
  note: { label: 'Note', plural: 'Notes' },
  source: { label: 'Source', plural: 'Sources' },
}

export const NODE_META: Record<NodeKind, { label: string; help: string }> = {
  start: { label: 'Start', help: 'Where the workflow begins.' },
  step: { label: 'Step', help: 'Something that happens.' },
  decision: { label: 'Decision', help: 'A question with branching answers.' },
  warning: { label: 'Warning', help: 'An important reminder or safety-critical point.' },
  parallel: { label: 'Parallel', help: 'Work that splits apart or comes back together.' },
  link: { label: 'Hand-off', help: 'Continues in another workflow.' },
  unknown: { label: 'Unknown', help: 'A gap that still needs to be captured.' },
  end: { label: 'End', help: 'Where the workflow finishes.' },
}

export const ACCENTS: Record<AccentKey, { label: string; color: string }> = {
  brass: { label: 'Brass', color: 'var(--brass)' },
  glacier: { label: 'Glacier', color: 'var(--glacier)' },
  forest: { label: 'Forest', color: 'var(--forest-hi)' },
  signal: { label: 'Signal', color: 'var(--signal)' },
  slate: { label: 'Slate', color: 'var(--slate)' },
  lichen: { label: 'Lichen', color: 'var(--lichen)' },
}

export function hrefFor(e: Pick<Entity, 'type' | 'id'> | EntityRef, nodeId?: string): string {
  const id = encodeURIComponent(e.id)
  switch (e.type) {
    case 'department':
      return `/departments/${id}`
    case 'workflow': {
      const n = nodeId ?? ('nodeId' in e ? e.nodeId : undefined)
      return `/workflows/${id}${n ? `?node=${encodeURIComponent(n)}` : ''}`
    }
    case 'system':
      return `/systems/${id}`
    case 'equipment':
      return `/equipment/${id}`
    case 'glossary':
      return `/glossary/${id}`
    case 'note':
      return `/review#${id}`
    case 'source':
      return `/review/sources#${id}`
  }
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function newId(prefix: string, title = '') {
  const rnd = Math.random().toString(36).slice(2, 6)
  const slug = slugify(title)
  return `${prefix}-${slug ? slug + '-' : ''}${rnd}`
}

export const ID_PREFIX: Record<EntityType, string> = {
  department: 'dept',
  workflow: 'wf',
  system: 'sys',
  equipment: 'eq',
  glossary: 'gl',
  note: 'note',
  source: 'src',
}

export function fmtDate(iso?: string, withTime = false) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  })
}

export function relTime(iso?: string) {
  if (!iso) return ''
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
  return fmtDate(iso)
}

export function needsAttention(e: Entity) {
  return e.status === 'unverified' || e.status === 'outdated'
}
