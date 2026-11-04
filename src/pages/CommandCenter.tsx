import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Department, Entity, Workflow } from '../../shared/types'
import { Topo } from '../components/Art'
import { Icon } from '../components/Icon'
import { Emblem, EmptyState, StatusBadge, StatusMeter, typeIcon } from '../components/ui'
import { ACCENTS, hrefFor, needsAttention, relTime, TYPE_META } from '../lib/meta'
import { readRecent, useAtlas } from '../lib/store'

export function CommandCenter() {
  const atlas = useAtlas()
  const workflows = atlas.list('workflow')
  const systems = atlas.list('system')
  const glossary = atlas.list('glossary')
  const equipment = atlas.list('equipment')
  const steps = workflows.reduce((n, w) => n + w.nodes.length, 0)
  const questions = atlas.list('note').filter((n) => n.kind === 'question' && !n.resolved)

  const scored = useMemo(() => atlas.all.filter((e) => e.type !== 'note' && e.type !== 'source'), [atlas])
  const attention = useMemo(
    () =>
      [...scored.filter((e) => e.status === 'outdated'), ...scored.filter((e) => e.status === 'unverified' && e.type === 'workflow')].slice(0, 5),
    [scored],
  )
  const recentlyAdded = useMemo(() => [...atlas.all].filter((e) => e.type !== 'source').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5), [atlas])
  const recent = readRecent()
    .map((r) => ({ r, e: atlas.get(r.id) }))
    .filter((x) => x.e)
    .slice(0, 5)

  return (
    <div className="page page--command">
      <section className="masthead">
        <img className="masthead__art" src="/art/panorama.svg" alt="" aria-hidden="true" width={1600} height={600} decoding="async" />
        <div className="masthead__inner">
          <div className="kicker kicker--light">Operations atlas · {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h1 className="masthead__title">
            Epic Mountain
            <br />
            <span>Ops</span>
          </h1>
          <p className="masthead__sub">How the rental floor, the shop and the systems behind them fit together — one workflow at a time.</p>
          <dl className="stats">
            <div>
              <dt>Workflows</dt>
              <dd>{workflows.length}</dd>
            </div>
            <div>
              <dt>Steps mapped</dt>
              <dd>{steps}</dd>
            </div>
            <div>
              <dt>Systems</dt>
              <dd>{systems.length}</dd>
            </div>
            <div>
              <dt>Terms</dt>
              <dd>{glossary.length}</dd>
            </div>
          </dl>
          <Link to="/search" className="searchbox" aria-label="Search the atlas">
            <Icon name="search" size={18} />
            <span>Search workflows, steps, systems, terms…</span>
            <kbd>⌘K</kbd>
          </Link>
        </div>
      </section>

      <section className="section">
        <header className="section__head">
          <div>
            <div className="kicker">01 · Departments</div>
            <h2 className="section__title">The operation</h2>
          </div>
          <Link to="/departments" className="textlink">
            All departments <Icon name="chevron" size={14} />
          </Link>
        </header>
        <div className="deptgrid">
          {atlas.departments.map((d, i) => (
            <DepartmentCard key={d.id} dept={d} workflows={atlas.workflowsForDepartment(d.id)} index={i} />
          ))}
        </div>
      </section>

      <section className="section">
        <header className="section__head">
          <div>
            <div className="kicker">02 · Reference</div>
            <h2 className="section__title">Systems & language</h2>
          </div>
        </header>
        <div className="refgrid">
          <Link to="/systems" className="reftile" viewTransition>
            <div className="reftile__head">
              <Icon name="system" size={22} />
              <span className="reftile__count">{systems.length + equipment.length}</span>
            </div>
            <h3>Systems & programs</h3>
            <p>Software, programs, tools and equipment — and every workflow that touches them.</p>
            <ul className="reftile__list">
              {systems.slice(0, 3).map((s) => (
                <li key={s.id}>{s.title}</li>
              ))}
            </ul>
          </Link>
          <Link to="/glossary" className="reftile" viewTransition>
            <div className="reftile__head">
              <Icon name="book" size={22} />
              <span className="reftile__count">{glossary.length}</span>
            </div>
            <h3>Glossary</h3>
            <p>Acronyms, equipment and shop language, linked wherever they appear.</p>
            <div className="reftile__terms">
              {glossary.slice(0, 8).map((g) => (
                <span key={g.id}>{g.title}</span>
              ))}
            </div>
          </Link>
        </div>
      </section>

      <div className="split">
        <section className="section">
          <header className="section__head">
            <div>
              <div className="kicker kicker--signal">03 · Needs verification</div>
              <h2 className="section__title">Open items</h2>
            </div>
            <Link to="/review" className="textlink">
              Review queue <Icon name="chevron" size={14} />
            </Link>
          </header>
          <div className="verify-summary">
            <StatusMeter items={scored} />
          </div>
          <ul className="rowlist">
            {questions.slice(0, 3).map((q) => (
              <li key={q.id}>
                <Link to={`/review#${q.id}`} className="rowlink">
                  <Icon name="question" size={18} className="rowlink__icon rowlink__icon--signal" />
                  <span className="rowlink__main">
                    <span className="rowlink__title">{q.title}</span>
                    <span className="rowlink__sub">Open question</span>
                  </span>
                  <Icon name="chevron" size={16} />
                </Link>
              </li>
            ))}
            {attention.map((e) => (
              <li key={e.id}>
                <EntityRow e={e} />
              </li>
            ))}
          </ul>
        </section>

        <section className="section">
          <header className="section__head">
            <div>
              <div className="kicker">04 · Activity</div>
              <h2 className="section__title">Recently viewed</h2>
            </div>
          </header>
          {recent.length ? (
            <ul className="rowlist">
              {recent.map(({ r, e }) => (
                <li key={r.id}>
                  <EntityRow e={e!} meta={relTime(r.at)} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="eye" title="Nothing viewed yet">
              Workflows and entries you open will appear here.
            </EmptyState>
          )}
          <h3 className="subhead">Recently added & updated</h3>
          <ul className="rowlist">
            {recentlyAdded.map((e) => (
              <li key={e.id}>
                <EntityRow e={e} meta={relTime(e.updatedAt)} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

function DepartmentCard({ dept, workflows, index }: { dept: Department; workflows: Workflow[]; index: number }) {
  const steps = workflows.reduce((n, w) => n + w.nodes.length, 0)
  const open = workflows.filter(needsAttention).length
  return (
    <Link to={hrefFor(dept)} viewTransition className="deptcard enter" style={{ '--accent': ACCENTS[dept.accent].color, '--i': index } as React.CSSProperties}>
      <Topo seed={dept.id} className="deptcard__topo" />
      <Emblem dept={dept} size={56} className="deptcard__emblem" />
      <div className="deptcard__top">
        <span className="deptcard__code">{dept.code}</span>
        <StatusBadge status={dept.status} compact />
      </div>
      <h3 className="deptcard__title">{dept.title}</h3>
      <p className="deptcard__tag">{dept.tagline}</p>
      <dl className="deptcard__stats">
        <div>
          <dt>Workflows</dt>
          <dd>{workflows.length}</dd>
        </div>
        <div>
          <dt>Steps</dt>
          <dd>{steps}</dd>
        </div>
        <div>
          <dt>To verify</dt>
          <dd className={open ? 'is-attn' : ''}>{open}</dd>
        </div>
      </dl>
      <span className="deptcard__go" aria-hidden="true">
        <Icon name="arrowRight" size={18} />
      </span>
    </Link>
  )
}

export function EntityRow({ e, meta }: { e: Entity; meta?: string }) {
  return (
    <Link to={hrefFor(e)} className="rowlink" viewTransition>
      <Icon name={typeIcon(e.type)} size={18} className="rowlink__icon" />
      <span className="rowlink__main">
        <span className="rowlink__title">
          {e.type === 'workflow' && e.code && <span className="chip__code">{e.code}</span>}
          {e.title}
        </span>
        <span className="rowlink__sub">
          {TYPE_META[e.type].label}
          {meta ? ` · ${meta}` : ''}
        </span>
      </span>
      <StatusBadge status={e.status} compact />
    </Link>
  )
}
