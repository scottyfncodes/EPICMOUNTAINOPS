import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { memo } from 'react'
import type { FlowNode } from '../../shared/types'
import { Icon } from '../components/Icon'
import { NODE_META } from '../lib/meta'
import { NODE_SIZE } from '../lib/layout'

export type OpsNodeData = {
  node: FlowNode
  index: number
  direction: 'TB' | 'LR'
  editing: boolean
  linkTitle?: string
  linkCode?: string
  linkAccent?: string
  noteCount: number
  dimmed: boolean
}

export type OpsRFNode = Node<OpsNodeData, 'ops'>

function OpsNodeView({ data, selected }: NodeProps<OpsRFNode>) {
  const { node, index, direction, editing, linkTitle, linkCode, linkAccent, noteCount, dimmed } = data
  const k = node.kind
  const size = NODE_SIZE[k]
  const targetPos = direction === 'TB' ? Position.Top : Position.Left
  const sourcePos = direction === 'TB' ? Position.Bottom : Position.Right
  const sys = (node.systemIds?.length || 0) + (node.equipmentIds?.length || 0)
  const imgs = node.imageIds?.length || 0
  const flagged = node.status === 'unverified' || node.status === 'outdated'

  const handles = (
    <>
      <Handle type="target" position={targetPos} className={`h ${editing ? 'h--edit' : ''}`} isConnectable={editing} />
      <Handle type="source" position={sourcePos} className={`h ${editing ? 'h--edit' : ''}`} isConnectable={editing} />
    </>
  )

  const cls = `opsnode opsnode--${k} ${selected ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''}`
  const style = { width: size.w, minHeight: size.h, ...(linkAccent ? { '--link-accent': linkAccent } : {}) } as React.CSSProperties

  if (k === 'parallel') {
    return (
      <div className={cls} style={{ width: size.w, height: size.h }} aria-label={`Parallel: ${node.label}`}>
        {handles}
        <div className="opsnode__bar" />
        <span className="opsnode__plabel">{node.label}</span>
      </div>
    )
  }

  if (k === 'start' || k === 'end') {
    return (
      <div className={cls} style={style} aria-label={`${NODE_META[k].label}: ${node.label}`}>
        {handles}
        <span className="opsnode__term">{k === 'start' ? 'START' : 'END'}</span>
        <span className="opsnode__label">{node.label}</span>
      </div>
    )
  }

  return (
    <div className={cls} style={style} aria-label={`${NODE_META[k].label}: ${node.label}`}>
      {handles}
      {k === 'decision' && <div className="opsnode__diamond" aria-hidden="true" />}
      <div className="opsnode__head">
        <span className="opsnode__kind">
          {k === 'warning' && <Icon name="warning" size={13} />}
          {k === 'decision' && <span className="opsnode__q">?</span>}
          {k === 'link' && <Icon name="arrowRight" size={13} />}
          {k === 'unknown' && <span className="opsnode__q">?</span>}
          {NODE_META[k].label}
        </span>
        <span className="opsnode__num">{String(index).padStart(2, '0')}</span>
      </div>
      <div className="opsnode__label">{node.label}</div>
      {k === 'link' && linkTitle && (
        <div className="opsnode__link">
          {linkCode && <b>{linkCode}</b>} {linkTitle}
        </div>
      )}
      {(sys > 0 || imgs > 0 || noteCount > 0 || flagged) && (
        <div className="opsnode__meta">
          {sys > 0 && (
            <span title="Systems & equipment">
              <Icon name="system" size={12} />
              {sys}
            </span>
          )}
          {imgs > 0 && (
            <span title="Reference images">
              <Icon name="image" size={12} />
              {imgs}
            </span>
          )}
          {noteCount > 0 && (
            <span title="Questions & observations" className="is-signal">
              <Icon name="question" size={12} />
              {noteCount}
            </span>
          )}
          {flagged && <span className={`opsnode__flag status--${node.status}`}>{node.status === 'outdated' ? 'OUTDATED' : 'UNVERIFIED'}</span>}
        </div>
      )}
    </div>
  )
}

export const nodeTypes = { ops: memo(OpsNodeView) }
