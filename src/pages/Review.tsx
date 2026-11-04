import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Entity, Note, Source, Status } from '../../shared/types'
import { EntityActions, EntityEditor } from '../components/Editor'
import { blankEntity } from '../components/Forms'
import { Icon } from '../components/Icon'
import { ImageGallery } from '../components/Images'
import { EmptyState, PageHeader, RefChip, RichText, StatusBadge, StatusMeter, typeIcon } from '../components/ui'
import { fmtDate, hrefFor, relTime, STATUS_META, TYPE_META } from '../lib/meta'
import { useAtlas, useStore } from '../lib/store'

type Tab = 'queue' | 'notes' | 'sources'

export function Review() {
  const atlas = useAtlas()
  const location = useLocation()
  const navigate = useNavigate()
  const { canEdit, requestEdit } = useStore()
  const tab: Tab = location.pathname.endsWith('/sources') ? 'sources' : location.pathname.endsWith('/notes') ? 'notes' : 'queue'
  const [creating, setCreating] = useState<null | Entity>(null)
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')

  const notes = atlas.list('note')
  const openQuestions = notes.filter((n) => n.kind === 'question' && !n.resolved)
  const observations = notes.filter((n) => n.kind === 'observation')
  const resolved = notes.filter((n) => n.kind === 'question' && n.resolved)
  const content = atlas.all.filter((e) => e.type !== 'note' && e.type !== 'source')
  const steps = atlas.list('workflow').flatMap((w) => w.nodes.filter((n) => n.status).map((n) => ({ w, n })))

  const queue = useMemo(() => {
    const order: Status[] = ['outdated', 'unverified', 'observed', 'verified']
    return content
      .filter((e) => (statusFilter === 'all' ? e.status === 'outdated' || e.status === 'unverified' : e.status === statusFilter))
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

  return (
    <div className="page">
      <PageHeader
        kicker="Knowledge management"
        title="Review & verification"
        sub="Open questions, first-hand observations, and everything still waiting to be confirmed. Nothing is promoted to Verified automatically."
        actions={
          <div className="row gap-s wrap">
            <button className="btn btn--primary" onClick={() => (canEdit ? setCreating(blankEntity('note', { kind: 'question', status: 'unverified' } as any)) : requestEdit())}>
              <Icon name="question" size={16} /> Ask a question
            </button>
            <button className="btn btn--ghost" onClick={() => (canEdit ? setCreating(blankEntity('note', { kind: 'observation', status: 'observed' } as any)) : requestEdit())}>
              <Icon name="eye" size={16} /> Observation
            </button>
          </div>
        }
      />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'queue'} className={`tab ${tab === 'queue' ? 'is-on' : ''}`} onClick={() => navigate('/review')}>
          Queue <span>{openQuestions.length + queue.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'notes'} className={`tab ${tab === 'notes' ? 'is-on' : ''}`} onClick={() => navigate('/review/notes')}>
          Observations <span>{observations.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'sources'} className={`tab ${tab === 'sources' ? 'is-on' : ''}`} onClick={() => navigate('/review/sources')}>
          Sources <span>{atlas.list('source').length}</span>
        </button>
      </div>

      {tab === 'queue' && (
        <>
          <div className="verify-summary">
            <StatusMeter items={content} />
          </div>
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
                <h2 className="section__title">Content to verify</h2>
              </div>
            </header>
            <div className="pills">
              {(['all', 'outdated', 'unverified', 'observed', 'verified'] as const).map((s) => (
                <button key={s} className={`pill ${statusFilter === s ? 'is-on' : ''}`} onClick={() => setStatusFilter(s)}>
                  {s === 'all' ? 'Needs attention' : STATUS_META[s].label}
                </button>
              ))}
            </div>
            {queue.length ? (
              <ul className="rowlist rowlist--dense">
                {queue.map((e) => (
                  <li key={e.id}>
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
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="check" title="Nothing in this state" />
            )}
            {steps.length > 0 && statusFilter !== 'verified' && (
              <>
                <h3 className="subhead">Individual steps flagged</h3>
                <ul className="rowlist rowlist--dense">
                  {steps
                    .filter(({ n }) => (statusFilter === 'all' ? n.status === 'unverified' || n.status === 'outdated' : n.status === statusFilter))
                    .map(({ w, n }) => (
                      <li key={w.id + n.id}>
                        <Link to={hrefFor(w, n.id)} className="rowlink">
                          <Icon name="flow" size={18} className="rowlink__icon" />
                          <span className="rowlink__main">
                            <span className="rowlink__title">{n.label}</span>
                            <span className="rowlink__sub">
                              {w.code} {w.title}
                            </span>
                          </span>
                          <StatusBadge status={n.status!} compact />
                        </Link>
                      </li>
                    ))}
                </ul>
              </>
            )}
          </section>
          {resolved.length > 0 && (
            <section className="section">
              <header className="section__head">
                <h2 className="section__title">Resolved</h2>
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

      {tab === 'notes' && (
        <section className="section">
          {observations.length ? (
            <div className="notecards">
              {observations.map((n) => (
                <NoteCard key={n.id} note={n} />
              ))}
            </div>
          ) : (
            <EmptyState icon="eye" title="No observations yet" action={<Link className="btn btn--ghost" to="/add/observation">Add your first observation</Link>}>
              Record what you see on the floor or in the shop. Observations stay marked as <b>Observed</b> until you confirm them against an authorized source.
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

      {creating && <EntityEditor entity={creating} open isNew navigateOnCreate={false} onClose={() => setCreating(null)} />}
    </div>
  )
}

function NoteCard({ note }: { note: Note }) {
  const { save, canEdit } = useStore()
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
      {note.answer && (
        <div className="notecard__answer">
          <div className="kicker">Answer</div>
          <RichText text={note.answer} />
        </div>
      )}
      <ImageGallery ids={note.imageIds} />
      <footer className="notecard__foot">
        <span className="muted">{fmtDate(note.updatedAt)}</span>
        <div className="row gap-s wrap">
          {canEdit && note.kind === 'question' && !note.resolved && (
            <button
              className="btn btn--ghost btn--small"
              onClick={() => {
                const answer = prompt('What did you find out? (saved as the answer)')
                if (answer === null) return
                save({ ...note, resolved: true, answer: answer || note.answer }, { note: 'Marked resolved' })
              }}
            >
              <Icon name="check" size={14} /> Resolve
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
