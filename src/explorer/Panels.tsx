import { Link, useNavigate } from 'react-router-dom'
import type { EdgeKind, FlowEdge, FlowNode, Workflow } from '../../shared/types'
import { FormFields, NODE_SCHEMA } from '../components/Forms'
import { Icon } from '../components/Icon'
import { ImageGallery } from '../components/Images'
import { Field, IllustrativeBanner, Meta, NodeGlyph, RefChip, RefChips, RichText, SourceLine, StatusBadge } from '../components/ui'
import { ACCENTS, hrefFor, NODE_META } from '../lib/meta'
import { useAtlas } from '../lib/store'
import { NotesBox } from '../pages/Reference'

const NOT_CAPTURED: [keyof FlowNode, string][] = [
  ['what', 'What happens'],
  ['why', 'Why'],
  ['who', 'Who'],
  ['info', 'Information required'],
  ['mistakes', 'Common mistakes'],
  ['considerations', 'Considerations'],
]

export function NodeDetail({
  wf,
  node,
  onSelect,
  onEdit,
}: {
  wf: Workflow
  node: FlowNode
  onSelect: (id: string) => void
  onEdit?: () => void
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
            {node.kind === 'warning' ? (
              <b>Important reminder.</b>
            ) : (
              <b>Unknown step.</b>
            )}{' '}
            {node.kind === 'warning' ? 'Read before continuing.' : 'This is a gap in the map — capture it from an authorized source.'}
          </div>
        </div>
      )}

      {target && (
        <button
          className="handoff"
          style={{ '--accent': targetDept?.type === 'department' ? ACCENTS[targetDept.accent].color : 'var(--glacier)' } as React.CSSProperties}
          onClick={() => navigate(hrefFor(target), { viewTransition: true })}
        >
          <span className="handoff__kicker">Continues in</span>
          <span className="handoff__title">
            <span className="mono">{target.code}</span> {target.title}
          </span>
          <span className="handoff__dept">{targetDept?.title}</span>
          <Icon name="arrowRight" size={20} />
        </button>
      )}
      {node.kind === 'link' && !target && <p className="error-text">The workflow this hands off to hasn’t been chosen, or was deleted.</p>}

      <Field label="What happens">{node.what && <RichText text={node.what} />}</Field>
      <Field label="Why it happens">{node.why && <RichText text={node.why} />}</Field>
      <Field label="Who is responsible">{node.who && <RichText text={node.who} />}</Field>
      {(node.systemIds?.length || node.equipmentIds?.length) ? (
        <Field label="Systems & equipment involved">
          <RefChips ids={[...(node.systemIds || []), ...(node.equipmentIds || [])]} />
        </Field>
      ) : null}
      <Field label="Information required">{node.info && <RichText text={node.info} />}</Field>

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
            !node.next && <span className="muted">{node.kind === 'end' ? 'This is where the workflow finishes.' : node.kind === 'link' ? 'Continues in the linked workflow.' : 'Nothing connected yet.'}</span>
          )}
        </div>
      </div>

      <Field label="Common mistakes">{node.mistakes && <RichText text={node.mistakes} />}</Field>
      <Field label="Important considerations">{node.considerations && <RichText text={node.considerations} />}</Field>
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

export function NodeEditor({
  wf,
  node,
  onChange,
  onDelete,
  onConnect,
  onEdgeChange,
  onEdgeDelete,
}: {
  wf: Workflow
  node: FlowNode
  onChange: (patch: Partial<FlowNode>) => void
  onDelete: () => void
  onConnect: (targetId: string) => void
  onEdgeChange: (id: string, patch: Partial<FlowEdge>) => void
  onEdgeDelete: (id: string) => void
}) {
  const outgoing = wf.edges.filter((e) => e.source === node.id)
  const byId = new Map(wf.nodes.map((n) => [n.id, n]))
  const candidates = wf.nodes.filter((n) => n.id !== node.id && !outgoing.some((e) => e.target === n.id))
  return (
    <div className="nodeeditor">
      <FormFields schema={NODE_SCHEMA} value={node as any} onChange={(p) => onChange(p as Partial<FlowNode>)} hide={node.kind === 'link' ? [] : ['linkWorkflowId']} />
      <h3 className="form__heading">Connections out</h3>
      <p className="fi__help">Drag from a step’s bottom handle to another step, or use the list below.</p>
      <ul className="edgelist">
        {outgoing.map((e) => (
          <li key={e.id} className="edgelist__item">
            <div className="edgelist__to">
              → <b>{byId.get(e.target)?.label ?? 'missing'}</b>
            </div>
            <div className="row gap-s">
              <input className="input input--compact" placeholder="Label (e.g. Yes)" value={e.label || ''} onChange={(ev) => onEdgeChange(e.id, { label: ev.target.value })} aria-label="Connection label" />
              <select className="input input--compact" value={e.kind || 'normal'} onChange={(ev) => onEdgeChange(e.id, { kind: ev.target.value as EdgeKind })} aria-label="Connection type">
                <option value="normal">Normal</option>
                <option value="yes">Yes / pass</option>
                <option value="no">No / fail</option>
                <option value="branch">Branch / parallel</option>
                <option value="loop">Loop back</option>
              </select>
              <button className="iconbtn" onClick={() => onEdgeDelete(e.id)} aria-label="Remove connection">
                <Icon name="trash" size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {candidates.length > 0 && (
        <select
          className="input"
          value=""
          onChange={(e) => e.target.value && onConnect(e.target.value)}
          aria-label="Connect to another step"
        >
          <option value="">+ Connect to another step…</option>
          {candidates.map((n) => (
            <option key={n.id} value={n.id}>
              {NODE_META[n.kind].label}: {n.label}
            </option>
          ))}
        </select>
      )}
      <button className="btn btn--danger-ghost btn--block" onClick={onDelete}>
        <Icon name="trash" size={16} /> Delete this step
      </button>
    </div>
  )
}

export function EdgeEditor({ wf, edge, onChange, onDelete }: { wf: Workflow; edge: FlowEdge; onChange: (p: Partial<FlowEdge>) => void; onDelete: () => void }) {
  const s = wf.nodes.find((n) => n.id === edge.source)
  const t = wf.nodes.find((n) => n.id === edge.target)
  return (
    <div className="form">
      <p>
        <b>{s?.label}</b> → <b>{t?.label}</b>
      </p>
      <div className="fi">
        <label className="fi__label" htmlFor="edge-label">
          Label
        </label>
        <input id="edge-label" className="input" value={edge.label || ''} onChange={(e) => onChange({ label: e.target.value })} placeholder="e.g. Yes, No, Walk-in" />
      </div>
      <div className="fi">
        <label className="fi__label" htmlFor="edge-kind">
          Type
        </label>
        <select id="edge-kind" className="input" value={edge.kind || 'normal'} onChange={(e) => onChange({ kind: e.target.value as EdgeKind })}>
          <option value="normal">Normal</option>
          <option value="yes">Yes / pass</option>
          <option value="no">No / fail</option>
          <option value="branch">Branch / parallel</option>
          <option value="loop">Loop back</option>
        </select>
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
  return (
    <div className="wfinfo">
      <IllustrativeBanner entity={wf} />
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
      <Field label="Departments">
        <RefChips ids={wf.departmentIds} />
      </Field>
      <Field label="Systems & programs">
        <RefChips ids={wf.systemIds} />
      </Field>
      <Field label="Equipment">
        <RefChips ids={wf.equipmentIds} />
      </Field>
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

      <div className="field">
        <div className="field__label">Steps flagged</div>
        <div className="nextlist">
          {wf.nodes
            .filter((n) => n.kind === 'unknown' || n.status === 'unverified' || n.status === 'outdated')
            .map((n) => (
              <button key={n.id} className="nextbtn" onClick={() => onSelect(n.id)}>
                <NodeGlyph kind={n.kind} size={12} />
                <span className="nextbtn__title">{n.label}</span>
                {n.status && <StatusBadge status={n.status} compact />}
              </button>
            ))}
        </div>
      </div>

      <Meta entity={wf} />
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
