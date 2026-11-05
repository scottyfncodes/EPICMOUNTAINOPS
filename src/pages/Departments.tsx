import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Department, Workflow } from '../../shared/types'
import { Topo } from '../components/Art'
import { EntityActions, EntityEditor } from '../components/Editor'
import { blankEntity } from '../components/Forms'
import { Icon } from '../components/Icon'
import { ImageGallery } from '../components/Images'
import { RouteMap } from '../components/RouteMap'
import { Emblem, IllustrativeBanner, Meta, NodeGlyph, PageHeader, RefChip, RichText, Section, SourceLine, StatusBadge } from '../components/ui'
import { ACCENTS, hrefFor, needsAttention } from '../lib/meta'
import { useCaptureTarget } from '../lib/capture'
import { pushRecent, useAtlas, useStore } from '../lib/store'
import { NotFound } from './NotFound'

export function DepartmentsIndex() {
  const atlas = useAtlas()
  const { canEdit, requestEdit } = useStore()
  const [creating, setCreating] = useState(false)
  return (
    <div className="page">
      <PageHeader
        kicker="Departments"
        title="The operation, by department"
        sub="Each department hub groups its workflows, systems, equipment and the hand-offs it shares with other teams."
        actions={
          <button className="btn btn--ghost" onClick={() => (canEdit ? setCreating(true) : requestEdit())}>
            <Icon name="plus" size={16} /> New department
          </button>
        }
      />
      <div className="deptlist">
        {atlas.departments.map((d) => {
          const wfs = atlas.workflowsForDepartment(d.id)
          const conns = atlas.departmentConnections(d.id)
          return (
            <Link key={d.id} to={hrefFor(d)} viewTransition className="deptrow" style={{ '--accent': ACCENTS[d.accent].color } as React.CSSProperties}>
              <Topo seed={d.id} className="deptrow__topo" lines={7} />
              <Emblem dept={d} size={40} className="deptrow__emblem" />
              <span className="deptrow__code">{d.code}</span>
              <span className="deptrow__main">
                <span className="deptrow__title">{d.title}</span>
                <span className="deptrow__tag">{d.tagline}</span>
                <span className="deptrow__meta">
                  {wfs.length} workflows · {d.sections.length} sections
                  {conns.length > 0 && ` · connects to ${[...new Set(conns.map((c) => c.department.code))].join(', ')}`}
                </span>
              </span>
              <Icon name="chevron" />
            </Link>
          )
        })}
      </div>
      <Section kicker="Hand-offs" title="How the departments connect">
        <RouteMap />
      </Section>
      <EntityEditor entity={blankEntity('department', { order: atlas.departments.length + 1 })} open={creating} onClose={() => setCreating(false)} isNew />
    </div>
  )
}

export function DepartmentHub() {
  const { id } = useParams()
  const atlas = useAtlas()
  const { canEdit, requestEdit, save } = useStore()
  const dept = atlas.get<Department>(id)
  const [newWfFor, setNewWfFor] = useState<string | null>(null)

  useEffect(() => {
    if (dept) pushRecent({ type: 'department', id: dept.id })
  }, [dept?.id])
  useCaptureTarget(dept ? { type: 'department', id: dept.id, label: dept.title } : null)

  if (!dept || dept.type !== 'department') return <NotFound />

  const workflows = atlas.workflowsForDepartment(dept.id)
  const inSections = new Set(dept.sections.flatMap((s) => s.workflowIds))
  const loose = workflows.filter((w) => !inSections.has(w.id))
  const guests = workflows.filter((w) => w.departmentIds[0] !== dept.id)
  const systemIds = [...new Set([...(dept.systemIds || []), ...workflows.flatMap((w) => [...w.systemIds, ...w.nodes.flatMap((n) => n.systemIds || [])])])]
  const equipmentIds = [...new Set([...(dept.equipmentIds || []), ...workflows.flatMap((w) => w.equipmentIds)])].filter((eid) => {
    const e = atlas.get(eid)
    return e && e.type === 'equipment' && (e.departmentIds.includes(dept.id) || dept.equipmentIds?.includes(eid))
  })
  const conns = atlas.departmentConnections(dept.id)
  const terms = atlas.glossaryFor('departmentIds', dept.id)
  const questions = atlas.notesFor('department', dept.id)
  const accent = ACCENTS[dept.accent].color

  return (
    <div className="page page--dept" style={{ '--accent': accent } as React.CSSProperties}>
      <div className="depthead">
        <Topo seed={dept.id} className="depthead__topo" lines={11} />
        <PageHeader
          kicker={
            <>
              <Link to="/departments">Departments</Link> / <span className="mono">{dept.code}</span>
            </>
          }
          title={
            <span className="titlewithemblem">
              {dept.title}
              <Emblem dept={dept} size={52} className="depthead__emblem" />
            </span>
          }
          sub={dept.tagline}
          accent={dept.accent}
          status={dept.status}
          actions={<EntityActions entity={dept} />}
        />
      </div>
      <IllustrativeBanner entity={dept} />
      {dept.description && (
        <div className="lede">
          <RichText text={dept.description} />
        </div>
      )}

      <nav className="jumpbar" aria-label="On this page">
        <a href="#route">Route</a>
        <a href="#topics">
          Topics <span>{dept.sections.length}</span>
        </a>
        <a href="#systems">Systems</a>
        <a href="#equipment">Tools & equipment</a>
        <a href="#connections">Connections</a>
      </nav>

      <div className="hubgrid">
        <div className="hubgrid__main">
          <section id="route" className="hubsec">
            <header className="hubsec__head">
              <span className="hubsec__num mono">01</span>
              <div>
                <h2>How work flows through {dept.title}</h2>
                <p className="muted">Every workflow, in order, following its hand-off steps. Gaps show where no hand-off is mapped yet.</p>
              </div>
            </header>
            <RouteMap departmentId={dept.id} />
            {guests.length > 0 && (
              <div className="guests">
                <div className="kicker">Also involves {dept.code}</div>
                <ul className="topic__links">
                  {guests.map((w) => (
                    <li key={w.id}>
                      <Link to={hrefFor(w)} className="tlink" viewTransition>
                        <span className="mono">{w.code}</span> {w.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section id="topics" className="hubsec">
            <header className="hubsec__head">
              <span className="hubsec__num mono">02</span>
              <div>
                <h2>By topic</h2>
                <p className="muted">Your categories for this department. A workflow can sit under more than one.</p>
              </div>
            </header>
            <ul className="topics">
              {dept.sections.map((s, i) => (
                <li key={s.id} id={s.id} className="topic">
                  <div className="topic__head">
                    <span className="topic__num mono">{String(i + 1).padStart(2, '0')}</span>
                    <b>{s.title}</b>
                    <button className="iconbtn" aria-label={`Add workflow to ${s.title}`} onClick={() => (canEdit ? setNewWfFor(s.id) : requestEdit())}>
                      <Icon name="plus" size={18} />
                    </button>
                  </div>
                  {s.description && <p className="topic__desc">{s.description}</p>}
                  {s.workflowIds.length ? (
                    <ul className="topic__links">
                      {s.workflowIds.map((wid) => {
                        const w = atlas.get<Workflow>(wid)
                        return w ? (
                          <li key={wid}>
                            <Link to={hrefFor(w)} className="tlink" viewTransition>
                              <span className="mono">{w.code}</span> {w.title}
                            </Link>
                          </li>
                        ) : null
                      })}
                    </ul>
                  ) : (
                    <p className="topic__empty">Nothing captured yet — tap + when you learn how this works.</p>
                  )}
                </li>
              ))}
              {loose.length > 0 && (
                <li className="topic">
                  <div className="topic__head">
                    <span className="topic__num mono">··</span>
                    <b>Not in a topic yet</b>
                  </div>
                  <ul className="topic__links">
                    {loose.map((w) => (
                      <li key={w.id}>
                        <Link to={hrefFor(w)} className="tlink" viewTransition>
                          <span className="mono">{w.code}</span> {w.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              )}
            </ul>
          </section>
        </div>

        <aside className="hubgrid__side">
          <Section title="Responsibilities" kicker="Role">
            {dept.responsibilities.length ? (
              <ul className="ticklist">
                {dept.responsibilities.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Not captured yet.</p>
            )}
          </Section>
          <Section title="Systems & programs" kicker="Relevant systems" id="systems">
            {systemIds.length ? (
              <div className="chips chips--stack">
                {systemIds.map((sid) => (
                  <RefChip key={sid} id={sid} />
                ))}
              </div>
            ) : (
              <p className="muted">None linked yet.</p>
            )}
          </Section>
          <Section title="Tools & equipment" kicker="Equipment" id="equipment">
            {equipmentIds.length ? (
              <div className="chips">
                {equipmentIds.map((eid) => (
                  <RefChip key={eid} id={eid} />
                ))}
              </div>
            ) : (
              <p className="muted">None linked yet.</p>
            )}
          </Section>
          <Section title="Connections" kicker="Other departments" id="connections">
            {conns.length ? (
              <ul className="connlist">
                {conns.map((c, i) => (
                  <li key={i}>
                    <div className="connlist__head">
                      <span className="mono">{c.direction === 'out' ? 'Hands off to' : 'Receives from'}</span>
                      <RefChip id={c.department.id} />
                    </div>
                    <ul>
                      {c.via.map((v, k) => (
                        <li key={k}>
                          <Link to={hrefFor(v.workflow, v.node.id)}>
                            {v.workflow.code} › {v.node.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No hand-offs mapped yet.</p>
            )}
          </Section>
          {terms.length > 0 && (
            <Section title="Department language" kicker="Glossary">
              <div className="chips">
                {terms.map((t) => (
                  <RefChip key={t.id} id={t.id} />
                ))}
              </div>
            </Section>
          )}
          {questions.length > 0 && (
            <Section title="Open questions" kicker="Clarify">
              <ul className="rowlist">
                {questions.map((q) => (
                  <li key={q.id}>
                    <Link className="rowlink" to={`/review#${q.id}`}>
                      <Icon name="question" size={18} className="rowlink__icon rowlink__icon--signal" />
                      <span className="rowlink__main">
                        <span className="rowlink__title">{q.title}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Record" kicker="Provenance">
            <Meta entity={dept} />
            <SourceLine entity={dept} />
            {dept.notes && <RichText text={dept.notes} />}
            <ImageGallery ids={dept.imageIds} />
          </Section>
        </aside>
      </div>

      {newWfFor && (
        <EntityEditor
          entity={blankEntity('workflow', { departmentIds: [dept.id] } as Partial<Workflow>)}
          open
          isNew
          onClose={() => setNewWfFor(null)}
          onSaved={async (w) => {
            const sections = dept.sections.map((s) => (s.id === newWfFor ? { ...s, workflowIds: [...s.workflowIds, w.id] } : s))
            await save({ ...dept, sections }, { quiet: true, note: `Added workflow “${w.title}”` })
          }}
        />
      )}
    </div>
  )
}

export function WorkflowCard({ w, index = 0 }: { w: Workflow; index?: number }) {
  const atlas = useAtlas()
  const counts = w.nodes.reduce<Record<string, number>>((acc, n) => ((acc[n.kind] = (acc[n.kind] || 0) + 1), acc), {})
  const depts = atlas.departmentsForWorkflow(w)
  return (
    <Link to={hrefFor(w)} viewTransition className={`wfcard enter ${needsAttention(w) ? 'wfcard--attention' : ''}`} style={{ '--i': Math.min(index, 8) } as React.CSSProperties}>
      <div className="wfcard__top">
        <span className="mono wfcard__code">{w.code || 'WF'}</span>
        <StatusBadge status={w.status} compact />
      </div>
      <div className="wfcard__title">{w.title}</div>
      {w.summary && <div className="wfcard__sum">{w.summary}</div>}
      <div className="wfcard__strip" aria-label={`${w.nodes.length} steps`}>
        {w.nodes.slice(0, 14).map((n) => (
          <NodeGlyph key={n.id} kind={n.kind} size={10} />
        ))}
        {w.nodes.length > 14 && <span className="muted">+{w.nodes.length - 14}</span>}
      </div>
      <div className="wfcard__foot">
        <span>{w.nodes.length} steps</span>
        {counts.decision ? <span>{counts.decision} decisions</span> : null}
        {counts.unknown ? <span className="is-attn">{counts.unknown} unknown</span> : null}
        {depts.length > 1 && <span>{depts.map((d) => d.code).join(' · ')}</span>}
      </div>
    </Link>
  )
}
