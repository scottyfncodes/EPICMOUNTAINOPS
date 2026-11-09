import MiniSearch from 'minisearch'
import type { Entity, EntityType, Workflow } from '../../shared/types'
import type { Atlas } from './store'
import { hrefFor, NODE_META, TYPE_META } from './meta'

export type ResultKind = EntityType | 'step' | 'section'

export interface SearchDoc {
  id: string
  kind: ResultKind
  title: string
  aka: string
  body: string
  /** Breadcrumb showing where the information lives. */
  where: string
  href: string
  status?: string
  code?: string
}

const join = (...xs: (string | string[] | undefined)[]) => xs.flat().filter(Boolean).join(' · ')

/** Split camel/acronyms so "BSL" and "bsl" both match; keep partial words. */
function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

export function buildDocs(atlas: Atlas): SearchDoc[] {
  const docs: SearchDoc[] = []
  const names = (ids?: string[]) => (ids || []).map((id) => atlas.get(id)?.title).filter(Boolean) as string[]

  for (const e of atlas.all) {
    const common = { status: e.status, href: hrefFor(e) }
    switch (e.type) {
      case 'department':
        docs.push({
          ...common,
          id: e.id,
          kind: 'department',
          title: e.title,
          code: e.code,
          aka: e.code,
          body: join(e.tagline, e.summary, e.description, e.responsibilities, e.notes),
          where: e.code,
        })
        for (const s of e.sections)
          docs.push({
            id: `${e.id}#${s.id}`,
            kind: 'section',
            title: s.title,
            aka: '',
            body: join(s.description, names(s.workflowIds)),
            where: e.title,
            href: `${hrefFor(e)}#${s.id}`,
          })
        break
      case 'workflow': {
        const w = e as Workflow
        const depts = names(w.departmentIds).join(', ')
        docs.push({
          ...common,
          id: w.id,
          kind: 'workflow',
          title: w.title,
          code: w.code,
          aka: w.code || '',
          body: join(w.summary, w.trigger, w.outcome, w.notes, names(w.systemIds), names(w.equipmentIds)),
          where: depts || 'Unassigned',
        })
        for (const n of w.nodes)
          docs.push({
            id: `${w.id}::${n.id}`,
            kind: 'step',
            title: n.label,
            aka: NODE_META[n.kind].label,
            body: join(n.what, n.why, n.who, n.info, n.next, n.mistakes, n.considerations, n.phase, (n.callouts || []).map((c) => c.text), (n.sizing || []).map((b) => b.label), names(n.systemIds), names(n.equipmentIds)),
            where: `${w.code ? w.code + ' ' : ''}${w.title}${n.kind !== 'step' ? ' · ' + NODE_META[n.kind].label : ''}`,
            href: hrefFor(w, n.id),
            status: n.status || w.status,
          })
        break
      }
      case 'system':
        docs.push({
          ...common,
          id: e.id,
          kind: 'system',
          title: e.title,
          aka: e.kind,
          body: join(e.summary, e.description, e.purpose, e.inputs, e.outputs, e.whenUsed, e.notes),
          where: e.kind,
        })
        break
      case 'equipment':
        docs.push({
          ...common,
          id: e.id,
          kind: 'equipment',
          title: e.title,
          aka: e.category || '',
          body: join(e.summary, e.description, e.notes),
          where: e.category || '',
        })
        break
      case 'glossary':
        docs.push({
          ...common,
          id: e.id,
          kind: 'glossary',
          title: e.title,
          aka: e.aka.join(' '),
          body: join(e.definition, e.notes),
          where: e.kind,
        })
        break
      case 'note':
        docs.push({
          ...common,
          id: e.id,
          kind: 'note',
          title: e.title,
          aka: e.kind,
          body: join(e.body, e.answer, e.notes),
          where: `${e.kind}${e.resolved ? ' · resolved' : ''}`,
        })
        break
      case 'source':
        docs.push({
          ...common,
          id: e.id,
          kind: 'source',
          title: e.title,
          aka: e.kind,
          body: join(e.description, e.notes),
          where: e.kind,
        })
        break
    }
  }
  return docs
}

export function buildIndex(atlas: Atlas) {
  const docs = buildDocs(atlas)
  const ms = new MiniSearch<SearchDoc>({
    fields: ['title', 'aka', 'code', 'body', 'where'],
    storeFields: ['kind', 'title', 'where', 'href', 'status', 'code', 'body'],
    tokenize,
    searchOptions: {
      boost: { title: 4, aka: 3, code: 3, body: 1, where: 0.5 },
      prefix: true,
      fuzzy: (term) => (term.length > 4 ? 0.2 : false),
      combineWith: 'AND',
    },
  })
  ms.addAll(docs)
  return ms
}

export type SearchHit = SearchDoc & { score: number; terms: string[] }

export function runSearch(ms: MiniSearch<SearchDoc>, q: string, limit = 60): SearchHit[] {
  const query = q.trim()
  if (!query) return []
  let hits = ms.search(query) as unknown as SearchHit[]
  if (!hits.length) hits = ms.search(query, { combineWith: 'OR' }) as unknown as SearchHit[]
  return hits.slice(0, limit)
}

export const KIND_LABEL: Record<ResultKind, string> = {
  ...Object.fromEntries(Object.entries(TYPE_META).map(([k, v]) => [k, v.label])),
  step: 'Step',
  section: 'Section',
} as Record<ResultKind, string>

/** Short excerpt around the first matched term. */
export function snippet(text: string, terms: string[], len = 120) {
  if (!text) return ''
  const lower = text.toLowerCase()
  let at = -1
  for (const t of terms) {
    const i = lower.indexOf(t.toLowerCase())
    if (i >= 0 && (at < 0 || i < at)) at = i
  }
  if (at < 0) return text.length > len ? text.slice(0, len) + '…' : text
  const start = Math.max(0, at - 40)
  const out = text.slice(start, start + len)
  return (start > 0 ? '…' : '') + out + (start + len < text.length ? '…' : '')
}

export type { Entity }
