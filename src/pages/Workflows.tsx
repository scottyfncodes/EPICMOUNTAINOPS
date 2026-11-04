import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Workflow } from '../../shared/types'
import { EntityEditor } from '../components/Editor'
import { blankEntity } from '../components/Forms'
import { Icon } from '../components/Icon'
import { EmptyState, PageHeader } from '../components/ui'
import { ACCENTS } from '../lib/meta'
import { useAtlas, useStore } from '../lib/store'
import { WorkflowCard } from './Departments'

export function WorkflowsIndex() {
  const atlas = useAtlas()
  const { canEdit, requestEdit } = useStore()
  const [params, setParams] = useSearchParams()
  const dept = params.get('dept') || 'all'
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const all = atlas.list('workflow')

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return all.filter(
      (w) =>
        (dept === 'all' || w.departmentIds.includes(dept)) &&
        (!ql || w.title.toLowerCase().includes(ql) || (w.code || '').toLowerCase().includes(ql) || (w.summary || '').toLowerCase().includes(ql)),
    )
  }, [all, dept, q])

  const groups = atlas.departments
    .map((d) => ({ d, items: filtered.filter((w) => w.departmentIds[0] === d.id) }))
    .filter((g) => g.items.length)
  const orphans = filtered.filter((w) => !w.departmentIds.length || !atlas.get(w.departmentIds[0]))

  return (
    <div className="page">
      <PageHeader
        kicker="Workflow explorer"
        title="Every workflow"
        sub="Open any workflow to explore it as an interactive map. Pinch or scroll to zoom, drag to pan, tap a step for the details."
        actions={
          <button className="btn btn--primary" onClick={() => (canEdit ? setCreating(true) : requestEdit())}>
            <Icon name="plus" size={16} /> New workflow
          </button>
        }
      />
      <div className="filters">
        <input className="input" placeholder="Filter workflows" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter workflows" />
        <div className="pills" role="tablist" aria-label="Department filter">
          <button role="tab" aria-selected={dept === 'all'} className={`pill ${dept === 'all' ? 'is-on' : ''}`} onClick={() => setParams({})}>
            All <span>{all.length}</span>
          </button>
          {atlas.departments.map((d) => (
            <button
              key={d.id}
              role="tab"
              aria-selected={dept === d.id}
              className={`pill ${dept === d.id ? 'is-on' : ''}`}
              style={{ '--accent': ACCENTS[d.accent].color } as React.CSSProperties}
              onClick={() => setParams({ dept: d.id })}
            >
              {d.code} <span>{all.filter((w) => w.departmentIds.includes(d.id)).length}</span>
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 && (
        <EmptyState icon="flow" title="No workflows match">
          Try a different filter, or add a new workflow.
        </EmptyState>
      )}
      {groups.map(({ d, items }) => (
        <section key={d.id} className="section" style={{ '--accent': ACCENTS[d.accent].color } as React.CSSProperties}>
          <header className="section__head">
            <div>
              <div className="kicker kicker--accent">{d.code}</div>
              <h2 className="section__title">{d.title}</h2>
            </div>
          </header>
          <div className="wfcards wfcards--grid">
            {items.map((w) => (
              <WorkflowCard key={w.id} w={w} />
            ))}
          </div>
        </section>
      ))}
      {orphans.length > 0 && (
        <section className="section">
          <header className="section__head">
            <h2 className="section__title">Unassigned</h2>
          </header>
          <div className="wfcards wfcards--grid">
            {orphans.map((w) => (
              <WorkflowCard key={w.id} w={w} />
            ))}
          </div>
        </section>
      )}
      <EntityEditor
        entity={blankEntity('workflow', (dept !== 'all' ? { departmentIds: [dept] } : {}) as Partial<Workflow>)}
        open={creating}
        onClose={() => setCreating(false)}
        isNew
      />
    </div>
  )
}
