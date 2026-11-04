import {
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeMouseHandler,
  type NodeChange,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/base.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { FlowNode, NodeKind, Workflow } from '../../shared/types'
import { EntityEditor, HistoryPanel } from '../components/Editor'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { NodeGlyph, StatusBadge } from '../components/ui'
import { autoLayout, flowOrder, NODE_SIZE, needsLayout } from '../lib/layout'
import { ACCENTS, hrefFor, NODE_META } from '../lib/meta'
import { pushRecent, useAtlas, useStore } from '../lib/store'
import { useMediaQuery } from '../lib/useMediaQuery'
import { NotFound } from '../pages/NotFound'
import { nodeTypes, type OpsRFNode } from './nodes'
import { EdgeEditor, NodeDetail, NodeEditor, WorkflowInfo } from './Panels'

export function WorkflowExplorer() {
  const { id } = useParams()
  return (
    <ReactFlowProvider key={id}>
      <ExplorerInner id={id!} />
    </ReactFlowProvider>
  )
}

const EDGE_COLOR: Record<string, string> = {
  normal: 'var(--edge)',
  yes: 'var(--forest-hi)',
  no: 'var(--signal)',
  branch: 'var(--edge-dim)',
  loop: 'var(--glacier)',
}

function prepare(wf: Workflow): Workflow {
  return needsLayout(wf.nodes) ? { ...wf, nodes: autoLayout(wf.nodes, wf.edges, wf.direction || 'TB') } : wf
}

const rid = (k: string) => `${k}-${Math.random().toString(36).slice(2, 7)}`

function ExplorerInner({ id }: { id: string }) {
  const atlas = useAtlas()
  const { canEdit, requestEdit, save } = useStore()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const rf = useReactFlow()
  const isMobile = useMediaQuery('(max-width: 899px)')
  const wf = atlas.get<Workflow>(id)

  const [draft, setDraft] = useState<Workflow | null>(() => (wf && wf.type === 'workflow' ? prepare(wf) : null))
  const [dirty, setDirty] = useState(false)
  const [editing, setEditing] = useState(params.get('edit') === '1' && canEdit)
  const [view, setView] = useState<'map' | 'steps'>('map')
  const [panel, setPanel] = useState<'none' | 'info'>('none')
  const [size, setSize] = useState<'half' | 'full'>('half')
  const [edgeSel, setEdgeSel] = useState<string | null>(null)
  const [showMini, setShowMini] = useState(!isMobile)
  const [addMenu, setAddMenu] = useState(false)
  const [editMeta, setEditMeta] = useState(false)
  const [history, setHistory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hint, setHint] = useState(true)
  const [dims, setDims] = useState<Record<string, { width: number; height: number }>>({})
  const wrap = useRef<HTMLDivElement>(null)
  const selectedId = params.get('node')

  // Pick up server changes when there are no local edits.
  useEffect(() => {
    if (wf && wf.type === 'workflow' && !dirty) setDraft(prepare(wf))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wf?.updatedAt])

  useEffect(() => {
    if (wf) pushRecent({ type: 'workflow', id: wf.id })
  }, [wf?.id])

  useEffect(() => {
    if (params.get('edit') === '1' && canEdit) setEditing(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit])

  // Unsaved-change guards
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (confirm('You have unsaved changes to this workflow. Leave without saving?')) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const update = useCallback((fn: (w: Workflow) => Workflow) => {
    setDraft((d) => (d ? fn(d) : d))
    setDirty(true)
  }, [])

  const select = useCallback(
    (nodeId: string | null) => {
      setEdgeSel(null)
      setHint(false)
      setParams(
        (p) => {
          const next = new URLSearchParams(p)
          if (nodeId) next.set('node', nodeId)
          else next.delete('node')
          return next
        },
        { replace: true },
      )
      if (nodeId) setPanel('none')
    },
    [setParams],
  )

  /* ---------------- camera ---------------- */
  const centerOn = useCallback(
    (nodeId: string, opts: { zoom?: number } = {}) => {
      const n = draft?.nodes.find((x) => x.id === nodeId)
      if (!n || n.x === undefined || n.y === undefined) return
      const s = NODE_SIZE[n.kind]
      const z = opts.zoom ?? Math.max(rf.getZoom(), isMobile ? 0.85 : 0.9)
      let cx = n.x + s.w / 2
      let cy = n.y + s.h / 2
      if (isMobile) {
        const sheetPx = window.innerHeight * (size === 'full' ? 0.86 : 0.48)
        cy += sheetPx / 2 / z
      } else {
        cx += 440 / 2 / z
      }
      rf.setCenter(cx, cy, { zoom: z, duration: 450 })
    },
    [draft, rf, isMobile, size],
  )

  const fit = useCallback(() => rf.fitView({ padding: isMobile ? 0.12 : 0.18, duration: 450, maxZoom: 1.1 }), [rf, isMobile])

  // Center on a node from the URL once the map is ready.
  const initialCentered = useRef(false)
  const onInit = useCallback(() => {
    if (selectedId && !initialCentered.current) {
      initialCentered.current = true
      setTimeout(() => centerOn(selectedId, { zoom: 1 }), 60)
    }
  }, [selectedId, centerOn])

  useEffect(() => {
    if (selectedId && view === 'map' && initialCentered.current) centerOn(selectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  /* ---------------- wheel & gesture handling ---------------- */
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    // Mouse wheels zoom; trackpad two-finger scrolls pan (React Flow), pinches zoom (ctrlKey).
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return
      const looksLikeMouse = e.deltaMode === 1 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 40 && Number.isInteger(e.deltaY))
      if (!looksLikeMouse) return
      e.preventDefault()
      e.stopPropagation()
      const { x, y, zoom } = rf.getViewport()
      const factor = Math.exp(-(e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY) * 0.0015)
      const nz = Math.min(2.2, Math.max(0.15, zoom * factor))
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      rf.setViewport({ x: mx - ((mx - x) * nz) / zoom, y: my - ((my - y) * nz) / zoom, zoom: nz })
    }
    const stopGesture = (e: Event) => e.preventDefault()
    el.addEventListener('wheel', onWheel, { capture: true, passive: false })
    el.addEventListener('gesturestart', stopGesture)
    el.addEventListener('gesturechange', stopGesture)
    return () => {
      el.removeEventListener('wheel', onWheel, { capture: true } as any)
      el.removeEventListener('gesturestart', stopGesture)
      el.removeEventListener('gesturechange', stopGesture)
    }
  }, [rf, view])

  /* ---------------- derive React Flow state ---------------- */
  const neighbors = useMemo(() => {
    const s = new Set<string>()
    if (!draft || !selectedId) return s
    s.add(selectedId)
    for (const e of draft.edges) {
      if (e.source === selectedId) s.add(e.target)
      if (e.target === selectedId) s.add(e.source)
    }
    return s
  }, [draft, selectedId])

  const order = useMemo(() => (draft ? flowOrder(draft.nodes, draft.edges) : []), [draft])
  const indexOf = useMemo(() => new Map(order.map((n, i) => [n.id, i + 1])), [order])

  const rfNodes: OpsRFNode[] = useMemo(() => {
    if (!draft) return []
    return draft.nodes.map((n) => {
      const target = n.kind === 'link' ? atlas.get<Workflow>(n.linkWorkflowId) : undefined
      const tdept = target ? atlas.get(target.departmentIds[0]) : undefined
      return {
        id: n.id,
        type: 'ops',
        position: { x: n.x ?? 0, y: n.y ?? 0 },
        ...(dims[n.id] ? { measured: dims[n.id] } : {}),
        selected: n.id === selectedId,
        draggable: editing,
        data: {
          node: n,
          index: indexOf.get(n.id) || 0,
          direction: draft.direction || 'TB',
          editing,
          linkTitle: target?.title,
          linkCode: target?.code,
          linkAccent: tdept?.type === 'department' ? ACCENTS[tdept.accent].color : undefined,
          noteCount: atlas.notesFor('workflow', draft.id, n.id).filter((x) => !x.resolved).length,
          dimmed: Boolean(selectedId) && !neighbors.has(n.id),
        },
      }
    })
  }, [draft, selectedId, editing, atlas, indexOf, neighbors, dims])

  const rfEdges: Edge[] = useMemo(() => {
    if (!draft) return []
    return draft.edges.map((e) => {
      const kind = e.kind || 'normal'
      const hot = selectedId && (e.source === selectedId || e.target === selectedId)
      const color = hot ? 'var(--paper)' : EDGE_COLOR[kind]
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        label: e.label,
        selected: e.id === edgeSel,
        className: `opsedge opsedge--${kind} ${hot ? 'is-hot' : ''} ${selectedId && !hot ? 'is-dim' : ''}`,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: hot ? '#f3efe6' : kind === 'yes' ? '#7fa88c' : kind === 'no' ? '#e8742a' : kind === 'loop' ? '#8db3c7' : '#7d878d' },
        style: { stroke: color, strokeWidth: hot ? 2.2 : 1.6 },
        labelStyle: { fill: kind === 'yes' ? '#a9cbb4' : kind === 'no' ? '#f2a46f' : '#d9d4c8', fontWeight: 600, fontSize: 12 },
        labelBgStyle: { fill: '#1b2125', stroke: '#2f383e' },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 3,
        pathOptions: { borderRadius: 12, offset: kind === 'loop' ? 36 : 22 },
        interactionWidth: 24,
      } as Edge
    })
  }, [draft, selectedId, edgeSel])

  /* ---------------- interaction handlers ---------------- */
  const onNodesChange = useCallback(
    (changes: NodeChange<OpsRFNode>[]) => {
      // Keep measured sizes so the minimap and edge routing know each node's real size.
      const sized = changes.filter((c) => c.type === 'dimensions' && c.dimensions) as { id: string; dimensions: { width: number; height: number } }[]
      if (sized.length)
        setDims((d) => {
          const next = { ...d }
          for (const c of sized) next[c.id] = c.dimensions
          return next
        })
      if (!editing) return
      const moves = changes.filter((c) => c.type === 'position' && c.position) as { id: string; position: { x: number; y: number } }[]
      if (!moves.length) return
      update((w) => ({
        ...w,
        nodes: w.nodes.map((n) => {
          const m = moves.find((c) => c.id === n.id)
          return m ? { ...n, x: Math.round(m.position.x), y: Math.round(m.position.y) } : n
        }),
      }))
    },
    [editing, update],
  )

  const onNodeClick: NodeMouseHandler<OpsRFNode> = useCallback((_, node) => select(node.id), [select])
  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_, edge) => {
      if (!editing) return
      select(null)
      setEdgeSel(edge.id)
    },
    [editing, select],
  )

  const connect = useCallback(
    (source: string, target: string) => {
      if (source === target) return
      update((w) => {
        if (w.edges.some((e) => e.source === source && e.target === target)) return w
        const src = w.nodes.find((n) => n.id === source)
        const kind = src?.kind === 'parallel' ? 'branch' : 'normal'
        return { ...w, edges: [...w.edges, { id: `${source}->${target}-${Math.random().toString(36).slice(2, 5)}`, source, target, kind }] }
      })
    },
    [update],
  )
  const onConnect = useCallback((c: Connection) => c.source && c.target && connect(c.source, c.target), [connect])

  const addNode = useCallback(
    (kind: NodeKind) => {
      if (!draft) return
      const s = NODE_SIZE[kind]
      const from = draft.nodes.find((n) => n.id === selectedId)
      let pos: { x: number; y: number }
      if (from && from.x !== undefined && from.y !== undefined) {
        const fs = NODE_SIZE[from.kind]
        pos = (draft.direction || 'TB') === 'TB' ? { x: from.x + fs.w / 2 - s.w / 2, y: from.y + fs.h + 70 } : { x: from.x + fs.w + 90, y: from.y }
      } else {
        const r = wrap.current?.getBoundingClientRect()
        const c = rf.screenToFlowPosition({ x: (r?.left || 0) + (r?.width || 400) / 2, y: (r?.top || 0) + (r?.height || 400) / 3 })
        pos = { x: c.x - s.w / 2, y: c.y - s.h / 2 }
      }
      // Nudge the new node until it doesn't sit on top of an existing one.
      const overlaps = (p: { x: number; y: number }) =>
        draft.nodes.some((o) => {
          if (o.x === undefined || o.y === undefined) return false
          const os = NODE_SIZE[o.kind]
          return p.x < o.x + os.w + 16 && p.x + s.w + 16 > o.x && p.y < o.y + os.h + 16 && p.y + s.h + 16 > o.y
        })
      for (let i = 0; i < 60 && overlaps(pos); i++) {
        pos = (draft.direction || 'TB') === 'TB' && !from ? { x: pos.x, y: pos.y + 48 } : { x: pos.x + s.w / 2 + 24, y: pos.y }
      }
      const node: FlowNode = {
        id: rid(kind),
        kind,
        label: kind === 'decision' ? 'New decision?' : kind === 'end' ? 'End' : kind === 'parallel' ? 'In parallel' : kind === 'unknown' ? 'Unknown step' : `New ${NODE_META[kind].label.toLowerCase()}`,
        status: 'unverified',
        x: Math.round(pos.x),
        y: Math.round(pos.y),
      }
      update((w) => ({
        ...w,
        nodes: [...w.nodes, node],
        edges: from ? [...w.edges, { id: `${from.id}->${node.id}`, source: from.id, target: node.id, kind: from.kind === 'parallel' ? 'branch' : 'normal' }] : w.edges,
      }))
      setAddMenu(false)
      select(node.id)
      setSize(isMobile ? 'full' : 'half')
      setTimeout(() => centerOn(node.id), 50)
    },
    [draft, selectedId, rf, update, select, isMobile, centerOn],
  )

  // ?add=step from the Add Information page
  const addedOnce = useRef(false)
  useEffect(() => {
    if (editing && params.get('add') === 'step' && draft && !addedOnce.current) {
      addedOnce.current = true
      const last = order[order.length - 1]
      if (last) select(last.id)
      setTimeout(() => addNode('step'), 300)
      setParams((p) => {
        const n = new URLSearchParams(p)
        n.delete('add')
        n.delete('edit')
        return n
      }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, draft])

  const deleteNode = useCallback(
    (nodeId: string) => {
      const n = draft?.nodes.find((x) => x.id === nodeId)
      if (!n || !confirm(`Delete “${n.label}” and its connections?`)) return
      update((w) => ({ ...w, nodes: w.nodes.filter((x) => x.id !== nodeId), edges: w.edges.filter((e) => e.source !== nodeId && e.target !== nodeId) }))
      select(null)
    },
    [draft, update, select],
  )

  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) deleteNode(selectedId)
        else if (edgeSel) {
          update((w) => ({ ...w, edges: w.edges.filter((x) => x.id !== edgeSel) }))
          setEdgeSel(null)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, selectedId, edgeSel, deleteNode, update])

  const arrange = (direction?: 'TB' | 'LR') => {
    update((w) => {
      const dir = direction || w.direction || 'TB'
      return { ...w, direction: dir, nodes: autoLayout(w.nodes, w.edges, dir) }
    })
    setTimeout(fit, 60)
  }

  const doSave = async () => {
    if (!draft) return
    setSaving(true)
    try {
      await save(draft, { note: 'Edited workflow map' })
      setDirty(false)
    } catch {
      /* toast shown */
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    if (!wf || wf.type !== 'workflow') return
    if (dirty && !confirm('Discard your unsaved changes?')) return
    setDraft(prepare(wf))
    setDirty(false)
    setEditing(false)
    setEdgeSel(null)
  }

  if (!wf || wf.type !== 'workflow' || !draft) return <NotFound what="workflow" />

  const selected = draft.nodes.find((n) => n.id === selectedId)
  const edge = draft.edges.find((e) => e.id === edgeSel)
  const dept = atlas.get(draft.departmentIds[0])
  const accent = dept?.type === 'department' ? ACCENTS[dept.accent].color : 'var(--glacier)'
  const backTo = dept ? hrefFor(dept) : '/workflows'

  const panelOpen = Boolean(selected || edge || panel === 'info')

  return (
    <div className={`explorer ${panelOpen ? 'has-panel' : ''} ${editing ? 'is-editing' : ''}`} style={{ '--accent': accent } as React.CSSProperties}>
      <header className="xbar">
        <button
          className="iconbtn iconbtn--lg"
          onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate(backTo))}
          aria-label="Back"
        >
          <Icon name="back" />
        </button>
        <div className="xbar__title">
          <div className="xbar__kicker">
            {dept && <Link to={backTo}>{dept.type === 'department' ? dept.code : ''}</Link>}
            <span className="mono">{draft.code}</span>
            <StatusBadge status={draft.status} compact />
            {draft.illustrative && <span className="tag tag--illus">Illustrative</span>}
          </div>
          <h1>{draft.title}</h1>
        </div>
        <div className="xbar__actions">
          <div className="seg seg--icons" role="tablist" aria-label="View">
            <button role="tab" aria-selected={view === 'map'} className={`seg__opt ${view === 'map' ? 'is-on' : ''}`} onClick={() => setView('map')} aria-label="Map view">
              <Icon name="map" size={18} />
            </button>
            <button role="tab" aria-selected={view === 'steps'} className={`seg__opt ${view === 'steps' ? 'is-on' : ''}`} onClick={() => setView('steps')} aria-label="Step list view">
              <Icon name="list" size={18} />
            </button>
          </div>
          <button className={`iconbtn iconbtn--lg ${panel === 'info' ? 'is-active' : ''}`} onClick={() => { select(null); setPanel(panel === 'info' ? 'none' : 'info') }} aria-label="Workflow details">
            <Icon name="info" />
          </button>
          {!editing && (
            <button className="iconbtn iconbtn--lg" onClick={() => (canEdit ? setEditing(true) : requestEdit())} aria-label="Edit workflow map">
              <Icon name={canEdit ? 'edit' : 'lock'} />
            </button>
          )}
        </div>
      </header>

      {view === 'map' ? (
        <div className="canvas" ref={wrap}>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={() => {
              select(null)
              setPanel('none')
            }}
            onInit={onInit}
            nodesDraggable={editing}
            nodesConnectable={editing}
            elementsSelectable
            selectNodesOnDrag={false}
            deleteKeyCode={null}
            fitView={!selectedId}
            fitViewOptions={{ padding: isMobile ? 0.12 : 0.18, maxZoom: 1.1 }}
            minZoom={0.15}
            maxZoom={2.2}
            zoomOnPinch
            zoomOnScroll={false}
            panOnScroll
            panOnDrag
            zoomOnDoubleClick
            preventScrolling
            proOptions={{ hideAttribution: true }}
            connectionRadius={36}
            snapToGrid={editing}
            snapGrid={[8, 8]}
          >
            <Background variant={BackgroundVariant.Dots} gap={28} size={1.2} color="rgba(243,239,230,0.09)" />
            {showMini && (
              <MiniMap
                pannable
                zoomable
                className="minimap"
                maskColor="rgba(10,13,15,0.72)"
                nodeColor={(n) => {
                  const k = (n.data as any)?.node?.kind as NodeKind
                  return k === 'warning' ? '#e8742a' : k === 'decision' ? '#8db3c7' : k === 'unknown' ? '#5c666c' : k === 'link' ? accent : '#d9d4c8'
                }}
                nodeBorderRadius={2}
                ariaLabel="Overview of the whole workflow"
              />
            )}
          </ReactFlow>

          <div className="xcontrols" role="toolbar" aria-label="Map controls">
            <button className="xctl" onClick={() => rf.zoomIn({ duration: 200 })} aria-label="Zoom in">
              <Icon name="zoomIn" />
            </button>
            <button className="xctl" onClick={() => rf.zoomOut({ duration: 200 })} aria-label="Zoom out">
              <Icon name="zoomOut" />
            </button>
            <button className="xctl" onClick={fit} aria-label="Fit whole workflow">
              <Icon name="fit" />
            </button>
            <button className="xctl" onClick={() => selectedId && centerOn(selectedId, { zoom: 1 })} disabled={!selectedId} aria-label="Center selected step">
              <Icon name="target" />
            </button>
            <button className={`xctl ${showMini ? 'is-on' : ''}`} onClick={() => setShowMini((s) => !s)} aria-label={showMini ? 'Hide minimap' : 'Show minimap'} aria-pressed={showMini}>
              <Icon name="minimap" />
            </button>
          </div>

          {hint && !editing && !panelOpen && (
            <div className="xhint" role="note">
              <Icon name="info" size={16} />
              {isMobile ? 'Pinch to zoom · drag to pan · tap a step' : 'Scroll or pinch to zoom · drag to pan · click a step'}
            </div>
          )}
        </div>
      ) : (
        <StepsList wf={draft} order={order} selectedId={selectedId} onSelect={select} />
      )}

      {editing && (
        <div className="xedit" role="toolbar" aria-label="Editing tools">
          <div className="xedit__add">
            <button className="btn btn--primary" onClick={() => setAddMenu((m) => !m)} aria-expanded={addMenu}>
              <Icon name="plus" size={18} /> Add{selected ? ' after' : ''}
            </button>
            {addMenu && (
              <div className="xedit__menu" role="menu">
                {(['step', 'decision', 'warning', 'parallel', 'link', 'unknown', 'end'] as NodeKind[]).map((k) => (
                  <button key={k} role="menuitem" onClick={() => addNode(k)}>
                    <NodeGlyph kind={k} size={14} />
                    <span>
                      <b>{NODE_META[k].label}</b>
                      <small>{NODE_META[k].help}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn--ghost" onClick={() => arrange()} title="Tidy the layout automatically">
            <Icon name="arrange" size={18} />
            <span className="hide-s">Arrange</span>
          </button>
          <button className="btn btn--ghost hide-s" onClick={() => arrange((draft.direction || 'TB') === 'TB' ? 'LR' : 'TB')} title="Switch between vertical and horizontal">
            <Icon name="split" size={18} /> {(draft.direction || 'TB') === 'TB' ? 'Horizontal' : 'Vertical'}
          </button>
          <span className="grow" />
          <button className="btn btn--ghost" onClick={discard}>
            {dirty ? 'Discard' : 'Done'}
          </button>
          <button className="btn btn--primary" onClick={doSave} disabled={!dirty || saving}>
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      )}

      {/* Node detail / editor */}
      <Sheet
        open={Boolean(selected)}
        onClose={() => select(null)}
        size={size}
        onSizeChange={setSize}
        className="sheet--explorer"
        kicker={
          selected && (
            <span className="row gap-s">
              <NodeGlyph kind={selected.kind} size={12} />
              {NODE_META[selected.kind].label} · <span className="mono">{String(indexOf.get(selected.id) || 0).padStart(2, '0')}</span>
              {selected.status && <StatusBadge status={selected.status} compact />}
            </span>
          )
        }
        title={selected?.label}
        footer={
          selected && !editing ? (
            <StepNav order={order} current={selected.id} onSelect={select} />
          ) : undefined
        }
      >
        {selected &&
          (editing ? (
            <NodeEditor
              wf={draft}
              node={selected}
              onChange={(patch) => update((w) => ({ ...w, nodes: w.nodes.map((n) => (n.id === selected.id ? { ...n, ...patch } : n)) }))}
              onDelete={() => deleteNode(selected.id)}
              onConnect={(t) => connect(selected.id, t)}
              onEdgeChange={(eid, patch) => update((w) => ({ ...w, edges: w.edges.map((e) => (e.id === eid ? { ...e, ...patch } : e)) }))}
              onEdgeDelete={(eid) => update((w) => ({ ...w, edges: w.edges.filter((e) => e.id !== eid) }))}
            />
          ) : (
            <NodeDetail
              wf={draft}
              node={selected}
              onSelect={(nid) => select(nid)}
              onEdit={canEdit ? () => setEditing(true) : undefined}
            />
          ))}
      </Sheet>

      <Sheet open={Boolean(edge) && editing} onClose={() => setEdgeSel(null)} size="half" kicker="Connection" title="Edit connection" className="sheet--explorer">
        {edge && (
          <EdgeEditor
            wf={draft}
            edge={edge}
            onChange={(patch) => update((w) => ({ ...w, edges: w.edges.map((e) => (e.id === edge.id ? { ...e, ...patch } : e)) }))}
            onDelete={() => {
              update((w) => ({ ...w, edges: w.edges.filter((e) => e.id !== edge.id) }))
              setEdgeSel(null)
            }}
          />
        )}
      </Sheet>

      <Sheet
        open={panel === 'info' && !selected}
        onClose={() => setPanel('none')}
        size={size}
        onSizeChange={setSize}
        kicker={`Workflow · ${draft.code || ''}`}
        title={draft.title}
        className="sheet--explorer"
        footer={
          <div className="row gap-s">
            <button className="btn btn--ghost" onClick={() => (canEdit ? (dirty ? alert('Save or discard your map changes first.') : setEditMeta(true)) : requestEdit())}>
              <Icon name="edit" size={16} /> Edit details
            </button>
            <button className="btn btn--ghost" onClick={() => setHistory(true)}>
              <Icon name="history" size={16} /> History
            </button>
          </div>
        }
      >
        <WorkflowInfo wf={draft} onSelect={select} />
      </Sheet>

      <EntityEditor entity={wf} open={editMeta} onClose={() => setEditMeta(false)} />
      <HistoryPanel entity={wf} open={history} onClose={() => setHistory(false)} />
    </div>
  )
}

function StepNav({ order, current, onSelect }: { order: FlowNode[]; current: string; onSelect: (id: string) => void }) {
  const i = order.findIndex((n) => n.id === current)
  const prev = order[i - 1]
  const next = order[i + 1]
  return (
    <div className="stepnav">
      <button className="btn btn--ghost" disabled={!prev} onClick={() => prev && onSelect(prev.id)} aria-label="Previous step">
        <Icon name="back" size={16} /> Prev
      </button>
      <span className="mono muted">
        {i + 1} / {order.length}
      </span>
      <button className="btn btn--ghost" disabled={!next} onClick={() => next && onSelect(next.id)} aria-label="Next step">
        Next <Icon name="chevron" size={16} />
      </button>
    </div>
  )
}

function StepsList({ wf, order, selectedId, onSelect }: { wf: Workflow; order: FlowNode[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const byId = new Map(wf.nodes.map((n) => [n.id, n]))
  return (
    <div className="stepslist">
      <ol>
        {order.map((n, i) => {
          const out = wf.edges.filter((e) => e.source === n.id)
          return (
            <li key={n.id} className={`steprow steprow--${n.kind} ${selectedId === n.id ? 'is-on' : ''}`}>
              <button onClick={() => onSelect(n.id)}>
                <span className="steprow__num mono">{String(i + 1).padStart(2, '0')}</span>
                <NodeGlyph kind={n.kind} size={14} />
                <span className="steprow__main">
                  <span className="steprow__kind">{NODE_META[n.kind].label}</span>
                  <span className="steprow__label">{n.label}</span>
                  {out.length > 1 || out.some((e) => e.label) ? (
                    <span className="steprow__out">
                      {out.map((e) => (
                        <span key={e.id}>
                          {e.label ? `${e.label} → ` : '→ '}
                          {byId.get(e.target)?.label}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
                {n.status && <StatusBadge status={n.status} compact />}
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
