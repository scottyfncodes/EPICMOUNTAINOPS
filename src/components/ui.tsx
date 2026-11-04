import { Fragment, useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { AccentKey, Entity, EntityType, GlossaryEntry, NodeKind, Status } from '../../shared/types'
import { ACCENTS, hrefFor, NODE_META, STATUS_META, TYPE_META } from '../lib/meta'
import { useAtlas } from '../lib/store'
import { Icon, type IconName } from './Icon'

/* ------------------------------------------------------------------ */
export function StatusBadge({ status, compact = false }: { status: Status; compact?: boolean }) {
  const m = STATUS_META[status]
  return (
    <span className={`status status--${status}`} title={`${m.label}: ${m.help}`}>
      <span className="status__dot" aria-hidden="true" />
      {compact ? m.short : m.label}
    </span>
  )
}

export function StatusMeter({ items, showLegend = true }: { items: { status: Status }[]; showLegend?: boolean }) {
  const counts = { verified: 0, observed: 0, unverified: 0, outdated: 0 } as Record<Status, number>
  for (const i of items) counts[i.status]++
  const total = items.length || 1
  return (
    <div className="meter">
      <div className="meter__bar" role="img" aria-label={`Verification: ${counts.verified} verified, ${counts.observed} observed, ${counts.unverified} unverified, ${counts.outdated} outdated`}>
        {(Object.keys(counts) as Status[]).map((s) =>
          counts[s] ? <span key={s} className={`meter__seg meter__seg--${s}`} style={{ flexGrow: counts[s] / total }} /> : null,
        )}
      </div>
      {showLegend && (
        <div className="meter__legend">
          {(Object.keys(counts) as Status[]).map((s) => (
            <span key={s} className={`meter__key meter__key--${s}`}>
              <span className="status__dot" />
              {STATUS_META[s].label} <b>{counts[s]}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
const TYPE_ICON: Record<EntityType, IconName> = {
  department: 'peaks',
  workflow: 'flow',
  system: 'system',
  equipment: 'wrench',
  glossary: 'book',
  note: 'question',
  source: 'layers',
}
export const typeIcon = (t: EntityType) => TYPE_ICON[t]

export function RefChip({ id, nodeId, accent }: { id: string; nodeId?: string; accent?: AccentKey }) {
  const atlas = useAtlas()
  const e = atlas.get(id)
  if (!e) return <span className="chip chip--missing" title="This item was deleted or not found">Missing item</span>
  const a = accent || (e.type === 'department' ? e.accent : undefined)
  return (
    <Link to={hrefFor(e, nodeId)} viewTransition className={`chip chip--${e.type}`} style={a ? ({ '--chip-accent': ACCENTS[a].color } as React.CSSProperties) : undefined}>
      <Icon name={TYPE_ICON[e.type]} size={14} />
      <span>{e.type === 'workflow' && e.code ? <span className="chip__code">{e.code}</span> : null}{e.title}</span>
    </Link>
  )
}

export function RefChips({ ids, empty }: { ids?: string[]; empty?: ReactNode }) {
  if (!ids?.length) return empty ? <>{empty}</> : null
  return (
    <div className="chips">
      {ids.map((id) => (
        <RefChip key={id} id={id} />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
export function NodeGlyph({ kind, size = 14 }: { kind: NodeKind; size?: number }) {
  return <span className={`glyph glyph--${kind}`} style={{ width: size, height: size }} aria-label={NODE_META[kind].label} role="img" />
}

/* ------------------------------------------------------------------ */
export function Section({ title, kicker, action, children, id, className = '' }: { title: ReactNode; kicker?: ReactNode; action?: ReactNode; children: ReactNode; id?: string; className?: string }) {
  return (
    <section className={`section ${className}`} id={id}>
      <header className="section__head">
        <div>
          {kicker && <div className="kicker">{kicker}</div>}
          <h2 className="section__title">{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

export function EmptyState({ icon = 'dot', title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={22} />
      <div>
        <div className="empty__title">{title}</div>
        {children && <div className="empty__body">{children}</div>}
        {action && <div className="empty__action">{action}</div>}
      </div>
    </div>
  )
}

export function IllustrativeBanner({ entity }: { entity: Entity }) {
  if (!entity.illustrative) return null
  return (
    <div className="banner banner--illustrative" role="note">
      <Icon name="info" size={18} />
      <div>
        <b>Illustrative placeholder.</b> This is starter structure, not an official procedure. Confirm each step before relying on it.
      </div>
    </div>
  )
}

export function PageHeader({
  kicker,
  title,
  sub,
  accent,
  actions,
  status,
  children,
}: {
  kicker?: ReactNode
  title: ReactNode
  sub?: ReactNode
  accent?: AccentKey
  actions?: ReactNode
  status?: Status
  children?: ReactNode
}) {
  return (
    <header className="pagehead" style={accent ? ({ '--accent': ACCENTS[accent].color } as React.CSSProperties) : undefined}>
      <div className="pagehead__row">
        {kicker && <div className="kicker">{kicker}</div>}
        {status && <StatusBadge status={status} />}
      </div>
      <h1 className="pagehead__title">{title}</h1>
      {sub && <p className="pagehead__sub">{sub}</p>}
      {actions && <div className="pagehead__actions">{actions}</div>}
      {children}
    </header>
  )
}

/** Definition-list row that hides itself when empty (unless `placeholder`). */
export function Field({ label, children, placeholder }: { label: string; children?: ReactNode; placeholder?: string }) {
  const empty = children === undefined || children === null || children === '' || (Array.isArray(children) && children.length === 0)
  if (empty && !placeholder) return null
  return (
    <div className="field">
      <div className="field__label">{label}</div>
      <div className={`field__value ${empty ? 'is-empty' : ''}`}>{empty ? placeholder : children}</div>
    </div>
  )
}

export function Meta({ entity }: { entity: Entity }) {
  return (
    <dl className="metagrid">
      <div>
        <dt>Status</dt>
        <dd>
          <StatusBadge status={entity.status} />
        </dd>
      </div>
      <div>
        <dt>Created</dt>
        <dd>{new Date(entity.createdAt).toLocaleDateString()}</dd>
      </div>
      <div>
        <dt>Updated</dt>
        <dd>{new Date(entity.updatedAt).toLocaleDateString()}</dd>
      </div>
      <div>
        <dt>Last verified</dt>
        <dd>{entity.lastVerifiedAt ? new Date(entity.lastVerifiedAt).toLocaleDateString() : 'Never'}</dd>
      </div>
    </dl>
  )
}

export function SourceLine({ entity }: { entity: Entity }) {
  if (!entity.source && !entity.sourceIds?.length) return null
  return (
    <Field label="Source / reference">
      {entity.source && <p className="prose">{entity.source}</p>}
      <RefChips ids={entity.sourceIds} />
    </Field>
  )
}

/* ------------------------------------------------------------------ */
/* Glossary-aware text                                                */
/* ------------------------------------------------------------------ */
function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function useGlossaryMatcher(skipId?: string) {
  const atlas = useAtlas()
  const glossary = atlas.list('glossary')
  return useMemo(() => {
    const terms: { text: string; entry: GlossaryEntry; caseSensitive: boolean }[] = []
    for (const g of glossary) {
      if (g.id === skipId) continue
      for (const t of [g.title, ...g.aka]) {
        if (!t || t.length < 2) continue
        const caseSensitive = /^[A-Z0-9-]{2,6}$/.test(t)
        terms.push({ text: t, entry: g, caseSensitive })
      }
    }
    terms.sort((a, b) => b.text.length - a.text.length)
    if (!terms.length) return null
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(${terms.map((t) => escapeRe(t.text)).join('|')})(?![\\p{L}\\p{N}])`, 'giu')
    const lookup = (m: string) =>
      terms.find((t) => (t.caseSensitive ? t.text === m : t.text.toLowerCase() === m.toLowerCase()))
    return { re, lookup }
  }, [glossary, skipId])
}

/** Renders plain text, turning glossary terms into links (first occurrence of each). */
export function RichText({ text, skipGlossaryId, as: Tag = 'p' }: { text?: string; skipGlossaryId?: string; as?: 'p' | 'span' | 'div' }) {
  const matcher = useGlossaryMatcher(skipGlossaryId)
  if (!text) return null
  if (!matcher) return <Tag className="prose">{text}</Tag>
  const out: ReactNode[] = []
  const used = new Set<string>()
  let last = 0
  for (const m of text.matchAll(matcher.re)) {
    const hit = matcher.lookup(m[0])
    if (!hit || used.has(hit.entry.id)) continue
    used.add(hit.entry.id)
    const i = m.index!
    out.push(text.slice(last, i))
    out.push(
      <Link key={i} to={hrefFor(hit.entry)} viewTransition className="gloss" title={hit.entry.definition}>
        {m[0]}
      </Link>,
    )
    last = i + m[0].length
  }
  out.push(text.slice(last))
  return (
    <Tag className="prose">
      {out.map((x, i) => (
        <Fragment key={i}>{x}</Fragment>
      ))}
    </Tag>
  )
}

export function TypeLabel({ type }: { type: EntityType }) {
  return (
    <span className="typelabel">
      <Icon name={TYPE_ICON[type]} size={14} />
      {TYPE_META[type].label}
    </span>
  )
}
