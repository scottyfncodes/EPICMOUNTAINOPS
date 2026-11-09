import {
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type EdgeMouseHandler,
  type NodeChange,
  type FitViewOptions,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/base.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { EdgeKind, FlowNode, NodeKind, Workflow } from '../../shared/types'
import { validateWorkflowGraph } from '../../shared/validate'
import { EntityEditor, HistoryPanel } from '../components/Editor'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { Emblem, NodeGlyph, StatusBadge, StatusGlyph } from '../components/ui'
import { autoLayout, flowOrder, NODE_SIZE, needsLayout } from '../lib/layout'
import { ACCENTS, hrefFor, NODE_META, relTime, STATUS_META } from '../lib/meta'
import { useCaptureTarget } from '../lib/capture'
import { pushRecent, useAtlas, useStore } from '../lib/store'
import { useMediaQuery } from '../lib/useMediaQuery'
import { NotFound } from '../pages/NotFound'
import { edgeTypes, type OpsRFEdge } from './edges'
import { nodeTypes, type OpsRFNode } from './nodes'
import { Guide } from './Guide'
import { EdgeEditor, NodeDetail, NodeEditor, WorkflowInfo } from './Panels'
import { effectiveStatus, lensMark, LENSES, routeAll, systemsInWorkflow, type Lens } from './routing'
import { clearStoredDraft, readStoredDraft, useDraft } from './useDraft'

export function WorkflowExplorer() {
  const { id } = useParams()
  return (
    <ReactFlowProvider key={id}>
      <ExplorerInner id={id!} />
    </ReactFlowProvider>
  )
}

const MARKER: Record<EdgeKind | 'hot', string> = {
  normal: '#7d878d',
  yes: '#7fa88c',
  no: '#e8742a',
  branch: '#6b767c',
  loop: '#8db3c7',
  hot: '#f3efe6',
}

function prepare(wf: Workflow): Workflow {
  return needsLayout(wf.nodes) ? { ...wf, nodes: autoLayout(wf.nodes, wf.edges, wf.direction || 'TB') } : wf
}

const rid = (k: string) => `${k}-${Math.random().toString(36).slice(2, 7)}`
const LAST_LENS = 'ops.lens'

export interface CameFrom {
  id: string
  code?: string
  title: string
  nodeId?: string
}

function ExplorerInner({ id }: { id: string }) {
  const atlas = useAtlas()
  const { canEdit, requestEdit, save, toast } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const rf = useReactFlow()
  const narrow = useMediaQuery('(max-width: 899px)')
  // Phones on their side: the panel docks beside the map instead of covering it.
  const shortLandscape = useMediaQuery('(orientation: landscape) and (max-height: 500px)')
  const isMobile = narrow && !shortLandscape
  const panelWidth = shortLandscape ? Math.min(380, Math.round(window.innerWidth * 0.48)) : 440
  const wf = atlas.get<Workflow>(id)
  const cameFrom = (location.state as { from?: CameFrom } | null)?.from

  const { draft, dirty, update, undo, redo, reset, canUndo, canRedo, getCurrent, isDirty } = useDraft(wf && wf.type === 'workflow' ? prepare(wf) : null)
  const [restored, setRestored] = useState<string | null>(null)
  const [editing, setEditing] = useState(params.get('edit') === '1' && canEdit)
  // ?view= wins; editing always starts on the map; otherwise the workflow's own preference.
  const [view, setView] = useState<'map' | 'guide'>(() => {
    const v = params.get('view')
    if (v === 'guide' || v === 'map') return v
    if (params.get('edit') === '1') return 'map'
    return wf?.type === 'workflow' && wf.defaultView === 'guide' ? 'guide' : 'map'
  })
  const [panel, setPanel] = useState<'none' | 'info'>('none')
  const [size, setSize] = useState<'half' | 'full'>('half')
  const [edgeSel, setEdgeSel] = useState<string | null>(null)
  const [showMini, setShowMini] = useState(!isMobile)
  const [addMenu, setAddMenu] = useState(false)
  const [editMeta, setEditMeta] = useState(false)
  const [history, setHistory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hint, setHint] = useState(true)
  const [lens, setLensState] = useState<Lens>(() => {
    try {
      return (localStorage.getItem(LAST_LENS) as Lens) || 'flow'
    } catch {
      return 'flow'
    }
  })
  const [lensSystem, setLensSystem] = useState<string | undefined>()
  const [dims, setDims] = useState<Record<string, { width: number; height: number }>>({})
  const wrap = useRef<HTMLDivElement>(null)
  const selectedId = params.get('node')

  const setLens = (l: Lens) => {
    setLensState(l)
    try {
      localStorage.setItem(LAST_LENS, l)
    } catch {
      /* ignore */
    }
  }

  // Offer to restore an autosaved draft made against this exact version.
  useEffect(() => {
    if (!wf || wf.type !== 'workflow') return
    const stored = readStoredDraft(wf)
    if (stored && JSON.stringify(stored.draft) !== JSON.stringify(wf)) {
      reset(prepare(stored.draft), true)
      setRestored(stored.savedAt)
      if (canEdit) setEditing(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wf?.id])

  // Pick up a newer server version when there are no local edits.
  useEffect(() => {
    if (!wf || wf.type !== 'workflow') return
    if (getCurrent()?.updatedAt === wf.updatedAt) return
    if (!isDirty()) reset(prepare(wf))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wf?.updatedAt])

  useEffect(() => {
    if (wf) pushRecent({ type: 'workflow', id: wf.id, ...(selectedId ? { nodeId: selectedId } : {}) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wf?.id, selectedId])

  useEffect(() => {
    if (params.get('edit') === '1' && canEdit) setEditing(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit])

  // Unsaved-change guards (the draft is also autosaved on the device).
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (confirm('This workflow has unsaved changes. They stay saved on this device — leave anyway?')) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

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
        cx += panelWidth / 2 / z
      }
      rf.setCenter(cx, cy, { zoom: z, duration: 450 })
    },
    [draft, rf, isMobile, size, panelWidth],
  )

  // Leave room for the controls (right) and the lens bar (bottom).
  type Padding = NonNullable<FitViewOptions['padding']>
  const fitPadding = useMemo(
    (): Padding => (isMobile ? { top: '24px', right: '64px', bottom: '96px', left: '16px' } as Padding : ({ top: '40px', right: '80px', bottom: '110px', left: '40px' } as Padding)),
    [isMobile],
  )
  const fit = useCallback(() => rf.fitView({ padding: fitPadding, duration: 450, maxZoom: 1.1 }), [rf, fitPadding])

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
  const systemsHere = useMemo(() => (draft ? systemsInWorkflow(draft) : []), [draft])
  const activeSystem = lens === 'systems' ? lensSystem ?? systemsHere[0]?.id : undefined

  const rfNodes: OpsRFNode[] = useMemo(() => {
    if (!draft) return []
    return draft.nodes.map((n) => {
      const target = n.kind === 'link' ? atlas.get<Workflow>(n.linkWorkflowId) : undefined
      const tdept = target ? atlas.get(target.departmentIds[0]) : undefined
      const st = effectiveStatus(n, draft)
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
          linkDept: tdept?.type === 'department' ? tdept.code : undefined,
          linkAccent: tdept?.type === 'department' ? ACCENTS[tdept.accent].color : undefined,
          noteCount: atlas.notesFor('workflow', draft.id, n.id).filter((x) => !x.resolved).length,
          dimmed: Boolean(selectedId) && !neighbors.has(n.id),
          lens: lensMark(lens, n, draft, activeSystem),
          status: st.status,
          statusInherited: st.inherited,
        },
      }
    })
  }, [draft, selectedId, editing, atlas, indexOf, neighbors, dims, lens, activeSystem])

  const onLabelTap = useCallback((edgeId: string) => {
    setEdgeSel(edgeId)
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        next.delete('node')
        return next
      },
      { replace: true },
    )
  }, [setParams])

  const rfEdges: OpsRFEdge[] = useMemo(() => {
    if (!draft) return []
    const byId = new Map(draft.nodes.map((n) => [n.id, n]))
    const dir = draft.direction || 'TB'
    const routes = routeAll(draft.nodes, draft.edges, dir)
    return draft.edges.flatMap((e) => {
      const s = byId.get(e.source)
      const t = byId.get(e.target)
      if (!s || !t) return []
      const kind = e.kind || 'normal'
      const hot = Boolean(selectedId && (e.source === selectedId || e.target === selectedId)) || e.id === edgeSel
      const dim = Boolean(selectedId) && !hot
      const route = routes.get(e.id)!
      return [
        {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: `s-${route.from}`,
          targetHandle: `t-${route.to}`,
          type: 'ops',
          label: e.label,
          selected: e.id === edgeSel,
          markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: hot ? MARKER.hot : MARKER[kind] },
          data: { kind, hot, dim, editing, offset: route.offset, onLabelTap: editing ? onLabelTap : undefined },
        } as OpsRFEdge,
      ]
    })
  }, [draft, selectedId, edgeSel, editing, onLabelTap])

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
      update(
        (w) => ({
          ...w,
          nodes: w.nodes.map((n) => {
            const m = moves.find((c) => c.id === n.id)
            return m ? { ...n, x: Math.round(m.position.x), y: Math.round(m.position.y) } : n
          }),
        }),
        `move:${moves.map((m) => m.id).join(',')}`,
      )
    },
    [editing, update],
  )

  const onNodeClick: NodeMouseHandler<OpsRFNode> = useCallback((_, node) => select(node.id), [select])
  const onEdgeClick: EdgeMouseHandler<OpsRFEdge> = useCallback(
    (_, edge) => {
      if (!editing) return
      onLabelTap(edge.id)
    },
    [editing, onLabelTap],
  )

  const connect = useCallback(
    (source: string, target: string, kind?: EdgeKind, label?: string) => {
      if (source === target) return
      update((w) => {
        if (w.edges.some((e) => e.source === source && e.target === target)) return w
        const src = w.nodes.find((n) => n.id === source)
        const k: EdgeKind = kind ?? (src?.kind === 'parallel' ? 'branch' : 'normal')
        return { ...w, edges: [...w.edges, { id: `${source}->${target}-${Math.random().toString(36).slice(2, 5)}`, source, target, kind: k, ...(label ? { label } : {}) }] }
      })
    },
    [update],
  )
  const onConnect = useCallback((c: Connection) => c.source && c.target && connect(c.source, c.target), [connect])

  /** Find free space for a new node near `pos`. */
  const freeSpot = useCallback(
    (w: Workflow, kind: NodeKind, pos: { x: number; y: number }, step: { x: number; y: number }) => {
      const s = NODE_SIZE[kind]
      const overlaps = (p: { x: number; y: number }) =>
        w.nodes.some((o) => {
          if (o.x === undefined || o.y === undefined) return false
          const os = NODE_SIZE[o.kind]
          return p.x < o.x + os.w + 16 && p.x + s.w + 16 > o.x && p.y < o.y + os.h + 16 && p.y + s.h + 16 > o.y
        })
      let p = pos
      for (let i = 0; i < 60 && overlaps(p); i++) p = { x: p.x + step.x, y: p.y + step.y }
      return { x: Math.round(p.x), y: Math.round(p.y) }
    },
    [],
  )

  const newNode = (kind: NodeKind, extra: Partial<FlowNode> = {}): FlowNode => ({
    id: rid(kind),
    kind,
    label:
      kind === 'decision' ? 'New decision?' : kind === 'end' ? 'End' : kind === 'parallel' ? 'In parallel' : kind === 'unknown' ? 'Unknown step' : `New ${NODE_META[kind].label.toLowerCase()}`,
    status: 'unverified',
    ...extra,
  })

  const focusNew = (nodeId: string) => {
    setAddMenu(false)
    select(nodeId)
    setSize(isMobile ? 'full' : 'half')
    setTimeout(() => centerOn(nodeId), 60)
  }

  /** Add a node after `afterId` (or the selected node, or in view). */
  const addNode = useCallback(
    (kind: NodeKind, afterId?: string | null) => {
      if (!draft) return
      const s = NODE_SIZE[kind]
      const dir = draft.direction || 'TB'
      const from = draft.nodes.find((n) => n.id === (afterId ?? selectedId))
      let pos: { x: number; y: number }
      if (from && from.x !== undefined && from.y !== undefined) {
        const fs = NODE_SIZE[from.kind]
        pos = dir === 'TB' ? { x: from.x + fs.w / 2 - s.w / 2, y: from.y + fs.h + 70 } : { x: from.x + fs.w + 90, y: from.y }
      } else {
        const r = wrap.current?.getBoundingClientRect()
        const c = rf.screenToFlowPosition({ x: (r?.left || 0) + (r?.width || 400) / 2, y: (r?.top || 0) + (r?.height || 400) / 3 })
        pos = { x: c.x - s.w / 2, y: c.y - s.h / 2 }
      }
      const spot = freeSpot(draft, kind, pos, from ? (dir === 'TB' ? { x: s.w / 2 + 24, y: 0 } : { x: 0, y: s.h + 24 }) : { x: 0, y: 48 })
      const node = newNode(kind, spot)
      update((w) => ({
        ...w,
        nodes: [...w.nodes, node],
        edges: from ? [...w.edges, { id: `${from.id}->${node.id}`, source: from.id, target: node.id, kind: from.kind === 'parallel' ? 'branch' : 'normal' }] : w.edges,
      }))
      focusNew(node.id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, selectedId, rf, update, select, isMobile, centerOn, freeSpot],
  )

  /** Split a connection by inserting a new step in the middle of it. */
  const insertOnEdge = useCallback(
    (edgeId: string, kind: NodeKind = 'step') => {
      if (!draft) return
      const e = draft.edges.find((x) => x.id === edgeId)
      const s = draft.nodes.find((n) => n.id === e?.source)
      const t = draft.nodes.find((n) => n.id === e?.target)
      if (!e || !s || !t) return
      const ns = NODE_SIZE[kind]
      const mid = {
        x: ((s.x ?? 0) + NODE_SIZE[s.kind].w / 2 + (t.x ?? 0) + NODE_SIZE[t.kind].w / 2) / 2 - ns.w / 2,
        y: ((s.y ?? 0) + NODE_SIZE[s.kind].h / 2 + (t.y ?? 0) + NODE_SIZE[t.kind].h / 2) / 2 - ns.h / 2,
      }
      const node = newNode(kind, freeSpot(draft, kind, mid, { x: ns.w / 2 + 24, y: 0 }))
      update((w) => ({
        ...w,
        nodes: [...w.nodes, node],
        edges: [
          ...w.edges.filter((x) => x.id !== edgeId),
          { id: `${e.source}->${node.id}`, source: e.source, target: node.id, kind: e.kind, ...(e.label ? { label: e.label } : {}) },
          { id: `${node.id}->${e.target}`, source: node.id, target: e.target, kind: e.kind === 'loop' ? 'loop' : 'normal' },
        ],
      }))
      setEdgeSel(null)
      focusNew(node.id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, update, freeSpot],
  )

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const n = draft?.nodes.find((x) => x.id === nodeId)
      if (!n || !draft) return
      const copy: FlowNode = { ...n, id: rid(n.kind), label: `${n.label} (copy)`, ...freeSpot(draft, n.kind, { x: (n.x ?? 0) + 40, y: (n.y ?? 0) + 40 }, { x: 0, y: 48 }) }
      update((w) => ({ ...w, nodes: [...w.nodes, copy] }))
      focusNew(copy.id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, update, freeSpot],
  )

  // ?add=step[&after=nodeId] from the capture sheet / Add Information page
  const addedOnce = useRef(false)
  useEffect(() => {
    if (editing && params.get('add') === 'step' && draft && !addedOnce.current) {
      addedOnce.current = true
      const after = params.get('after') || order[order.length - 1]?.id || null
      setParams(
        (p) => {
          const n = new URLSearchParams(p)
          n.delete('add')
          n.delete('edit')
          n.delete('after')
          return n
        },
        { replace: true },
      )
      setTimeout(() => addNode('step', after), 300)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, draft])

  const deleteNode = useCallback(
    (nodeId: string) => {
      const n = draft?.nodes.find((x) => x.id === nodeId)
      if (!n || !confirm(`Delete “${n.label}” and its connections? You can undo this until you save.`)) return
      update((w) => ({ ...w, nodes: w.nodes.filter((x) => x.id !== nodeId), edges: w.edges.filter((e) => e.source !== nodeId && e.target !== nodeId) }))
      select(null)
    },
    [draft, update, select],
  )

  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (t.closest('input, textarea, select, [contenteditable]')) return
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
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
  }, [editing, selectedId, edgeSel, deleteNode, update, undo, redo])

  const arrange = (direction?: 'TB' | 'LR') => {
    update((w) => {
      const dir = direction || w.direction || 'TB'
      return { ...w, direction: dir, nodes: autoLayout(w.nodes, w.edges, dir) }
    })
    setTimeout(fit, 60)
  }

  const doSave = async () => {
    if (!draft) return
    const problem = validateWorkflowGraph(draft.nodes, draft.edges)
    if (problem) {
      toast(problem, 'error')
      return
    }
    setSaving(true)
    try {
      await save(draft, { note: 'Edited workflow map' })
      clearStoredDraft(draft.id)
      setRestored(null)
      reset(draft, false)
    } catch {
      /* toast shown by the store */
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    if (!wf || wf.type !== 'workflow') return
    if (dirty && !confirm('Discard your unsaved changes to this workflow?')) return
    clearStoredDraft(wf.id)
    setRestored(null)
    reset(prepare(wf))
    setEditing(false)
    setEdgeSel(null)
  }

  // New captures link to this workflow (and the selected step). While editing,
  // screenshots attach to the working draft so they can't race an unsaved edit.
  const attachRef = useRef<(imageId: string) => void>(() => {})
  attachRef.current = (imageId: string) => {
    const nid = selectedId
    update((w) => (nid ? { ...w, nodes: w.nodes.map((n) => (n.id === nid ? { ...n, imageIds: [...new Set([...(n.imageIds || []), imageId])] } : n)) } : { ...w, imageIds: [...new Set([...(w.imageIds || []), imageId])] }))
  }
  const selNode = draft?.nodes.find((n) => n.id === selectedId)
  useCaptureTarget(
    draft
      ? {
          type: 'workflow',
          id: draft.id,
          nodeId: selNode?.id,
          label: selNode ? `${draft.code ? draft.code + ' › ' : ''}${selNode.label}` : `${draft.code ? draft.code + ' ' : ''}${draft.title}`,
          onAttachImage: editing ? (imageId) => attachRef.current(imageId) : undefined,
        }
      : null,
  )

  if (!wf || wf.type !== 'workflow' || !draft) return <NotFound what="workflow" />

  const selected = draft.nodes.find((n) => n.id === selectedId)
  const edge = draft.edges.find((e) => e.id === edgeSel)
  const dept = atlas.get(draft.departmentIds[0])
  const accent = dept?.type === 'department' ? ACCENTS[dept.accent].color : 'var(--glacier)'
  const backTo = dept ? hrefFor(dept) : '/workflows'
  const panelOpen = Boolean((selected && view === 'map') || edge || panel === 'info')
  const here: CameFrom = { id: draft.id, code: draft.code, title: draft.title, nodeId: selectedId || undefined }

  return (
    <div className={`explorer ${panelOpen ? 'has-panel' : ''} ${editing ? 'is-editing' : ''} lens-${lens}`} style={{ '--accent': accent } as React.CSSProperties}>
      <header className="xbar">
        <button className="iconbtn iconbtn--lg" onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate(backTo))} aria-label="Back">
          <Icon name="back" />
        </button>
        <div className="xbar__title">
          <div className="xbar__kicker">
            {dept && dept.type === 'department' && (
              <Link to={backTo} className="xbar__dept">
                <Emblem dept={dept} size={16} />
                {dept.code}
              </Link>
            )}
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
            <button role="tab" aria-selected={view === 'guide'} className={`seg__opt ${view === 'guide' ? 'is-on' : ''}`} onClick={() => setView('guide')} aria-label="Field guide view">
              <Icon name="book" size={18} />
            </button>
          </div>
          <button
            className={`iconbtn iconbtn--lg ${panel === 'info' ? 'is-active' : ''}`}
            onClick={() => {
              select(null)
              setPanel(panel === 'info' ? 'none' : 'info')
            }}
            aria-label="Workflow details"
          >
            <Icon name="info" />
          </button>
          {!editing && (
            <button className="iconbtn iconbtn--lg" onClick={() => (canEdit ? setEditing(true) : requestEdit())} aria-label="Edit workflow map">
              <Icon name={canEdit ? 'edit' : 'lock'} />
            </button>
          )}
        </div>
      </header>

      {cameFrom && cameFrom.id !== draft.id && (
        <Link className="camefrom" to={hrefFor({ type: 'workflow', id: cameFrom.id }, cameFrom.nodeId)} viewTransition>
          <Icon name="back" size={14} /> From <span className="mono">{cameFrom.code}</span> {cameFrom.title}
        </Link>
      )}

      {restored && (
        <div className="restored" role="status">
          <Icon name="history" size={16} />
          <span>Unsaved edits from {relTime(restored)} restored on this device.</span>
          <button className="btn btn--ghost btn--small" onClick={discard}>
            Discard
          </button>
        </div>
      )}

      {view === 'map' ? (
        <div className="canvas" ref={wrap}>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={() => {
              select(null)
              setPanel('none')
              setAddMenu(false)
            }}
            onInit={onInit}
            nodesDraggable={editing}
            nodesConnectable={editing}
            elementsSelectable
            selectNodesOnDrag={false}
            deleteKeyCode={null}
            fitView={!selectedId}
            fitViewOptions={{ padding: fitPadding, maxZoom: 1.1 }}
            minZoom={0.15}
            maxZoom={2.2}
            zoomOnPinch
            zoomOnScroll={false}
            panOnScroll
            panOnDrag
            zoomOnDoubleClick
            preventScrolling
            proOptions={{ hideAttribution: true }}
            connectionRadius={40}
            snapToGrid={editing}
            snapGrid={[8, 8]}
          >
            <Background variant={BackgroundVariant.Dots} gap={28} size={1.2} color="rgba(243,239,230,0.08)" />
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

          {!editing && !panelOpen && (
            <div className="lensbar" role="toolbar" aria-label="Map lens">
              <div className="lensbar__opts" role="radiogroup" aria-label="Read the map by">
                {LENSES.map((l) => (
                  <button key={l.id} role="radio" aria-checked={lens === l.id} className={`lensbar__opt ${lens === l.id ? 'is-on' : ''}`} onClick={() => setLens(l.id)} title={l.help}>
                    {l.label}
                  </button>
                ))}
              </div>
              {lens === 'status' && (
                <div className="lensbar__legend">
                  {(['verified', 'observed', 'unverified', 'outdated'] as const).map((s) => (
                    <span key={s} className={`status--${s}`}>
                      <StatusGlyph status={s} /> {STATUS_META[s].label}
                    </span>
                  ))}
                </div>
              )}
              {lens === 'gaps' && (
                <div className="lensbar__legend">
                  <span>
                    {draft.nodes.filter((n) => n.kind === 'unknown').length} unknown · {rfNodes.filter((n) => n.data.lens.tone === 'gap' && n.data.node.kind !== 'unknown').length} missing what/why/who
                  </span>
                </div>
              )}
              {lens === 'systems' && (
                <div className="lensbar__legend lensbar__legend--scroll">
                  {systemsHere.length === 0 && <span>No systems linked yet.</span>}
                  {systemsHere.map((s) => {
                    const e = atlas.get(s.id)
                    if (!e) return null
                    return (
                      <button key={s.id} className={`lenschip ${activeSystem === s.id ? 'is-on' : ''}`} onClick={() => setLensSystem(s.id)}>
                        {e.title} <span className="mono">{s.count}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {hint && !editing && !panelOpen && lens === 'flow' && (
            <div className="xhint" role="note">
              <Icon name="info" size={16} />
              {isMobile ? 'Pinch to zoom · drag to pan · tap a step' : 'Scroll or pinch to zoom · drag to pan · click a step'}
            </div>
          )}
        </div>
      ) : (
        <Guide
          wf={draft}
          order={order}
          selectedId={selectedId}
          from={here}
          onShowOnMap={(nid) => {
            setView('map')
            select(nid)
            setTimeout(() => centerOn(nid, { zoom: 1 }), 120)
          }}
        />
      )}

      {editing && (
        <div className="xedit" role="toolbar" aria-label="Editing tools">
          <div className="xedit__add">
            <button className="btn btn--primary" onClick={() => setAddMenu((m) => !m)} aria-expanded={addMenu} aria-haspopup="menu">
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
          <button className="iconbtn iconbtn--lg" onClick={undo} disabled={!canUndo} aria-label="Undo">
            <Icon name="undo" />
          </button>
          <button className="iconbtn iconbtn--lg" onClick={redo} disabled={!canRedo} aria-label="Redo">
            <Icon name="undo" style={{ transform: 'scaleX(-1)' }} />
          </button>
          <button className="iconbtn iconbtn--lg" onClick={() => arrange()} aria-label="Tidy layout automatically" title="Arrange">
            <Icon name="arrange" />
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

      {/* Step detail / editor */}
      <Sheet
        open={Boolean(selected) && view === 'map'}
        onClose={() => select(null)}
        size={size}
        onSizeChange={setSize}
        className="sheet--explorer sheet--page"
        kicker={
          selected && (
            <span className="row gap-s">
              <NodeGlyph kind={selected.kind} size={12} />
              {NODE_META[selected.kind].label} · <span className="mono">{String(indexOf.get(selected.id) || 0).padStart(2, '0')}</span>
              <StatusBadge status={effectiveStatus(selected, draft).status} compact inherited={!selected.status} />
            </span>
          )
        }
        title={selected?.label}
        footer={
          selected && !editing ? (
            <StepNav order={order} current={selected.id} onSelect={select} />
          ) : selected && editing ? (
            <div className="row gap-s">
              <button className="iconbtn iconbtn--lg" onClick={undo} disabled={!canUndo} aria-label="Undo">
                <Icon name="undo" />
              </button>
              <button className="iconbtn iconbtn--lg" onClick={redo} disabled={!canRedo} aria-label="Redo">
                <Icon name="undo" style={{ transform: 'scaleX(-1)' }} />
              </button>
              <span className="grow" />
              <button className="btn btn--ghost" onClick={() => select(null)}>
                Close
              </button>
              <button className="btn btn--primary" onClick={doSave} disabled={!dirty || saving}>
                {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
              </button>
            </div>
          ) : undefined
        }
      >
        {selected &&
          (editing ? (
            <NodeEditor
              wf={draft}
              node={selected}
              onChange={(patch, group) => update((w) => ({ ...w, nodes: w.nodes.map((n) => (n.id === selected.id ? { ...n, ...patch } : n)) }), group)}
              onDelete={() => deleteNode(selected.id)}
              onConnect={(t, kind, label) => connect(selected.id, t, kind, label)}
              onEdgeChange={(eid, patch, group) => update((w) => ({ ...w, edges: w.edges.map((e) => (e.id === eid ? { ...e, ...patch } : e)) }), group)}
              onEdgeDelete={(eid) => update((w) => ({ ...w, edges: w.edges.filter((e) => e.id !== eid) }))}
              onAddNext={(kind) => addNode(kind, selected.id)}
              onDuplicate={() => duplicateNode(selected.id)}
            />
          ) : (
            <NodeDetail wf={draft} node={selected} onSelect={(nid) => select(nid)} onEdit={canEdit ? () => setEditing(true) : undefined} from={here} />
          ))}
      </Sheet>

      <Sheet open={Boolean(edge) && editing} onClose={() => setEdgeSel(null)} size="half" kicker="Connection" title="Edit connection" className="sheet--explorer">
        {edge && (
          <EdgeEditor
            wf={draft}
            edge={edge}
            onChange={(patch, group) => update((w) => ({ ...w, edges: w.edges.map((e) => (e.id === edge.id ? { ...e, ...patch } : e)) }), group)}
            onDelete={() => {
              update((w) => ({ ...w, edges: w.edges.filter((e) => e.id !== edge.id) }))
              setEdgeSel(null)
            }}
            onInsert={(kind) => insertOnEdge(edge.id, kind)}
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
        className="sheet--explorer sheet--page"
        footer={
          <div className="row gap-s">
            <button className="btn btn--ghost" onClick={() => (canEdit ? (dirty ? toast('Save or discard your map changes first.', 'info') : setEditMeta(true)) : requestEdit())}>
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
