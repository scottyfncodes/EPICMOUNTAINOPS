import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { FlowNode, Workflow } from '../../shared/types'
import { Icon } from '../components/Icon'
import { ImageGallery } from '../components/Images'
import { IllustrativeBanner, NodeGlyph, RefChip, RichText, StatusBadge, StatusGlyph } from '../components/ui'
import { flowOrder } from '../lib/layout'
import { ACCENTS, hrefFor, NODE_META } from '../lib/meta'
import { useAtlas } from '../lib/store'
import type { CameFrom } from './Explorer'
import { effectiveStatus, systemsInWorkflow } from './routing'
import { Callouts } from './Callouts'
import { DoKnowCheck } from './StepContent'

export interface Stage {
  n: number
  title: string
  firstId: string
  critical: boolean
}

/** Stages in reading order (from each step's `phase`); empty when a workflow has none. */
export function stagesOf(order: FlowNode[]): Stage[] {
  const out: Stage[] = []
  for (const node of order) {
    if (!node.phase) continue
    let st = out.find((x) => x.title === node.phase)
    if (!st) out.push((st = { n: out.length + 1, title: node.phase, firstId: node.id, critical: false }))
    if (node.critical) st.critical = true
  }
  return out
}

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
  // Where the flow continues afterwards: hand-offs, not playbooks shown inline. One chip per workflow.
  const outbound = wf.nodes.filter(
    (n, i, all) => n.kind === 'link' && n.linkWorkflowId && !n.embed && all.findIndex((m) => m.kind === 'link' && !m.embed && m.linkWorkflowId === n.linkWorkflowId) === i,
  )

  const jump = (id: string) => {
    const el = scroller.current?.querySelector(`#g-${CSS.escape(id)}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('is-flash')
    setTimeout(() => el.classList.remove('is-flash'), 1400)
  }

  const stages = useMemo(() => stagesOf(order), [order])
  const stageStart = useMemo(() => new Map(stages.map((st) => [st.firstId, st])), [stages])
  const [current, setCurrent] = useState(1)

  // Which stage is in view: the last stage header scrolled up to the progress bar.
  const spy = useCallback(() => {
    const root = scroller.current
    if (!root || !stages.length) return
    const bar = root.querySelector<HTMLElement>('.stagebar')
    const line = root.getBoundingClientRect().top + (bar?.offsetHeight || 0) + 24
    let n = 1
    for (const st of stages) {
      const el = root.querySelector(`#stage-${st.n}`)
      if (el && el.getBoundingClientRect().top <= line) n = st.n
    }
    // At the very end the last stage is current, even if its header can't reach the top.
    if (root.scrollTop > 0 && root.scrollTop + root.clientHeight >= root.scrollHeight - 4) n = stages[stages.length - 1].n
    setCurrent(n)
  }, [stages])

  useEffect(() => {
    const root = scroller.current
    if (!root || !stages.length) return
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(spy)
    }
    root.addEventListener('scroll', on, { passive: true })
    spy()
    return () => {
      root.removeEventListener('scroll', on)
      cancelAnimationFrame(raf)
    }
  }, [spy, stages.length])

  const goStage = (n: number) => {
    const root = scroller.current
    const el = root?.querySelector(`#stage-${n}`)
    if (!root || !el) return
    // Glide to nearby stages; jump straight to far ones (and whenever motion is reduced).
    const far = Math.abs(el.getBoundingClientRect().top - root.getBoundingClientRect().top) > root.clientHeight * 2.5
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: far || still ? 'auto' : 'smooth', block: 'start' })
  }

  // Arriving with a step selected: start the guide at that step.
  useEffect(() => {
    if (selectedId) setTimeout(() => jump(selectedId), 80)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const renderStep = (n: FlowNode) => {
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
            // Point out where the flow goes when it isn't simply "the next card", or when the path is labelled.
            const jumps = n.kind === 'decision' ? [] : out.filter((e) => e.target !== nextInOrder?.id || Boolean(e.label))
            return (
              <li
                key={n.id}
                id={`g-${n.id}`}
                className={`guidestep guidestep--${n.kind} ${n.critical ? 'guidestep--critical' : ''} ${selectedId === n.id ? 'is-on' : ''}`}
              >
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
                {n.critical && n.kind !== 'warning' && !order[i - 2]?.critical && (
                  <p className="guidestep__critical">
                    <Icon name="warning" size={14} /> Safety-critical — follow current approved procedures only.
                  </p>
                )}

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

                {target && n.embed && <Embedded wf={target} from={{ ...from, nodeId: n.id }} />}

                {target && !n.embed && (
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
  }

  return (
    <div className="guide paper" ref={scroller}>
      {stages.length > 1 && <StageBar stages={stages} current={current} onGo={goStage} />}
      <div className="guide__inner">
        <header className="brief">
          <div className="kicker">Field guide · {wf.code}</div>
          <h2 className="brief__title">{wf.title}</h2>
          <IllustrativeBanner entity={wf} />
          {wf.summary && <RichText text={wf.summary} />}
          {!wf.illustrative && (wf.source || wf.sourceIds?.length) ? (
            <div className="brief__source">
              <StatusBadge status={wf.status} />
              <span>
                {wf.source || 'Linked source'}
                {wf.status === 'observed' && <span className="muted"> · first-hand, not an official procedure</span>}
              </span>
            </div>
          ) : null}
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
            {stages.length > 1 && (
              <>
                <b>{stages.length}</b> stages ·{' '}
              </>
            )}
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
          {order.flatMap((n) => {
            const st = stageStart.get(n.id)
            const step = renderStep(n)
            if (!st) return [step]
            return [
              <li key={`stage-${st.n}`} id={`stage-${st.n}`} className={`guidestage ${st.critical ? 'guidestage--critical' : ''}`}>
                <span className="guidestage__n mono">Stage {st.n} of {stages.length}</span>
                <span className="guidestage__title">{st.title}</span>
                {st.critical && (
                  <span className="guidestage__flag">
                    <Icon name="warning" size={12} /> Safety-critical · approved procedures only
                  </span>
                )}
              </li>,
              step,
            ]
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

/* ------------------------------------------------------------------ */
/** Sticky progress through a workflow's stages; tap a segment to jump. */
function StageBar({ stages, current, onGo }: { stages: Stage[]; current: number; onGo: (n: number) => void }) {
  const cur = stages.find((s) => s.n === current) || stages[0]
  return (
    <nav className="stagebar" aria-label="Stages">
      <div className="stagebar__now" aria-live="polite">
        <span className="stagebar__count mono">
          Stage {cur.n}/{stages.length}
        </span>
        <span className="stagebar__title">{cur.title}</span>
        {cur.critical && (
          <span className="stagebar__crit" title="Safety-critical stage">
            <Icon name="warning" size={13} />
            <span className="sr-only">Safety-critical</span>
          </span>
        )}
      </div>
      <ol className="stagebar__track">
        {stages.map((s) => (
          <li key={s.n}>
            <button
              type="button"
              className={`stagebar__seg ${s.n < current ? 'is-done' : ''} ${s.n === current ? 'is-now' : ''} ${s.critical ? 'is-crit' : ''}`}
              onClick={() => onGo(s.n)}
              aria-label={`Stage ${s.n}: ${s.title}${s.critical ? ' (safety-critical)' : ''}`}
              aria-current={s.n === current ? 'step' : undefined}
            >
              <span />
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * A shared sub-procedure shown in place (e.g. the out-of-stock options used
 * by both boots and skis). One source of truth, read where it's needed.
 */
function Embedded({ wf, from }: { wf: Workflow; from: CameFrom }) {
  const steps = flowOrder(wf.nodes, wf.edges).filter((n) => n.kind !== 'start' && n.kind !== 'end' && n.kind !== 'parallel')
  const decision = steps.find((n) => n.kind === 'decision')
  const options = decision ? wf.edges.filter((e) => e.source === decision.id).length : 0
  return (
    <details className="embed">
      <summary className="embed__sum">
        <span className="embed__kicker mono">
          Shared playbook · {wf.code}
        </span>
        <span className="embed__title">{options > 1 ? `See the ${options} options` : wf.title}</span>
        <Icon name="down" size={18} />
      </summary>
      <div className="embed__body">
        <ol className="embed__steps">
          {steps.map((n) => (
            <li key={n.id} className={`embed__step embed__step--${n.kind}`}>
              <span className="embed__label">{n.label}</span>
              {n.what && <RichText text={n.what} />}
              <Callouts items={n.callouts} />
            </li>
          ))}
        </ol>
        <Link className="textlink embed__open" to={hrefFor(wf)} viewTransition state={{ from }}>
          Open {wf.code} {wf.title} <Icon name="arrowRight" size={14} />
        </Link>
      </div>
    </details>
  )
}
