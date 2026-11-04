import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Department, Workflow } from '../../shared/types'
import { Topo } from '../components/Art'
import { EntityActions, EntityEditor } from '../components/Editor'
import { blankEntity } from '../components/Forms'
import { Icon } from '../components/Icon'
import { ImageGallery } from '../components/Images'
import { EmptyState, IllustrativeBanner, Meta, NodeGlyph, PageHeader, RefChip, RichText, Section, SourceLine, StatusBadge } from '../components/ui'
import { ACCENTS, hrefFor, needsAttention } from '../lib/meta'
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
      <ConnectionMap />
      <EntityEditor entity={blankEntity('department', { order: atlas.departments.length + 1 })} open={creating} onClose={() => setCreating(false)} isNew />
    </div>
  )
}

/** Small schematic of hand-offs between departments. */
function ConnectionMap() {
  const atlas = useAtlas()
  const depts = atlas.departments
  const links = useMemo(() => {
    const out: { from: Department; to: Department; count: number }[] = []
    for (const d of depts)
      for (const c of atlas.departmentConnections(d.id))
        if (c.direction === 'out') out.push({ from: d, to: c.department, count: c.via.length })
    return out
  }, [atlas, depts])
  if (depts.length < 2) return null
  const W = 340
  const H = 220
  const pos = new Map(
    depts.map((d, i) => {
      const a = (i / depts.length) * Math.PI * 2 - Math.PI / 2
      return [d.id, { x: W / 2 + Math.cos(a) * 110, y: H / 2 + Math.sin(a) * 75 }]
    }),
  )
  return (
    <Section kicker="Hand-offs" title="How departments connect">
      <div className="connmap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Diagram of hand-offs between departments">
          <defs>
            <marker id="cm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10z" fill="var(--paper-dim)" />
            </marker>
          </defs>
          {links.map((l, i) => {
            const a = pos.get(l.from.id)!
            const b = pos.get(l.to.id)!
            const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.18
            const my = (a.y + b.y) / 2 - (b.x - a.x) * 0.18
            const t = 0.82
            const ex = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x
            const ey = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y
            return (
              <g key={i}>
                <path d={`M${a.x} ${a.y} Q${mx} ${my} ${ex} ${ey}`} fill="none" stroke="var(--paper-dim)" strokeWidth={1 + l.count * 0.6} markerEnd="url(#cm-arrow)" opacity="0.8" />
              </g>
            )
          })}
          {depts.map((d) => {
            const p = pos.get(d.id)!
            return (
              <g key={d.id} transform={`translate(${p.x} ${p.y})`}>
                <circle r="26" fill="var(--ink-2)" stroke={ACCENTS[d.accent].color} strokeWidth="2" />
                <text textAnchor="middle" dy="4" className="connmap__code" fill={ACCENTS[d.accent].color}>
                  {d.code}
                </text>
              </g>
            )
          })}
        </svg>
        <ul className="connmap__list">
          {links.length === 0 && <li className="muted">No hand-offs mapped yet. Add “Hand-off” steps to workflows to connect departments.</li>}
          {links.map((l, i) => (
            <li key={i}>
              <b style={{ color: ACCENTS[l.from.accent].color }}>{l.from.code}</b> → <b style={{ color: ACCENTS[l.to.accent].color }}>{l.to.code}</b>
              <span className="muted"> · {l.count} hand-off{l.count > 1 ? 's' : ''}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
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

  if (!dept || dept.type !== 'department') return <NotFound />

  const workflows = atlas.workflowsForDepartment(dept.id)
  const inSections = new Set(dept.sections.flatMap((s) => s.workflowIds))
  const loose = workflows.filter((w) => !inSections.has(w.id))
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
          title={dept.title}
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

      <nav className="jumpbar" aria-label="Sections">
        {dept.sections.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            {s.title}
            <span>{s.workflowIds.length}</span>
          </a>
        ))}
        <a href="#systems">Systems</a>
        <a href="#equipment">Tools & equipment</a>
        <a href="#connections">Connections</a>
      </nav>

      <div className="hubgrid">
        <div className="hubgrid__main">
          {dept.sections.map((s, i) => (
            <section key={s.id} id={s.id} className="hubsec">
              <header className="hubsec__head">
                <span className="hubsec__num mono">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h2>{s.title}</h2>
                  {s.description && <p className="muted">{s.description}</p>}
                </div>
                <button className="iconbtn" aria-label={`Add workflow to ${s.title}`} onClick={() => (canEdit ? setNewWfFor(s.id) : requestEdit())}>
                  <Icon name="plus" size={18} />
                </button>
              </header>
              {s.workflowIds.length ? (
                <div className="wfcards">
                  {s.workflowIds.map((wid) => {
                    const w = atlas.get<Workflow>(wid)
                    return w ? <WorkflowCard key={wid} w={w} /> : null
                  })}
                </div>
              ) : (
                <EmptyState icon="flow" title="Nothing captured yet">
                  This is a placeholder for {s.title.toLowerCase()}. Add a workflow when you learn how it works.
                </EmptyState>
              )}
            </section>
          ))}
          {loose.length > 0 && (
            <section className="hubsec">
              <header className="hubsec__head">
                <span className="hubsec__num mono">··</span>
                <div>
                  <h2>Other workflows</h2>
                  <p className="muted">Involve this department but aren’t in a section yet.</p>
                </div>
              </header>
              <div className="wfcards">
                {loose.map((w) => (
                  <WorkflowCard key={w.id} w={w} />
                ))}
              </div>
            </section>
          )}
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

export function WorkflowCard({ w }: { w: Workflow }) {
  const atlas = useAtlas()
  const counts = w.nodes.reduce<Record<string, number>>((acc, n) => ((acc[n.kind] = (acc[n.kind] || 0) + 1), acc), {})
  const depts = atlas.departmentsForWorkflow(w)
  return (
    <Link to={hrefFor(w)} viewTransition className={`wfcard ${needsAttention(w) ? 'wfcard--attention' : ''}`}>
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
