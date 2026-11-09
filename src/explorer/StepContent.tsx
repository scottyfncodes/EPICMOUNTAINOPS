import type { FlowNode, Workflow } from '../../shared/types'
import { Icon } from '../components/Icon'
import { RefChips, RichText } from '../components/ui'
import { Callouts, SizingFigure } from './Callouts'
import { effectiveStatus } from './routing'

/**
 * A step's existing fields, organised for learning:
 *   DO    — what happens, who does it
 *   KNOW  — why, what you need, systems & equipment, considerations
 *   CHECK — common mistakes, and honest notes about what isn't verified
 * Only fields that exist are shown; nothing is generated.
 */
export function DoKnowCheck({ node, wf, compact = false }: { node: FlowNode; wf: Workflow; compact?: boolean }) {
  const st = effectiveStatus(node, wf)
  const kit = [...(node.systemIds || []), ...(node.equipmentIds || [])]
  const hasDo = Boolean(node.what || node.who)
  const hasKnow = Boolean(node.why || node.info || node.considerations || kit.length || node.sizing?.length)
  const hasCallouts = Boolean(node.callouts?.length)
  const caveat =
    node.kind === 'unknown'
      ? 'This step is a known gap. Capture it from an authorized source before relying on it.'
      : st.status === 'outdated'
        ? 'Marked outdated — this may no longer be how it’s done.'
        : st.status === 'unverified' && node.kind !== 'start' && node.kind !== 'end' && node.kind !== 'parallel'
          ? st.inherited
            ? 'Not yet confirmed — this step hasn’t been checked against an authorized source.'
            : 'Marked unverified — needs confirming.'
          : null
  const hasCheck = Boolean(node.mistakes || caveat)
  if (!hasDo && !hasKnow && !hasCheck && !hasCallouts) return null

  return (
    <div className={`dkc ${compact ? 'dkc--compact' : ''}`}>
      {hasDo && (
        <section className="dkc__block dkc--do" aria-label="Do">
          <h4 className="dkc__label">
            <Icon name="arrowRight" size={14} /> Do
          </h4>
          {node.what && <RichText text={node.what} />}
          {node.who && (
            <p className="dkc__who">
              <span className="dkc__k">Who</span> <RichText text={node.who} as="span" />
            </p>
          )}
        </section>
      )}
      {hasCallouts && <Callouts items={node.callouts} />}
      {hasKnow && (
        <section className="dkc__block dkc--know" aria-label="Know">
          <h4 className="dkc__label">
            <Icon name="book" size={14} /> Know
          </h4>
          {node.why && (
            <div className="dkc__item">
              <span className="dkc__k">Why</span>
              <RichText text={node.why} />
            </div>
          )}
          {node.info && (
            <div className="dkc__item">
              <span className="dkc__k">You’ll need</span>
              <RichText text={node.info} />
            </div>
          )}
          {node.sizing?.length ? (
            <div className="dkc__item">
              <span className="dkc__k">Sizing reference</span>
              <SizingFigure bands={node.sizing} />
            </div>
          ) : null}
          {kit.length > 0 && (
            <div className="dkc__item">
              <span className="dkc__k">Systems & equipment</span>
              <RefChips ids={kit} />
            </div>
          )}
          {node.considerations && (
            <div className="dkc__item">
              <span className="dkc__k">Keep in mind</span>
              <RichText text={node.considerations} />
            </div>
          )}
        </section>
      )}
      {hasCheck && (
        <section className="dkc__block dkc--check" aria-label="Check">
          <h4 className="dkc__label">
            <Icon name="check" size={14} /> Check
          </h4>
          {node.mistakes && (
            <div className="dkc__item">
              <span className="dkc__k">Common mistakes</span>
              <RichText text={node.mistakes} />
            </div>
          )}
          {caveat && <p className={`dkc__caveat ${node.kind === 'unknown' || st.status === 'outdated' ? 'is-strong' : ''}`}>{caveat}</p>}
        </section>
      )}
    </div>
  )
}
