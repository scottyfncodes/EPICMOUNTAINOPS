import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Department, Entity, Note, Source, Status, Workflow } from '../../shared/types'
import { integrityReport } from '../../shared/validate'
import { EntityActions, EntityEditor } from '../components/Editor'
import { blankEntity } from '../components/Forms'
import { Icon } from '../components/Icon'
import { ImageGallery } from '../components/Images'
import { StatusReview } from '../components/StatusReview'
import { EmptyState, NodeGlyph, PageHeader, RefChip, RichText, StatusBadge, StatusGlyph, typeIcon } from '../components/ui'
import { stepGaps } from '../explorer/routing'
import { api } from '../lib/api'
import { useCapture } from '../lib/capture'
import { ACCENTS, fmtDate, hrefFor, relTime, STATUS_META, TYPE_META } from '../lib/meta'
import { useAtlas, useStore } from '../lib/store'

type Tab = 'queue' | 'gaps' | 'notes' | 'sources' | 'deleted' | 'integrity'
const TABS: { id: Tab; label: string; path: string }[] = [
  { id: 'queue', label: 'Queue', path: '/review' },
  { id: 'gaps', label: 'Gaps', path: '/review/gaps' },
  { id: 'notes', label: 'Observations', path: '/review/notes' },
  { id: 'sources', label: 'Sources', path: '/review/sources' },
  { id: 'deleted', label: 'Deleted', path: '/review/deleted' },
  { id: 'integrity', label: 'Integrity', path: '/review/integrity' },
]

export function Review() {
  const atlas = useAtlas()
  const location = useLocation()
  const navigate = useNavigate()
  const { canEdit, requestEdit } = useStore()
  const { open: openCapture } = useCapture()
  const tab: Tab = TABS.find((t) => t.path !== '/review' && location.pathname.startsWith(t.path))?.id ?? 'queue'
  const [creating, setCreating] = useState<null | Entity>(null)
  const [statusFilter, setStatusFilter] = useState<Status | 'attention'>('attention')
  const [reviewing, setReviewing] = useState<Entity | null>(null)

  const notes = atlas.list('note')
  const openQuestions = notes.filter((n) => n.kind === 'question' && !n.resolved)
  const observations = notes.filter((n) => n.kind === 'observation')
  const resolved = notes.filter((n) => n.kind === 'question' && n.resolved)
  const content = useMemo(() => atlas.all.filter((e) => e.type !== 'note' && e.type !== 'source'), [atlas])

  const gaps = useMemo(() => {
    const out: { w: Workflow; items: { id: string; label: string; kind: string; missing: string[] }[] }[] = []
    for (const w of atlas.list('workflow')) {
      const items = w.nodes
        .map((n) => ({ id: n.id, label: n.label, kind: n.kind, missing: n.kind === 'unknown' ? ['Entire step'] : stepGaps(n) }))
        .filter((x) => x.missing.length)
      if (items.length) out.push({ w, items })
    }
    return out
  }, [atlas])
  const gapCount = gaps.reduce((n, g) => n + g.items.length, 0)
  const unknownCount = gaps.reduce((n, g) => n + g.items.filter((i) => i.kind === 'unknown').length, 0)
  const issues = useMemo(() => integrityReport(atlas.all, new Set(atlas.images.keys())), [atlas])

  const queue = useMemo(() => {
    const order: Status[] = ['outdated', 'unverified', 'observed', 'verified']
    return content
      .filter((e) => (statusFilter === 'attention' ? e.status === 'outdated' || e.status === 'unverified' : e.status === statusFilter))
      .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.type.localeCompare(b.type) || a.title.localeCompare(b.title))
  }, [content, statusFilter])

  useEffect(() => {
    if (!location.hash) return
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)))
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('is-flash')
      setTimeout(() => el.classList.remove('is-flash'), 1600)
    }
  }, [location.hash, tab])

  const counts: Record<Tab, number> = {
    queue: openQuestions.length + content.filter((e) => e.status === 'outdated' || e.status === 'unverified').length,
    gaps: gapCount,
    notes: observations.length,
    sources: atlas.list('source').length,
    deleted: 0,
    integrity: issues.length,
  }

  return (
    <div className="page">
      <PageHeader
        kicker="Knowledge management"
        title="Review & verification"
        sub="Close knowledge gaps one at a time. Nothing is ever promoted to Verified automatically — every status change is a deliberate, sourced decision."
        actions={
          <div className="row gap-s wrap">
            <button className="btn btn--primary" onClick={() => (canEdit ? openCapture('question', null) : requestEdit())}>
              <Icon name="question" size={16} /> Ask a question
            </button>
            <button className="btn btn--ghost" onClick={() => (canEdit ? openCapture('observation', null) : requestEdit())}>
              <Icon name="eye" size={16} /> Observation
            </button>
          </div>
        }
      />

      <Progress />

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'is-on' : ''}`} onClick={() => navigate(t.path)}>
            {t.label} {t.id !== 'deleted' && <span>{counts[t.id]}</span>}
          </button>
        ))}
      </div>

      {tab === 'queue' && (
        <>
          <section className="section">
            <header className="section__head">
              <div>
                <div className="kicker kicker--signal">Clarify</div>
                <h2 className="section__title">Open questions</h2>
              </div>
            </header>
            {openQuestions.length ? (
              <div className="notecards">
                {openQuestions.map((n) => (
                  <NoteCard key={n.id} note={n} />
                ))}
              </div>
            ) : (
              <EmptyState icon="check" title="No open questions" />
            )}
          </section>
          <section className="section">
            <header className="section__head">
              <div>
                <div className="kicker">Confirm</div>
                <h2 className="section__title">Content by status</h2>
              </div>
            </header>
            <div className="pills pills--scroll">
              <button className={`pill ${statusFilter === 'attention' ? 'is-on' : ''}`} onClick={() => setStatusFilter('attention')}>
                Needs attention
              </button>
              {(['outdated', 'unverified', 'observed', 'verified'] as Status[]).map((s) => (
                <button key={s} className={`pill status--${s} ${statusFilter === s ? 'is-on' : ''}`} onClick={() => setStatusFilter(s)}>
                  <StatusGlyph status={s} /> {STATUS_META[s].label} <span>{content.filter((e) => e.status === s).length}</span>
                </button>
              ))}
            </div>
            {queue.length ? (
              <ul className="rowlist rowlist--dense reviewlist">
                {queue.map((e) => (
                  <li key={e.id} className="reviewrow">
                    <Link to={hrefFor(e)} className="rowlink">
                      <Icon name={typeIcon(e.type)} size={18} className="rowlink__icon" />
                      <span className="rowlink__main">
                        <span className="rowlink__title">
                          {e.type === 'workflow' && e.code && <span className="chip__code">{e.code}</span>}
                          {e.title}
                        </span>
                        <span className="rowlink__sub">
                          {TYPE_META[e.type].label} · updated {relTime(e.updatedAt)}
                          {e.illustrative ? ' · illustrative' : ''}
                        </span>
                      </span>
                      <StatusBadge status={e.status} compact />
                    </Link>
                    <button className="btn btn--ghost btn--small reviewrow__btn" onClick={() => (canEdit ? setReviewing(e) : requestEdit())} aria-label={`Review status of ${e.title}`}>
                      Review
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="check" title="Nothing in this state" />
            )}
          </section>
          {resolved.length > 0 && (
            <section className="section">
              <header className="section__head">
                <h2 className="section__title">Resolved questions</h2>
              </header>
              <div className="notecards">
                {resolved.map((n) => (
                  <NoteCard key={n.id} note={n} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {tab === 'gaps' && (
        <section className="section">
          <p className="lede lede--small">
            <b>{unknownCount}</b> unknown step{unknownCount === 1 ? '' : 's'} and <b>{gapCount - unknownCount}</b> step{gapCount - unknownCount === 1 ? '' : 's'} missing what, why or who. Tap one to open it on its map.
          </p>
          {gaps.length === 0 && <EmptyState icon="check" title="Every step explains what, why and who" />}
          {gaps.map(({ w, items }) => (
            <div key={w.id} className="gapgroup">
              <Link to={hrefFor(w)} className="gapgroup__head">
                <span className="mono">{w.code}</span> {w.title}
                <span className="muted mono">{items.length}</span>
              </Link>
              <ul className="gaplist">
                {items.map((i) => (
                  <li key={i.id}>
                    <Link to={hrefFor(w, i.id)} className={`gapitem ${i.kind === 'unknown' ? 'gapitem--unknown' : ''}`}>
                      <NodeGlyph kind={i.kind as any} size={12} />
                      <span className="gapitem__label">{i.label}</span>
                      <span className="gapitem__missing">{i.kind === 'unknown' ? 'Unknown' : `No ${i.missing.join(', ')}`}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {tab === 'notes' && (
        <section className="section">
          {observations.length ? (
            <div className="notecards">
              {observations.map((n) => (
                <NoteCard key={n.id} note={n} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon="eye"
              title="No observations yet"
              action={
                <button className="btn btn--ghost" onClick={() => (canEdit ? openCapture('observation', null) : requestEdit())}>
                  Add your first observation
                </button>
              }
            >
              Record what you see on the floor or in the shop. Observations stay <b>Observed</b> until you confirm them against an authorized source.
            </EmptyState>
          )}
        </section>
      )}

      {tab === 'sources' && (
        <section className="section">
          <div className="row gap-s">
            <button className="btn btn--ghost" onClick={() => (canEdit ? setCreating(blankEntity('source')) : requestEdit())}>
              <Icon name="plus" size={16} /> Add source
            </button>
          </div>
          <div className="notecards">
            {atlas.list('source').map((s) => (
              <SourceCard key={s.id} source={s} />
            ))}
          </div>
        </section>
      )}

      {tab === 'deleted' && <DeletedList />}

      {tab === 'integrity' && (
        <section className="section">
          {issues.length === 0 ? (
            <EmptyState icon="check" title="All cross-references are intact">
              Every link between departments, workflows, steps, systems, equipment, glossary entries, sources and images points at something that exists.
            </EmptyState>
          ) : (
            <ul className="rowlist">
              {issues.map((i, k) => {
                const e = atlas.get(i.entityId)!
                return (
                  <li key={k}>
                    <Link to={hrefFor(e, i.nodeId)} className="rowlink">
                      <Icon name="warning" size={18} className="rowlink__icon rowlink__icon--signal" />
                      <span className="rowlink__main">
                        <span className="rowlink__title">{e.title}</span>
                        <span className="rowlink__sub">
                          {i.kind === 'missing-link' ? 'Hand-off to a missing workflow' : i.kind === 'missing-image' ? 'Missing image' : i.kind === 'orphan-step' ? 'Step not connected to anything' : 'Link to a deleted item'} · {i.detail}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {creating && <EntityEditor entity={creating} open isNew navigateOnCreate={false} onClose={() => setCreating(null)} />}
      {reviewing && <StatusReview entity={reviewing} open onClose={() => setReviewing(null)} />}
    </div>
  )
}

/** Verification progress per department (workflows + their steps). */
function Progress() {
  const atlas = useAtlas()
  return (
    <div className="progress">
      {atlas.departments.map((d: Department) => {
        const wfs = atlas.workflowsForDepartment(d.id)
        const steps = wfs.flatMap((w) => w.nodes.filter((n) => n.kind !== 'start' && n.kind !== 'end' && n.kind !== 'parallel').map((n) => n.status ?? w.status))
        const total = steps.length || 1
        const c = (s: Status) => steps.filter((x) => x === s).length
        const confirmed = c('verified')
        return (
          <Link key={d.id} to={`${hrefFor(d)}`} className="progress__row" style={{ '--accent': ACCENTS[d.accent].color } as React.CSSProperties}>
            <span className="progress__code mono">{d.code}</span>
            <span className="progress__bar" role="img" aria-label={`${d.title}: ${confirmed} of ${steps.length} steps verified, ${c('observed')} observed, ${c('unverified')} unverified, ${c('outdated')} outdated`}>
              {(['verified', 'observed', 'unverified', 'outdated'] as Status[]).map((s) =>
                c(s) ? <span key={s} className={`meter__seg meter__seg--${s}`} style={{ width: `${(c(s) / total) * 100}%` }} /> : null,
              )}
            </span>
            <span className="progress__pct mono">{Math.round((confirmed / total) * 100)}%</span>
          </Link>
        )
      })}
      <div className="progress__legend">
        {(['verified', 'observed', 'unverified', 'outdated'] as Status[]).map((s) => (
          <span key={s} className={`status--${s}`}>
            <StatusGlyph status={s} /> {STATUS_META[s].label}
          </span>
        ))}
        <span className="muted">· % = steps verified</span>
      </div>
    </div>
  )
}

function DeletedList() {
  const { canEdit, requestEdit, save, toast } = useStore()
  const [items, setItems] = useState<(Entity & { deletedAt: string })[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = () =>
    api
      .deleted()
      .then(setItems)
      .catch((e) => setError(e.message))
  useEffect(() => {
    load()
  }, [])
  return (
    <section className="section">
      <p className="muted">Deleting never erases anything. Restore an item and its full version history comes back with it.</p>
      {!items && !error && (
        <div className="skeleton-list" aria-busy="true">
          <span />
          <span />
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
      {items && items.length === 0 && <EmptyState icon="check" title="Nothing has been deleted" />}
      {items && items.length > 0 && (
        <ul className="rowlist">
          {items.map((e) => (
            <li key={e.id} className="reviewrow">
              <div className="rowlink">
                <Icon name={typeIcon(e.type)} size={18} className="rowlink__icon" />
                <span className="rowlink__main">
                  <span className="rowlink__title">{e.title}</span>
                  <span className="rowlink__sub">
                    {TYPE_META[e.type].label} · deleted {relTime(e.deletedAt)}
                  </span>
                </span>
              </div>
              <button
                className="btn btn--ghost btn--small reviewrow__btn"
                onClick={async () => {
                  if (!canEdit) return requestEdit()
                  const { deletedAt: _d, ...entity } = e
                  void _d
                  try {
                    await save(entity as Entity, { action: 'restore', note: 'Restored after deletion', quiet: true })
                    toast(`Restored “${e.title}”`)
                    load()
                  } catch {
                    /* toast shown */
                  }
                }}
              >
                <Icon name="undo" size={14} /> Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function NoteCard({ note }: { note: Note }) {
  const { save, canEdit, requestEdit } = useStore()
  const [answering, setAnswering] = useState(false)
  const [answer, setAnswer] = useState(note.answer || '')
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <article id={note.id} className={`notecard notecard--${note.kind} ${note.resolved ? 'is-resolved' : ''}`}>
      <header className="notecard__head">
        <span className="notecard__kind">
          <Icon name={note.kind === 'question' ? 'question' : 'eye'} size={16} />
          {note.kind === 'question' ? (note.resolved ? 'Resolved question' : 'Open question') : 'Observation'}
        </span>
        <StatusBadge status={note.status} compact />
      </header>
      <h3 className="notecard__title">{note.title}</h3>
      {note.body && <RichText text={note.body} />}
      {note.links.length > 0 && (
        <div className="chips">
          {note.links.map((l, i) => (
            <RefChip key={i} id={l.id} nodeId={l.nodeId} />
          ))}
        </div>
      )}
      {note.source && <p className="notecard__source">Source: {note.source}</p>}
      {note.answer && !answering && (
        <div className="notecard__answer">
          <div className="kicker">Answer</div>
          <RichText text={note.answer} />
        </div>
      )}
      <ImageGallery ids={note.imageIds} />
      {answering && (
        <div className="form notecard__resolve">
          <div className="fi">
            <label className="fi__label" htmlFor={`ans-${note.id}`}>
              What did you find out?
            </label>
            <textarea id={`ans-${note.id}`} className="input" rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} autoFocus />
          </div>
          <div className="fi">
            <label className="fi__label" htmlFor={`src-${note.id}`}>
              Where from? <span className="fi__req">optional</span>
            </label>
            <input id={`src-${note.id}`} className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Asked the shop lead" />
          </div>
          <p className="fi__help">Resolving records the answer. It doesn’t change the status of the content it’s about — review that separately.</p>
          <div className="row gap-s">
            <span className="grow" />
            <button className="btn btn--ghost btn--small" onClick={() => setAnswering(false)}>
              Cancel
            </button>
            <button
              className="btn btn--primary btn--small"
              disabled={busy || !answer.trim()}
              onClick={async () => {
                setBusy(true)
                try {
                  await save({ ...note, resolved: true, answer: answer.trim(), source: source.trim() || note.source }, { note: 'Resolved question' })
                  setAnswering(false)
                } catch {
                  /* toast shown */
                } finally {
                  setBusy(false)
                }
              }}
            >
              <Icon name="check" size={14} /> Resolve
            </button>
          </div>
        </div>
      )}
      <footer className="notecard__foot">
        <span className="muted">{fmtDate(note.updatedAt)}</span>
        <div className="row gap-s wrap">
          {note.kind === 'question' && !note.resolved && !answering && (
            <button className="btn btn--ghost btn--small" onClick={() => (canEdit ? setAnswering(true) : requestEdit())}>
              <Icon name="check" size={14} /> Answer
            </button>
          )}
          <EntityActions entity={note} />
        </div>
      </footer>
    </article>
  )
}

function SourceCard({ source }: { source: Source }) {
  const atlas = useAtlas()
  const usedBy = atlas.all.filter((e) => e.sourceIds?.includes(source.id))
  return (
    <article id={source.id} className="notecard">
      <header className="notecard__head">
        <span className="notecard__kind">
          <Icon name="layers" size={16} /> {source.kind}
          {source.authorized ? ' · authorized' : ''}
        </span>
        <StatusBadge status={source.status} compact />
      </header>
      <h3 className="notecard__title">{source.title}</h3>
      {source.description && <RichText text={source.description} />}
      <p className="muted">
        Referenced by {usedBy.length} item{usedBy.length === 1 ? '' : 's'}
        {source.date ? ` · ${source.date}` : ''}
      </p>
      <footer className="notecard__foot">
        <span />
        <EntityActions entity={source} />
      </footer>
    </article>
  )
}
