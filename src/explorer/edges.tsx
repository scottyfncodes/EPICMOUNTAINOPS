import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react'
import { memo } from 'react'
import type { EdgeKind } from '../../shared/types'

export type OpsEdgeData = {
  kind: EdgeKind
  hot: boolean
  dim: boolean
  editing: boolean
  onLabelTap?: (id: string) => void
}

export type OpsRFEdge = Edge<OpsEdgeData, 'ops'>

function OpsEdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, data, selected, markerEnd }: EdgeProps<OpsRFEdge>) {
  const kind = data?.kind || 'normal'
  const [path, lx, ly] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 14,
    offset: kind === 'loop' ? 34 : 20,
  })
  // Place labels where they're unambiguous: branch labels right where they leave
  // their decision, loop-back labels where they re-enter — not at the midpoint,
  // where sibling labels collide.
  let px = lx
  let py = ly
  if (kind === 'loop') {
    const o = targetPosition === 'right' ? 44 : targetPosition === 'left' ? -44 : 0
    px = targetX + o
    py = targetY + (targetPosition === 'bottom' ? 24 : targetPosition === 'top' ? -24 : 0)
  } else if (label) {
    if (sourcePosition === 'right' || sourcePosition === 'left') {
      // Nodes draw above labels, so clear the source by half the pill's own width.
      const half = String(label).length * 4.2 + 14
      px = sourceX + (sourcePosition === 'right' ? 1 : -1) * Math.max(half + 6, Math.min(56, Math.abs(targetX - sourceX) / 2))
      py = sourceY
    } else {
      px = sourceX
      py = sourceY + (sourcePosition === 'bottom' ? 1 : -1) * Math.min(30, Math.abs(targetY - sourceY) / 2)
    }
  }
  const cls = ['opsedge', `opsedge--${kind}`, data?.hot ? 'is-hot' : '', data?.dim ? 'is-dim' : '', selected ? 'is-selected' : ''].join(' ')
  const showLabel = Boolean(label) || (data?.editing && data.hot)
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} className={cls} interactionWidth={26} />
      {data?.hot && <path d={path} className="opsedge__flow" fill="none" aria-hidden="true" />}
      {showLabel && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className={`edgelabel edgelabel--${kind} ${data?.hot ? 'is-hot' : ''} ${data?.dim ? 'is-dim' : ''} ${data?.editing ? 'is-editable' : ''}`}
            style={{ transform: `translate(-50%, -50%) translate(${px}px, ${py}px)` }}
            onClick={(e) => {
              e.stopPropagation()
              data?.onLabelTap?.(id)
            }}
            tabIndex={data?.editing ? 0 : -1}
            aria-label={data?.editing ? `Edit connection${label ? ' ' + label : ''}` : String(label || '')}
          >
            {label || '+'}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const edgeTypes = { ops: memo(OpsEdgeView) }
