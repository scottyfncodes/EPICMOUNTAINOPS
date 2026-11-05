import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { FlowNode, Workflow } from '../../shared/types'
import { Icon } from '../components/Icon'
import { ImageGallery } from '../components/Images'
import { IllustrativeBanner, NodeGlyph, RefChip, RichText, StatusGlyph } from '../components/ui'
import { ACCENTS, hrefFor, NODE_META } from '../lib/meta'
import { useAtlas } from '../lib/store'
import type { CameFrom } from './Explorer'
import { effectiveStatus, systemsInWorkflow } from './routing'
import { DoKnowCheck } from './StepContent'

/**
 * A workflow read as a field guide: a quick-reference brief, then every step
 * in order with Do / Know / Check, decisions as choices, hand-offs as next
 * chapters. Same data as the map, organised for learning.
 */
export function Guide({
  wf,
  order,
  selectedId,
  onShowOnMap,
  from,
}: {
  wf: Workflow
  order: FlowNode[]
  selectedId: string | null
  onShowOnMap: (id: string) => void
  from: CameFrom
}) {
  const atlas = useAtlas()
  const navigate = useNavigate()
  const scroller = useRef<HTMLDivElement>(null)
  const byId = new Map(wf.nodes.map((n) => [n.id, n]))
  const index = new Map(order.map((n, i) => [n.id, i + 1]))
  const warnings = wf.nodes.filter((n) => n.kind === 'warning')
  const unknowns = wf.nodes.filter((n) => n.kind === 'unknown')
  const decisions = wf.nodes.filter((n) => n.kind === 'decision')
  const systems = systemsInWorkflow(wf).filter((s) => s.count > 0)
  const inbound = atlas.inboundLinks(wf.id)
  const outbound = wf.nodes.filter((n) => n.kind === 'link' && n.linkWorkflowId)

  const jump = (id: string) => {
    const el = scroller.current?.querySelector(`#g-${CSS.escape(id)}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('is-flash')
    setTimeout(() => el.classList.remove('is-flash'), 1400)
  }

  // Arriving with a step selected: start the guide at that step.
  useEffect(() => {
    if (selectedId) setTimeout(() => jump(selectedId), 80)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="guide paper" ref={scroller}>
      <div className="guide__inner">
        <header className="brief">
          <div className="kicker">Field guide · {wf.code}</div>
          <h2 className="brief__title">{wf.title}</h2>
          <IllustrativeBanner entity={wf} />
          {wf.summary && <RichText text={wf.summary} />}
          <dl className="brief__ends">
            <div>
              <dt>Starts when</dt>
              <dd>{wf.trigger || <span className="muted">Not captured</span>}</dd>
            </div>
            <div>
              <dt>Finished when</dt>
              <dd>{wf.outcome || <span className="muted">Not captured</span>}</dd>
            </div>
          </dl>
          <p className="brief__counts">
            <b>{order.filter((n) => n.kind !== 'start' && n.kind !== 'end' && n.kind !== 'parallel').length}</b> steps
            {decisions.length > 0 && (
              <>
                {' '}
                · <b>{decisions.length}</b> decision{decisions.length > 1 ? 's' : ''}
              </>
            )}
            {warnings.length > 0 && (
              <>
                {' '}
                · <b className="is-signal">{warnings.length}</b> warning{warnings.length > 1 ? 's' : ''}
              </>
            )}
            {unknowns.length > 0 && (
              <>
                {' '}
                · <b className="is-attn">{unknowns.length}</b> not captured
              </>
            )}
          </p>

          {(warnings.length > 0 || unknowns.length > 0) && (
            <div className="brief__flags">
              {warnings.map((n) => (
                <button key={n.id} className="flag flag--warn" onClick={() => jump(n.id)}>
                  <Icon name="warning" size={14} /> <span>{n.label}</span>
                </button>
              ))}
              {unknowns.map((n) => (
                <button key={n.id} className="flag flag--unknown" onClick={() => jump(n.id)}>
                  <span className="opsnode__q">?</span> <span>{n.label}</span>
                </button>
              ))}
            </div>
          )}
          {systems.length > 0 && (
            <div className="brief__row">
              <span className="brief__k">Uses</span>
              <div className="chips">
                {systems.map((s) => (
                  <RefChip key={s.id} id={s.id} />
                ))}
              </div>
            </div>
          )}
          {inbound.length > 0 && (
            <div className="brief__row">
              <span className="brief__k">Arrives from</span>
              <div className="chips">
                {inbound.map((r) => (
                  <RefChip key={r.workflow.id + r.node.id} id={r.workflow.id} />
                ))}
              </div>
            </div>
          )}
        </header>

        <ol className="guidesteps">
          {order.map((n) => {
            const i = index.get(n.id) || 0
            const out = wf.edges.filter((e) => e.source === n.id)
            const nextInOrder = order[i]
            if (n.kind === 'parallel') {
              return (
                <li key={n.id} id={`g-${n.id}`} className="guidemark">
                  <span className="guidemark__bar" /> {n.label}
                </li>
              )
            }
            if (n.kind === 'start' || n.kind === 'end') {
              return (
                <li key={n.id} id={`g-${n.id}`} className={`guidemark guidemark--${n.kind}`}>
                  <span className="opsnode__term">{n.kind === 'start' ? 'START' : 'END'}</span> {n.label}
                </li>
              )
            }
            const target = n.kind === 'link' ? atlas.get<Workflow>(n.linkWorkflowId) : undefined
            const tdept = target ? atlas.get(target.departmentIds[0]) : undefined
            const st = effectiveStatus(n, wf)
            // Point out where the flow goes when it isn't simply "the next card".
            const jumps = n.kind === 'decision' ? [] : out.filter((e) => e.target !== nextInOrder?.id)
            return (
              <li key={n.id} id={`g-${n.id}`} className={`guidestep guidestep--${n.kind} ${selectedId === n.id ? 'is-on' : ''}`}>
                <header className="guidestep__head">
                  <span className="guidestep__num mono">{String(i).padStart(2, '0')}</span>
                  <span className="guidestep__kind">
                    <NodeGlyph kind={n.kind} size={11} /> {NODE_META[n.kind].label}
                  </span>
                  <span className={`status--${st.status} ${st.inherited ? 'is-inherited' : ''}`} title={st.status}>
                    <StatusGlyph status={st.status} size={12} />
                  </span>
                </header>
                <h3 className="guidestep__title">{n.label}</h3>

                {n.kind === 'warning' && (
                  <div className="banner banner--warning" role="note">
                    <Icon name="warning" size={18} />
                    <div>
                      <b>Important.</b> Read before continuing.
                    </div>
                  </div>
                )}

                <DoKnowCheck node={n} wf={wf} compact />

                {n.kind === 'decision' && out.length > 0 && (
                  <div className="choices">
                    <div className="choices__label">Choose</div>
                    {out.map((e) => {
                      const t = byId.get(e.target)
                      if (!t) return null
                      return (
                        <button key={e.id} className={`choice choice--${e.kind || 'normal'}`} onClick={() => jump(t.id)}>
                          <span className="choice__if">{e.label || 'Then'}</span>
                          <span className="choice__go">
                            → {String(index.get(t.id) || 0).padStart(2, '0')} {t.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {target && (
                  <button
                    className="handoff"
                    style={{ '--accent': tdept?.type === 'department' ? ACCENTS[tdept.accent].color : 'var(--glacier)' } as React.CSSProperties}
                    onClick={() => navigate(hrefFor(target), { viewTransition: true, state: { from: { ...from, nodeId: n.id } } })}
                  >
                    <span className="handoff__kicker">Next chapter · {tdept?.type === 'department' ? tdept.title : 'another workflow'}</span>
                    <span className="handoff__title">
                      <span className="mono">{target.code}</span> {target.title}
                    </span>
                    <Icon name="arrowRight" size={20} />
                  </button>
                )}

                {jumps.map((e) => {
                  const t = byId.get(e.target)
                  if (!t) return null
                  return (
                    <button key={e.id} className="guidejump" onClick={() => jump(t.id)}>
                      {e.kind === 'loop' ? '↺' : '→'} {e.label ? `${e.label}: ` : 'Then: '}
                      {String(index.get(t.id) || 0).padStart(2, '0')} {t.label}
                    </button>
                  )
                })}

                {n.imageIds?.length ? <ImageGallery ids={n.imageIds} /> : null}

                <footer className="guidestep__foot">
                  <button className="textlink" onClick={() => onShowOnMap(n.id)}>
                    <Icon name="map" size={14} /> Show on map
                  </button>
                </footer>
              </li>
            )
          })}
        </ol>

        {outbound.length > 0 && (
          <footer className="brief brief--end">
            <div className="kicker">After this</div>
            <div className="chips">
              {outbound.map((n) => (
                <RefChip key={n.id} id={n.linkWorkflowId!} />
              ))}
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}
