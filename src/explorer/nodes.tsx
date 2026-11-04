import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { memo } from 'react'
import type { FlowNode, Status } from '../../shared/types'
import { Icon } from '../components/Icon'
import { StatusGlyph } from '../components/ui'
import { NODE_SIZE } from '../lib/layout'
import { NODE_META } from '../lib/meta'
import type { LensMark } from './routing'

export type OpsNodeData = {
  node: FlowNode
  index: number
  direction: 'TB' | 'LR'
  editing: boolean
  linkTitle?: string
  linkCode?: string
  linkDept?: string
  linkAccent?: string
  noteCount: number
  /** Dimmed because another step is selected and this one isn't adjacent. */
  dimmed: boolean
  lens: LensMark
  status: Status
  statusInherited: boolean
}

export type OpsRFNode = Node<OpsNodeData, 'ops'>

const SIDES: [Position, string][] = [
  [Position.Top, 'top'],
  [Position.Right, 'right'],
  [Position.Bottom, 'bottom'],
  [Position.Left, 'left'],
]

/** Every node has a source and a target handle on each side; routing picks which to use. */
function Handles({ editing, direction }: { editing: boolean; direction: 'TB' | 'LR' }) {
  const primarySource = direction === 'TB' ? 'bottom' : 'right'
  const primaryTarget = direction === 'TB' ? 'top' : 'left'
  return (
    <>
      {SIDES.map(([pos, side]) => (
        <Handle
          key={`t-${side}`}
          id={`t-${side}`}
          type="target"
          position={pos}
          isConnectable={editing && side === primaryTarget}
          className={`h ${editing && side === primaryTarget ? 'h--edit h--in' : ''}`}
        />
      ))}
      {SIDES.map(([pos, side]) => (
        <Handle
          key={`s-${side}`}
          id={`s-${side}`}
          type="source"
          position={pos}
          isConnectable={editing && side === primarySource}
          className={`h ${editing && side === primarySource ? 'h--edit h--out' : ''}`}
        />
      ))}
    </>
  )
}

function OpsNodeView({ data, selected }: NodeProps<OpsRFNode>) {
  const { node, index, direction, editing, linkTitle, linkCode, linkDept, linkAccent, noteCount, dimmed, lens, status, statusInherited } = data
  const k = node.kind
  const size = NODE_SIZE[k]
  const sys = (node.systemIds?.length || 0) + (node.equipmentIds?.length || 0)
  const imgs = node.imageIds?.length || 0
  const faded = dimmed || lens.dim
  const cls = [
    'opsnode',
    `opsnode--${k}`,
    selected ? 'is-selected' : '',
    faded ? 'is-dimmed' : '',
    lens.tone ? `tone--${lens.tone}` : '',
  ].join(' ')
  const style = { width: size.w, minHeight: size.h, ...(linkAccent ? { '--link-accent': linkAccent } : {}) } as React.CSSProperties
  const label = `${NODE_META[k].label} ${index}: ${node.label}${statusInherited ? '' : `, ${status}`}`
  const crop = selected ? <span className="crop" aria-hidden="true" /> : null
  const badge = lens.badge ? <span className="opsnode__lensbadge">{lens.badge}</span> : null

  if (k === 'parallel') {
    return (
      <div className={cls} style={{ width: size.w, height: size.h }} aria-label={label}>
        <Handles editing={editing} direction={direction} />
        <div className="opsnode__bar" />
        <span className="opsnode__plabel">{node.label}</span>
      </div>
    )
  }

  if (k === 'start' || k === 'end') {
    return (
      <div className={cls} style={style} aria-label={label}>
        <Handles editing={editing} direction={direction} />
        {crop}
        <span className="opsnode__term">{k === 'start' ? 'START' : 'END'}</span>
        <span className="opsnode__label">{node.label}</span>
      </div>
    )
  }

  return (
    <div className={cls} style={style} aria-label={label}>
      <Handles editing={editing} direction={direction} />
      {crop}
      {k === 'decision' && (
        <div className="opsnode__diamond" aria-hidden="true">
          <div className="opsnode__diamond-in" />
        </div>
      )}
      <div className="opsnode__head">
        <span className="opsnode__num">{String(index).padStart(2, '0')}</span>
        <span className="opsnode__kind">
          {k === 'warning' && <Icon name="warning" size={12} />}
          {k === 'link' && <Icon name="arrowRight" size={12} />}
          {(k === 'decision' || k === 'unknown') && <span className="opsnode__q">?</span>}
          {NODE_META[k].label}
        </span>
        {k !== 'unknown' && (
          <span className={`opsnode__status status--${status} ${statusInherited ? 'is-inherited' : ''}`} title={statusInherited ? `${status} (from workflow)` : status}>
            <StatusGlyph status={status} size={11} />
          </span>
        )}
      </div>
      <div className="opsnode__label">{node.label}</div>
      {k === 'link' && (
        <div className="opsnode__link">
          {linkDept && <b className="opsnode__dept">{linkDept}</b>}
          {linkCode && <span className="mono">{linkCode}</span>} {linkTitle || <em>Choose a destination</em>}
        </div>
      )}
      {(sys > 0 || imgs > 0 || noteCount > 0 || badge) && (
        <div className="opsnode__meta">
          {sys > 0 && (
            <span title={`${sys} systems & equipment`}>
              <Icon name="system" size={12} />
              {sys}
            </span>
          )}
          {imgs > 0 && (
            <span title={`${imgs} reference images`}>
              <Icon name="image" size={12} />
              {imgs}
            </span>
          )}
          {noteCount > 0 && (
            <span title={`${noteCount} open questions`} className="is-q">
              <Icon name="question" size={12} />
              {noteCount}
            </span>
          )}
          {badge}
        </div>
      )}
    </div>
  )
}

export const nodeTypes = { ops: memo(OpsNodeView) }
