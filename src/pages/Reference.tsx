import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Entity, Equipment, FlowNode, GlossaryEntry, System, Workflow } from '../../shared/types'
import { EntityActions, EntityEditor } from '../components/Editor'
import { blankEntity } from '../components/Forms'
import { Icon } from '../components/Icon'
import { ImageGallery } from '../components/Images'
import {
  EmptyState,
  Field,
  IllustrativeBanner,
  Meta,
  NodeGlyph,
  PageHeader,
  RefChips,
  RichText,
  Section,
  SourceLine,
  StatusBadge,
  typeIcon,
} from '../components/ui'
import { ACCENTS, hrefFor } from '../lib/meta'
import { useCapture, useCaptureTarget } from '../lib/capture'
import { pushRecent, useAtlas, useStore } from '../lib/store'
import { NotFound } from './NotFound'

const SYSTEM_KIND: Record<System['kind'], string> = {
  software: 'Software',
  program: 'Program',
  tool: 'Tool',
  reference: 'Reference',
  process: 'Process',
}

/* ------------------------------------------------------------------ */
/* Systems & programs directory (with Equipment tab)                  */
/* ------------------------------------------------------------------ */
export function SystemsIndex() {
  const atlas = useAtlas()
  const { canEdit, requestEdit } = useStore()
  const location = useLocation()
  const navigate = useNavigate()
  const tab = location.pathname.startsWith('/equipment') ? 'equipment' : 'systems'
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('all')
  const [creating, setCreating] = useState(false)

  const items: (System | Equipment)[] = tab === 'systems' ? atlas.list('system') : atlas.list('equipment')
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return items.filter(
      (s) =>
        (dept === 'all' || s.departmentIds.includes(dept)) &&
        (!ql || [s.title, s.summary, s.description, s.type === 'equipment' ? s.category : s.kind].join(' ').toLowerCase().includes(ql)),
    )
  }, [items, q, dept])

  return (
    <div className="page">
      <PageHeader
        kicker="Directory"
        title="Systems & programs"
        sub="Every platform, program, tool and piece of equipment encountered — and the workflows that depend on each."
        actions={
          <button className="btn btn--primary" onClick={() => (canEdit ? setCreating(true) : requestEdit())}>
            <Icon name="plus" size={16} /> New {tab === 'systems' ? 'system' : 'equipment'}
          </button>
        }
      />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'systems'} className={`tab ${tab === 'systems' ? 'is-on' : ''}`} onClick={() => navigate('/systems')}>
          Systems & programs <span>{atlas.list('system').length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'equipment'} className={`tab ${tab === 'equipment' ? 'is-on' : ''}`} onClick={() => navigate('/equipment')}>
          Equipment <span>{atlas.list('equipment').length}</span>
        </button>
      </div>
      <div className="filters">
        <input className="input" placeholder={`Search ${tab}`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${tab}`} />
        <div className="pills">
          <button className={`pill ${dept === 'all' ? 'is-on' : ''}`} onClick={() => setDept('all')}>
            All
          </button>
          {atlas.departments.map((d) => (
            <button key={d.id} className={`pill ${dept === d.id ? 'is-on' : ''}`} style={{ '--accent': ACCENTS[d.accent].color } as React.CSSProperties} onClick={() => setDept(d.id)}>
              {d.code}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon="system" title="Nothing here yet">
          {q ? 'No matches for that search.' : 'Add the first one when you encounter it.'}
        </EmptyState>
      ) : (
        <div className="dircards">
          {filtered.map((s) => {
            const used = s.type === 'system' ? atlas.workflowsForSystem(s.id) : atlas.workflowsForEquipment(s.id)
            return (
              <Link key={s.id} to={hrefFor(s)} viewTransition className="dircard">
                <div className="dircard__top">
                  <span className="dircard__kind">
                    <Icon name={typeIcon(s.type)} size={16} />
                    {s.type === 'system' ? SYSTEM_KIND[s.kind] : s.category || 'Equipment'}
                  </span>
                  <StatusBadge status={s.status} compact />
                </div>
                <div className="dircard__title">{s.title}</div>
                {s.summary && <div className="dircard__sum">{s.summary}</div>}
                <div className="dircard__foot">
                  <span>
                    {used.length} workflow{used.length === 1 ? '' : 's'}
                  </span>
                  <span>{s.departmentIds.map((d) => atlas.get(d)?.type === 'department' && (atlas.get(d) as any).code).filter(Boolean).join(' · ')}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      <EntityEditor entity={blankEntity(tab === 'systems' ? 'system' : 'equipment')} open={creating} onClose={() => setCreating(false)} isNew />
    </div>
  )
}

function UsedIn({ refs }: { refs: { workflow: Workflow; nodes: FlowNode[] }[] }) {
  if (!refs.length)
    return (
      <EmptyState icon="flow" title="Not referenced by any workflow yet">
        Link it from a workflow or an individual step and it will appear here.
      </EmptyState>
    )
  return (
    <ul className="usedin">
      {refs.map(({ workflow, nodes }) => (
        <li key={workflow.id}>
          <Link to={hrefFor(workflow)} className="usedin__wf" viewTransition>
            <span className="mono">{workflow.code}</span> {workflow.title}
            <StatusBadge status={workflow.status} compact />
          </Link>
          {nodes.length > 0 && (
            <ul className="usedin__steps">
              {nodes.map((n) => (
                <li key={n.id}>
                  <Link to={hrefFor(workflow, n.id)}>
                    <NodeGlyph kind={n.kind} size={10} /> {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}

function useTrack(e?: Entity) {
  useEffect(() => {
    if (e) pushRecent({ type: e.type, id: e.id })
  }, [e?.id])
  useCaptureTarget(e ? { type: e.type, id: e.id, label: e.title } : null)
}

export function SystemDetail() {
  const { id } = useParams()
  const atlas = useAtlas()
  const s = atlas.get<System>(id)
  useTrack(s)
  if (!s || s.type !== 'system') return <NotFound what="system" />
  const used = atlas.workflowsForSystem(s.id)
  const terms = atlas.glossaryFor('systemIds', s.id)
  const notes = atlas.notesFor('system', s.id)
  const equipment = atlas.list('equipment').filter((e) => e.systemIds?.includes(s.id))
  return (
    <div className="page page--detail">
      <PageHeader
        kicker={
          <>
            <Link to="/systems">Systems & programs</Link> / {SYSTEM_KIND[s.kind]}
          </>
        }
        title={s.title}
        sub={s.summary}
        status={s.status}
        actions={<EntityActions entity={s} />}
      />
      <IllustrativeBanner entity={s} />
      <div className="detailgrid">
        <div>
          <Section title="About" kicker="What it is">
            <Field label="Description">{s.description && <RichText text={s.description} />}</Field>
            <Field label="Purpose" placeholder="Not captured yet">
              {s.purpose && <RichText text={s.purpose} />}
            </Field>
            <Field label="When it is used" placeholder="Not captured yet">
              {s.whenUsed && <RichText text={s.whenUsed} />}
            </Field>
            <div className="io">
              <div className="io__col">
                <div className="io__label">
                  <Icon name="arrowRight" size={14} /> Goes in
                </div>
                {s.inputs.length ? (
                  <ul>
                    {s.inputs.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Not captured yet</p>
                )}
              </div>
              <div className="io__col">
                <div className="io__label">
                  Comes out <Icon name="arrowRight" size={14} />
                </div>
                {s.outputs.length ? (
                  <ul>
                    {s.outputs.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Not captured yet</p>
                )}
              </div>
            </div>
          </Section>
          <Section title={`Used in ${used.length} workflow${used.length === 1 ? '' : 's'}`} kicker="Related workflows">
            <UsedIn refs={used} />
          </Section>
          <Section title="Screenshots" kicker="Reference">
            {s.imageIds?.length ? <ImageGallery ids={s.imageIds} /> : <p className="muted">No screenshots yet. Edit this system to attach some.</p>}
          </Section>
        </div>
        <aside>
          <Section title="Departments" kicker="Used by">
            <RefChips ids={s.departmentIds} empty={<p className="muted">None linked.</p>} />
          </Section>
          {equipment.length > 0 && (
            <Section title="Related equipment" kicker="Equipment">
              <RefChips ids={equipment.map((e) => e.id)} />
            </Section>
          )}
          {terms.length > 0 && (
            <Section title="Terminology" kicker="Glossary">
              <RefChips ids={terms.map((t) => t.id)} />
            </Section>
          )}
          <NotesBox notes={notes} entity={s} />
          <Section title="Record" kicker="Provenance">
            <Meta entity={s} />
            <SourceLine entity={s} />
            {s.notes && <Field label="Notes"><RichText text={s.notes} /></Field>}
          </Section>
        </aside>
      </div>
    </div>
  )
}

export function EquipmentDetail() {
  const { id } = useParams()
  const atlas = useAtlas()
  const e = atlas.get<Equipment>(id)
  useTrack(e)
  if (!e || e.type !== 'equipment') return <NotFound what="equipment entry" />
  const used = atlas.workflowsForEquipment(e.id)
  return (
    <div className="page page--detail">
      <PageHeader
        kicker={
          <>
            <Link to="/equipment">Equipment</Link> / {e.category || 'Uncategorized'}
          </>
        }
        title={e.title}
        sub={e.summary}
        status={e.status}
        actions={<EntityActions entity={e} />}
      />
      <IllustrativeBanner entity={e} />
      <div className="detailgrid">
        <div>
          <Section title="About" kicker="Equipment">
            <Field label="Description" placeholder="Not captured yet">
              {e.description && <RichText text={e.description} />}
            </Field>
          </Section>
          <Section title={`Used in ${used.length} workflow${used.length === 1 ? '' : 's'}`} kicker="Related workflows">
            <UsedIn refs={used} />
          </Section>
          {e.imageIds?.length ? (
            <Section title="Reference images" kicker="Images">
              <ImageGallery ids={e.imageIds} />
            </Section>
          ) : null}
        </div>
        <aside>
          <Section title="Departments" kicker="Used by">
            <RefChips ids={e.departmentIds} empty={<p className="muted">None linked.</p>} />
          </Section>
          {e.systemIds?.length ? (
            <Section title="Related systems" kicker="Systems">
              <RefChips ids={e.systemIds} />
            </Section>
          ) : null}
          <NotesBox notes={atlas.notesFor('equipment', e.id)} entity={e} />
          <Section title="Record" kicker="Provenance">
            <Meta entity={e} />
            <SourceLine entity={e} />
            {e.notes && <Field label="Notes"><RichText text={e.notes} /></Field>}
          </Section>
        </aside>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Glossary                                                           */
/* ------------------------------------------------------------------ */
const GLOSS_KIND: Record<GlossaryEntry['kind'], string> = {
  acronym: 'Acronym',
  equipment: 'Equipment',
  department: 'Department language',
  software: 'Software',
  process: 'Process',
  general: 'General',
}

export function GlossaryIndex() {
  const atlas = useAtlas()
  const { canEdit, requestEdit } = useStore()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'all' | GlossaryEntry['kind']>('all')
  const [creating, setCreating] = useState(false)
  const all = atlas.list('glossary')
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return all.filter(
      (g) => (kind === 'all' || g.kind === kind) && (!ql || [g.title, ...g.aka, g.definition].join(' ').toLowerCase().includes(ql)),
    )
  }, [all, q, kind])
  const letters = useMemo(() => {
    const m = new Map<string, GlossaryEntry[]>()
    for (const g of filtered) {
      const L = /[a-z]/i.test(g.title[0]) ? g.title[0].toUpperCase() : '#'
      if (!m.has(L)) m.set(L, [])
      m.get(L)!.push(g)
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  return (
    <div className="page">
      <PageHeader
        kicker="Glossary"
        title="Operational language"
        sub="Acronyms, equipment and shop terms. Terms are linked automatically wherever they appear in the atlas."
        actions={
          <button className="btn btn--primary" onClick={() => (canEdit ? setCreating(true) : requestEdit())}>
            <Icon name="plus" size={16} /> New term
          </button>
        }
      />
      <div className="filters filters--sticky">
        <input className="input" placeholder="Search terms, acronyms, definitions" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search glossary" />
        <div className="pills">
          {(['all', ...Object.keys(GLOSS_KIND)] as const).map((k) => (
            <button key={k} className={`pill ${kind === k ? 'is-on' : ''}`} onClick={() => setKind(k as any)}>
              {k === 'all' ? 'All' : GLOSS_KIND[k as GlossaryEntry['kind']]}
            </button>
          ))}
        </div>
        <nav className="az" aria-label="Jump to letter">
          {letters.map(([L]) => (
            <a key={L} href={`#letter-${L}`}>
              {L}
            </a>
          ))}
        </nav>
      </div>
      {filtered.length === 0 && <EmptyState icon="book" title="No terms match" />}
      {letters.map(([L, items]) => (
        <section key={L} id={`letter-${L}`} className="glossgroup">
          <div className="glossgroup__letter">{L}</div>
          <ul className="glosslist">
            {items.map((g) => (
              <li key={g.id}>
                <Link to={hrefFor(g)} className="glossitem" viewTransition>
                  <span className="glossitem__term">
                    {g.title}
                    {g.aka.length > 0 && <span className="glossitem__aka">{g.aka.join(' · ')}</span>}
                  </span>
                  <span className="glossitem__def">{g.definition}</span>
                  <span className="glossitem__meta">
                    {GLOSS_KIND[g.kind]} <StatusBadge status={g.status} compact />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <EntityEditor entity={blankEntity('glossary')} open={creating} onClose={() => setCreating(false)} isNew />
    </div>
  )
}

export function GlossaryDetail() {
  const { id } = useParams()
  const atlas = useAtlas()
  const g = atlas.get<GlossaryEntry>(id)
  useTrack(g)
  const appearances = useMemo(() => {
    if (!g) return []
    const terms = [g.title, ...g.aka].filter((t) => t.length > 1)
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}\\p{N}])`, 'iu')
    const out: { workflow: Workflow; node: FlowNode }[] = []
    for (const w of atlas.list('workflow'))
      for (const n of w.nodes) if (re.test([n.label, n.what, n.why, n.info, n.considerations, n.mistakes, n.next].join(' '))) out.push({ workflow: w, node: n })
    return out
  }, [atlas, g])
  if (!g || g.type !== 'glossary') return <NotFound what="glossary term" />
  return (
    <div className="page page--detail">
      <PageHeader
        kicker={
          <>
            <Link to="/glossary">Glossary</Link> / {GLOSS_KIND[g.kind]}
          </>
        }
        title={g.title}
        sub={g.aka.length ? `Also: ${g.aka.join(', ')}` : undefined}
        status={g.status}
        actions={<EntityActions entity={g} />}
      />
      <IllustrativeBanner entity={g} />
      <div className="definition">
        <RichText text={g.definition} skipGlossaryId={g.id} />
      </div>
      <div className="detailgrid">
        <div>
          <Section title={`Appears in ${appearances.length} step${appearances.length === 1 ? '' : 's'}`} kicker="In the workflows">
            {appearances.length ? (
              <ul className="usedin__steps usedin__steps--flat">
                {appearances.map(({ workflow, node }) => (
                  <li key={workflow.id + node.id}>
                    <Link to={hrefFor(workflow, node.id)}>
                      <NodeGlyph kind={node.kind} size={10} /> <span className="mono">{workflow.code}</span> {node.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Not mentioned in any workflow step yet.</p>
            )}
          </Section>
          <Section title="Related workflows" kicker="Linked">
            <RefChips ids={g.workflowIds} empty={<p className="muted">None linked.</p>} />
          </Section>
          {g.imageIds?.length ? (
            <Section title="Images" kicker="Reference">
              <ImageGallery ids={g.imageIds} />
            </Section>
          ) : null}
        </div>
        <aside>
          <Section title="Related systems" kicker="Systems">
            <RefChips ids={g.systemIds} empty={<p className="muted">None linked.</p>} />
          </Section>
          <Section title="Departments" kicker="Used in">
            <RefChips ids={g.departmentIds} empty={<p className="muted">None linked.</p>} />
          </Section>
          <Section title="Record" kicker="Provenance">
            <Meta entity={g} />
            <SourceLine entity={g} />
            {g.notes && <Field label="Notes"><RichText text={g.notes} skipGlossaryId={g.id} /></Field>}
          </Section>
        </aside>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
export function NotesBox({ notes, entity, nodeId }: { notes: ReturnType<ReturnType<typeof useAtlas>['notesFor']>; entity: Entity; nodeId?: string }) {
  const { canEdit, requestEdit } = useStore()
  const { open } = useCapture()
  const node = nodeId && entity.type === 'workflow' ? entity.nodes.find((n) => n.id === nodeId) : undefined
  const target = { type: entity.type, id: entity.id, nodeId, label: node ? `${entity.type === 'workflow' && entity.code ? entity.code + ' › ' : ''}${node.label}` : entity.title }
  const go = (mode: 'screenshot' | 'observation' | 'question') => (canEdit ? open(mode, target) : requestEdit())
  return (
    <Section title="Questions & observations" kicker="Clarify">
      {notes.length > 0 && (
        <ul className="rowlist">
          {notes.map((n) => (
            <li key={n.id}>
              <Link className="rowlink" to={`/review#${n.id}`}>
                <Icon name={n.kind === 'question' ? 'question' : 'eye'} size={18} className={`rowlink__icon ${n.kind === 'question' && !n.resolved ? 'rowlink__icon--signal' : ''}`} />
                <span className="rowlink__main">
                  <span className="rowlink__title">{n.title}</span>
                  <span className="rowlink__sub">{n.kind === 'question' ? (n.resolved ? 'Resolved question' : 'Open question') : 'Observation'}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="quickcap" role="group" aria-label="Capture about this">
        <button className="quickcap__btn" onClick={() => go('screenshot')}>
          <Icon name="camera" size={18} /> Screenshot
        </button>
        <button className="quickcap__btn" onClick={() => go('observation')}>
          <Icon name="eye" size={18} /> Observation
        </button>
        <button className="quickcap__btn" onClick={() => go('question')}>
          <Icon name="question" size={18} /> Question
        </button>
      </div>
    </Section>
  )
}

export { ACCENTS }
