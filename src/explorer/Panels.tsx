import { Link, useNavigate } from 'react-router-dom'
import type { EdgeKind, FlowEdge, FlowNode, NodeKind, Workflow } from '../../shared/types'
import { FormFields, NODE_SCHEMA } from '../components/Forms'
import { Icon } from '../components/Icon'
import { ImageGallery } from '../components/Images'
import { Field, IllustrativeBanner, NodeGlyph, RefChip, RefChips, RichText, SourceLine, StatusBadge } from '../components/ui'
import { ACCENTS, fmtDate, hrefFor, NODE_META } from '../lib/meta'
import { useAtlas } from '../lib/store'
import { NotesBox } from '../pages/Reference'
import type { CameFrom } from './Explorer'
import { stepGaps, systemsInWorkflow } from './routing'
import { DoKnowCheck } from './StepContent'

const NOT_CAPTURED: [keyof FlowNode, string][] = [
  ['what', 'What happens'],
  ['why', 'Why'],
  ['who', 'Who'],
  ['info', 'Information required'],
  ['mistakes', 'Common mistakes'],
  ['considerations', 'Considerations'],
]

export const QUICK_LABELS = ['Yes', 'No', 'Pass', 'Fail', 'Walk-in', 'Reservation', 'Try again']

export function NodeDetail({
  wf,
  node,
  onSelect,
  onEdit,
  from,
}: {
  wf: Workflow
  node: FlowNode
  onSelect: (id: string) => void
  onEdit?: () => void
  from?: CameFrom
}) {
  const atlas = useAtlas()
  const navigate = useNavigate()
  const outgoing = wf.edges.filter((e) => e.source === node.id)
  const incoming = wf.edges.filter((e) => e.target === node.id)
  const byId = new Map(wf.nodes.map((n) => [n.id, n]))
  const target = node.kind === 'link' ? atlas.get<Workflow>(node.linkWorkflowId) : undefined
  const targetDept = target ? atlas.get(target.departmentIds[0]) : undefined
  const missing = node.kind === 'start' || node.kind === 'end' || node.kind === 'parallel' ? [] : NOT_CAPTURED.filter(([k]) => !node[k])
  const notes = atlas.notesFor('workflow', wf.id, node.id)
  return (
    <div className="nodedetail">
      {(node.kind === 'warning' || node.kind === 'unknown') && (
        <div className={`banner banner--${node.kind === 'warning' ? 'warning' : 'unknown'}`} role="note">
          <Icon name={node.kind === 'warning' ? 'warning' : 'question'} size={18} />
          <div>
            <b>{node.kind === 'warning' ? 'Important reminder.' : 'Unknown step.'}</b>{' '}
            {node.kind === 'warning' ? 'Read before continuing.' : 'This is a gap in the map — capture it from an authorized source.'}
          </div>
        </div>
      )}

      {node.critical && node.kind !== 'warning' && (
        <div className="banner banner--warning" role="note">
          <Icon name="warning" size={18} />
          <div>
            <b>Safety-critical step.</b> Follow current approved procedures only — this atlas is not that reference.
          </div>
        </div>
      )}
      {node.phase && <div className="nodedetail__stage mono">Stage · {node.phase}</div>}

      {target && (
        <button
          className="handoff"
          style={{ '--accent': targetDept?.type === 'department' ? ACCENTS[targetDept.accent].color : 'var(--glacier)' } as React.CSSProperties}
          onClick={() => navigate(hrefFor(target), { viewTransition: true, state: { from } })}
        >
          <span className="handoff__kicker">Continues in {targetDept?.type === 'department' ? targetDept.title : 'another workflow'}</span>
          <span className="handoff__title">
            <span className="mono">{target.code}</span> {target.title}
          </span>
          <span className="handoff__dept">{target.summary}</span>
          <Icon name="arrowRight" size={20} />
        </button>
      )}
      {node.kind === 'link' && !target && <p className="error-text">The workflow this hands off to hasn’t been chosen, or was deleted.</p>}

      <DoKnowCheck node={node} wf={wf} />

      <div className="field">
        <div className="field__label">What happens next</div>
        <div className="field__value">
          {node.next && <RichText text={node.next} />}
          {outgoing.length ? (
            <div className="nextlist">
              {outgoing.map((e) => {
                const t = byId.get(e.target)
                if (!t) return null
                return (
                  <button key={e.id} className={`nextbtn nextbtn--${e.kind || 'normal'}`} onClick={() => onSelect(t.id)}>
                    {e.label && <span className="nextbtn__label">{e.label}</span>}
                    <NodeGlyph kind={t.kind} size={12} />
                    <span className="nextbtn__title">{t.label}</span>
                    <Icon name="chevron" size={16} />
                  </button>
                )
              })}
            </div>
          ) : (
            !node.next && (
              <span className="muted">{node.kind === 'end' ? 'This is where the workflow finishes.' : node.kind === 'link' ? 'Continues in the linked workflow.' : 'Nothing connected yet.'}</span>
            )
          )}
        </div>
      </div>

      {node.relatedWorkflowIds?.length ? (
        <Field label="Related workflows">
          <RefChips ids={node.relatedWorkflowIds} />
        </Field>
      ) : null}
      {node.imageIds?.length ? (
        <Field label="Reference screenshots">
          <ImageGallery ids={node.imageIds} />
        </Field>
      ) : null}

      {incoming.length > 0 && (
        <div className="field">
          <div className="field__label">Comes from</div>
          <div className="nextlist">
            {incoming.map((e) => {
              const s = byId.get(e.source)
              if (!s) return null
              return (
                <button key={e.id} className="nextbtn nextbtn--prev" onClick={() => onSelect(s.id)}>
                  <Icon name="back" size={16} />
                  <NodeGlyph kind={s.kind} size={12} />
                  <span className="nextbtn__title">{s.label}</span>
                  {e.label && <span className="nextbtn__label">{e.label}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <div className="gaps">
          <span className="gaps__label">Not captured yet</span>
          {missing.map(([, l]) => (
            <span key={l} className="gaps__item">
              {l}
            </span>
          ))}
          {onEdit && (
            <button className="btn btn--ghost btn--small" onClick={onEdit}>
              <Icon name="edit" size={14} /> Fill in
            </button>
          )}
        </div>
      )}

      <NotesBox notes={notes} entity={wf} nodeId={node.id} />
    </div>
  )
}

const KINDS: NodeKind[] = ['step', 'decision', 'warning', 'unknown', 'link', 'parallel', 'start', 'end']
const ESSENTIAL = new Set(['label', 'linkWorkflowId', 'embed', 'status', 'what'])

export function NodeEditor({
  wf,
  node,
  onChange,
  onDelete,
  onConnect,
  onEdgeChange,
  onEdgeDelete,
  onAddNext,
  onDuplicate,
}: {
  wf: Workflow
  node: FlowNode
  onChange: (patch: Partial<FlowNode>, group?: string) => void
  onDelete: () => void
  onConnect: (targetId: string, kind?: EdgeKind, label?: string) => void
  onEdgeChange: (id: string, patch: Partial<FlowEdge>, group?: string) => void
  onEdgeDelete: (id: string) => void
  onAddNext: (kind: NodeKind) => void
  onDuplicate: () => void
}) {
  const outgoing = wf.edges.filter((e) => e.source === node.id)
  const byId = new Map(wf.nodes.map((n) => [n.id, n]))
  const candidates = wf.nodes.filter((n) => n.id !== node.id && !outgoing.some((e) => e.target === n.id))
  const essentials = NODE_SCHEMA.filter((f) => f.key && ESSENTIAL.has(f.key) && f.key !== 'kind')
  const details = NODE_SCHEMA.filter((f) => f.key && !ESSENTIAL.has(f.key) && f.key !== 'kind')
  const filled = details.filter((f) => {
    const v = (node as any)[f.key!]
    return Array.isArray(v) ? v.length : Boolean(v)
  }).length
  const change = (p: Record<string, any>) => onChange(p as Partial<FlowNode>, `node:${node.id}:${Object.keys(p)[0]}`)

  return (
    <div className="nodeeditor">
      <div className="fi">
        <span className="fi__label">Shape</span>
        <div className="kindpick" role="radiogroup" aria-label="Step shape">
          {KINDS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={node.kind === k} className={`kindpick__opt ${node.kind === k ? 'is-on' : ''}`} onClick={() => onChange({ kind: k })}>
              <NodeGlyph kind={k} size={14} />
              <span>{NODE_META[k].label}</span>
            </button>
          ))}
        </div>
      </div>
      <FormFields schema={essentials} value={node as any} onChange={change} hide={node.kind === 'link' ? [] : ['linkWorkflowId', 'embed']} />

      <details className="more" open={filled > 0}>
        <summary>
          More detail <span className="mono muted">{filled}/{details.length} filled</span>
        </summary>
        <FormFields schema={details} value={node as any} onChange={change} />
      </details>

      <h3 className="form__heading">Connections out</h3>
      <ul className="edgelist">
        {outgoing.map((e) => (
          <li key={e.id} className="edgelist__item">
            <div className="edgelist__to">
              → <b>{byId.get(e.target)?.label ?? 'missing'}</b>
            </div>
            <div className="quicklabels" role="group" aria-label="Quick labels">
              {QUICK_LABELS.slice(0, 4).map((q) => (
                <button
                  key={q}
                  type="button"
                  className={`qchip ${e.label === q ? 'is-on' : ''}`}
                  onClick={() => onEdgeChange(e.id, { label: e.label === q ? '' : q, kind: q === 'Yes' || q === 'Pass' ? 'yes' : q === 'No' || q === 'Fail' ? 'no' : e.kind })}
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="row gap-s">
              <input
                className="input input--compact"
                placeholder="Custom label"
                value={e.label || ''}
                onChange={(ev) => onEdgeChange(e.id, { label: ev.target.value }, `edge:${e.id}:label`)}
                aria-label="Connection label"
              />
              <button className="iconbtn" onClick={() => onEdgeDelete(e.id)} aria-label="Remove connection">
                <Icon name="trash" size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {candidates.length > 0 && (
        <select className="input" value="" onChange={(e) => e.target.value && onConnect(e.target.value)} aria-label="Connect to another step">
          <option value="">+ Connect to an existing step…</option>
          {candidates.map((n) => (
            <option key={n.id} value={n.id}>
              {NODE_META[n.kind].label}: {n.label}
            </option>
          ))}
        </select>
      )}

      <div className="editor-actions">
        <button className="btn btn--ghost" onClick={() => onAddNext('step')}>
          <Icon name="plus" size={16} /> Next step
        </button>
        <button className="btn btn--ghost" onClick={() => onAddNext('decision')}>
          <Icon name="plus" size={16} /> Decision
        </button>
        <button className="btn btn--ghost" onClick={onDuplicate}>
          <Icon name="layers" size={16} /> Duplicate
        </button>
      </div>
      <button className="btn btn--danger-ghost btn--block" onClick={onDelete}>
        <Icon name="trash" size={16} /> Delete this step
      </button>
    </div>
  )
}

export function EdgeEditor({
  wf,
  edge,
  onChange,
  onDelete,
  onInsert,
}: {
  wf: Workflow
  edge: FlowEdge
  onChange: (p: Partial<FlowEdge>, group?: string) => void
  onDelete: () => void
  onInsert: (kind: NodeKind) => void
}) {
  const s = wf.nodes.find((n) => n.id === edge.source)
  const t = wf.nodes.find((n) => n.id === edge.target)
  return (
    <div className="form">
      <p className="edgeroute">
        <NodeGlyph kind={s?.kind || 'step'} size={12} /> <b>{s?.label}</b>
        <Icon name="arrowRight" size={16} />
        <NodeGlyph kind={t?.kind || 'step'} size={12} /> <b>{t?.label}</b>
      </p>
      <div className="editor-actions">
        <button className="btn btn--primary" onClick={() => onInsert('step')}>
          <Icon name="plus" size={16} /> Insert step here
        </button>
        <button className="btn btn--ghost" onClick={() => onInsert('decision')}>
          Insert decision
        </button>
      </div>
      <div className="fi">
        <span className="fi__label">Label</span>
        <div className="quicklabels">
          {QUICK_LABELS.map((q) => (
            <button
              key={q}
              type="button"
              className={`qchip ${edge.label === q ? 'is-on' : ''}`}
              onClick={() => onChange({ label: edge.label === q ? '' : q, kind: q === 'Yes' || q === 'Pass' ? 'yes' : q === 'No' || q === 'Fail' ? 'no' : q === 'Try again' ? 'loop' : edge.kind })}
            >
              {q}
            </button>
          ))}
        </div>
        <input className="input" value={edge.label || ''} onChange={(e) => onChange({ label: e.target.value }, `edge:${edge.id}:label`)} placeholder="Or type a label" aria-label="Connection label" />
      </div>
      <div className="fi">
        <span className="fi__label">Type</span>
        <div className="seg" role="radiogroup" aria-label="Connection type">
          {(
            [
              ['normal', 'Normal'],
              ['yes', 'Yes / pass'],
              ['no', 'No / fail'],
              ['branch', 'Parallel'],
              ['loop', 'Loop back'],
            ] as [EdgeKind, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={(edge.kind || 'normal') === k} className={`seg__opt edgekind--${k} ${(edge.kind || 'normal') === k ? 'is-on' : ''}`} onClick={() => onChange({ kind: k })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <button className="btn btn--danger-ghost btn--block" onClick={onDelete}>
        <Icon name="trash" size={16} /> Remove connection
      </button>
    </div>
  )
}

export function WorkflowInfo({ wf, onSelect }: { wf: Workflow; onSelect: (id: string) => void }) {
  const atlas = useAtlas()
  const inbound = atlas.inboundLinks(wf.id)
  const outbound = wf.nodes.filter((n) => n.kind === 'link' && n.linkWorkflowId)
  const counts = wf.nodes.reduce<Record<string, number>>((a, n) => ((a[n.kind] = (a[n.kind] || 0) + 1), a), {})
  const usedInSteps = systemsInWorkflow(wf).filter((s) => s.count > 0)
  const flagged = wf.nodes.filter((n) => n.kind === 'unknown' || n.status === 'unverified' || n.status === 'outdated' || stepGaps(n).length)
  const reviewedSteps = wf.nodes.filter((n) => n.status && n.status !== 'unverified').length
  const source = wf.sourceIds?.map((id) => atlas.get(id)?.title).filter(Boolean).join(', ')

  return (
    <div className="wfinfo">
      <IllustrativeBanner entity={wf} />

      <dl className="doccontrol" aria-label="Document control">
        <div>
          <dt>Document</dt>
          <dd className="mono">{wf.code || '—'}</dd>
        </div>
        <div>
          <dt>Revision</dt>
          <dd className="mono">Rev {wf.rev ?? 1}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <StatusBadge status={wf.status} compact />
          </dd>
        </div>
        <div>
          <dt>Last verified</dt>
          <dd>{wf.lastVerifiedAt ? fmtDate(wf.lastVerifiedAt) : 'Never'}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{fmtDate(wf.updatedAt)}</dd>
        </div>
        <div>
          <dt>Steps reviewed</dt>
          <dd className="mono">
            {reviewedSteps}/{wf.nodes.length}
          </dd>
        </div>
        {source && (
          <div className="doccontrol__wide">
            <dt>Source</dt>
            <dd>{source}</dd>
          </div>
        )}
      </dl>

      {wf.summary && (
        <div className="lede lede--small">
          <RichText text={wf.summary} />
        </div>
      )}
      <div className="io io--tight">
        <div className="io__col">
          <div className="io__label">Starts when</div>
          <p>{wf.trigger || <span className="muted">Not captured</span>}</p>
        </div>
        <div className="io__col">
          <div className="io__label">Finished when</div>
          <p>{wf.outcome || <span className="muted">Not captured</span>}</p>
        </div>
      </div>

      <div className="glance" aria-label="At a glance">
        {(['step', 'decision', 'warning', 'unknown', 'link'] as NodeKind[]).map((k) => (
          <div key={k} className={`glance__item glance--${k}`}>
            <NodeGlyph kind={k} size={12} />
            <b>{counts[k] || 0}</b>
            <span>{NODE_META[k].label}</span>
          </div>
        ))}
      </div>

      <Field label="Departments">
        <RefChips ids={wf.departmentIds} />
      </Field>
      {usedInSteps.length > 0 && (
        <Field label="Systems & equipment used in steps">
          <div className="chips">
            {usedInSteps.map((s) => (
              <span key={s.id} className="chipcount">
                <RefChip id={s.id} />
                <span className="mono muted">×{s.count}</span>
              </span>
            ))}
          </div>
        </Field>
      )}
      {inbound.length > 0 && (
        <Field label="Arrives from">
          <div className="nextlist">
            {inbound.map((r) => (
              <Link key={r.workflow.id + r.node.id} className="nextbtn nextbtn--prev" to={hrefFor(r.workflow, r.node.id)} viewTransition>
                <Icon name="back" size={16} />
                <span className="nextbtn__title">
                  <span className="mono">{r.workflow.code}</span> {r.workflow.title}
                </span>
              </Link>
            ))}
          </div>
        </Field>
      )}
      {outbound.length > 0 && (
        <Field label="Hands off to">
          <div className="chips">
            {outbound.map((n) => (
              <RefChip key={n.id} id={n.linkWorkflowId!} />
            ))}
          </div>
        </Field>
      )}

      {flagged.length > 0 && (
        <div className="field">
          <div className="field__label">Needs attention ({flagged.length})</div>
          <div className="nextlist">
            {flagged.map((n) => {
              const g = stepGaps(n)
              return (
                <button key={n.id} className="nextbtn" onClick={() => onSelect(n.id)}>
                  <NodeGlyph kind={n.kind} size={12} />
                  <span className="nextbtn__title">
                    {n.label}
                    {g.length > 0 && n.kind !== 'unknown' && <small className="nextbtn__sub">Missing {g.join(', ')}</small>}
                  </span>
                  {n.status && <StatusBadge status={n.status} compact />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="field">
        <div className="field__label">Legend</div>
        <ul className="legend">
          {(['start', 'step', 'decision', 'warning', 'parallel', 'link', 'unknown', 'end'] as const).map((k) => (
            <li key={k}>
              <NodeGlyph kind={k} size={14} />
              <span>
                <b>{NODE_META[k].label}</b> {NODE_META[k].help}
              </span>
              <span className="muted mono">{counts[k] || 0}</span>
            </li>
          ))}
        </ul>
      </div>

      <SourceLine entity={wf} />
      {wf.notes && (
        <Field label="Notes">
          <RichText text={wf.notes} />
        </Field>
      )}
      {wf.imageIds?.length ? (
        <Field label="Reference images">
          <ImageGallery ids={wf.imageIds} />
        </Field>
      ) : null}
      <NotesBox notes={atlas.notesFor('workflow', wf.id).filter((n) => !n.links.some((l) => l.id === wf.id && l.nodeId))} entity={wf} />
    </div>
  )
}
