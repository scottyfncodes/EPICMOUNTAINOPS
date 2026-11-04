import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  ContentPayload,
  Department,
  Entity,
  EntityType,
  Equipment,
  FlowNode,
  GlossaryEntry,
  ImageMeta,
  Note,
  Source,
  System,
  Workflow,
} from '../../shared/types'
import { api, ApiError, currentKey, setKey, setPrivateMode } from './api'

/* ------------------------------------------------------------------ */
/* Atlas: an indexed, read-only view of all content                   */
/* ------------------------------------------------------------------ */
type ByType = {
  department: Department
  workflow: Workflow
  system: System
  equipment: Equipment
  glossary: GlossaryEntry
  note: Note
  source: Source
}

export interface NodeRef {
  workflow: Workflow
  node: FlowNode
}

export interface Atlas {
  all: Entity[]
  byId: Map<string, Entity>
  images: Map<string, ImageMeta>
  imageList: ImageMeta[]
  get<T extends Entity = Entity>(id: string | undefined): T | undefined
  list<K extends EntityType>(type: K): ByType[K][]
  departments: Department[]
  /** Workflows referencing a system — at workflow level or within a step. */
  workflowsForSystem(id: string): { workflow: Workflow; nodes: FlowNode[] }[]
  workflowsForEquipment(id: string): { workflow: Workflow; nodes: FlowNode[] }[]
  workflowsForDepartment(id: string): Workflow[]
  departmentsForWorkflow(w: Workflow): Department[]
  /** Workflows that link (hand off) to this workflow. */
  inboundLinks(id: string): NodeRef[]
  /** Other departments this department hands off to or receives from. */
  departmentConnections(id: string): { department: Department; via: NodeRef[]; direction: 'out' | 'in' }[]
  notesFor(type: EntityType, id: string, nodeId?: string): Note[]
  glossaryFor(field: 'systemIds' | 'workflowIds' | 'departmentIds', id: string): GlossaryEntry[]
  imagesUsedBy(imageId: string): { entity: Entity; node?: FlowNode }[]
}

function buildAtlas(entities: Entity[], images: ImageMeta[]): Atlas {
  const byId = new Map(entities.map((e) => [e.id, e]))
  const imgMap = new Map(images.map((i) => [i.id, i]))
  const lists = new Map<EntityType, Entity[]>()
  for (const e of entities) {
    if (!lists.has(e.type)) lists.set(e.type, [])
    lists.get(e.type)!.push(e)
  }
  const sortTitle = (a: Entity, b: Entity) => a.title.localeCompare(b.title)
  for (const [t, arr] of lists) {
    if (t === 'department') arr.sort((a, b) => (a as Department).order - (b as Department).order || sortTitle(a, b))
    else if (t === 'workflow') arr.sort((a, b) => ((a as Workflow).code || a.title).localeCompare((b as Workflow).code || b.title))
    else arr.sort(sortTitle)
  }
  const workflows = (lists.get('workflow') || []) as Workflow[]
  const departments = (lists.get('department') || []) as Department[]
  const notes = (lists.get('note') || []) as Note[]
  const glossary = (lists.get('glossary') || []) as GlossaryEntry[]

  const refsFor = (field: 'systemIds' | 'equipmentIds', id: string) =>
    workflows
      .map((w) => ({ workflow: w, nodes: w.nodes.filter((n) => n[field]?.includes(id)) }))
      .filter((x) => x.nodes.length || x.workflow[field]?.includes(id))

  const workflowsForDepartment = (id: string) => {
    const d = byId.get(id) as Department | undefined
    const inSections = new Set(d?.sections.flatMap((s) => s.workflowIds) || [])
    return workflows.filter((w) => w.departmentIds.includes(id) || inSections.has(w.id))
  }

  const inbound = new Map<string, NodeRef[]>()
  for (const w of workflows)
    for (const n of w.nodes)
      if (n.kind === 'link' && n.linkWorkflowId) {
        if (!inbound.has(n.linkWorkflowId)) inbound.set(n.linkWorkflowId, [])
        inbound.get(n.linkWorkflowId)!.push({ workflow: w, node: n })
      }

  const primaryDept = (w: Workflow) => w.departmentIds[0]

  return {
    all: entities,
    byId,
    images: imgMap,
    imageList: images,
    get: <T extends Entity>(id: string | undefined) => (id ? (byId.get(id) as T | undefined) : undefined),
    list: <K extends EntityType>(type: K) => (lists.get(type) || []) as ByType[K][],
    departments,
    workflowsForSystem: (id) => refsFor('systemIds', id),
    workflowsForEquipment: (id) => refsFor('equipmentIds', id),
    workflowsForDepartment,
    departmentsForWorkflow: (w) => w.departmentIds.map((id) => byId.get(id) as Department).filter(Boolean),
    inboundLinks: (id) => inbound.get(id) || [],
    departmentConnections: (deptId) => {
      const out = new Map<string, { department: Department; via: NodeRef[]; direction: 'out' | 'in' }>()
      for (const w of workflows) {
        for (const n of w.nodes) {
          if (n.kind !== 'link' || !n.linkWorkflowId) continue
          const target = byId.get(n.linkWorkflowId) as Workflow | undefined
          if (!target) continue
          const from = primaryDept(w)
          const to = primaryDept(target)
          if (!from || !to || from === to) continue
          if (from === deptId || to === deptId) {
            const otherId = from === deptId ? to : from
            const other = byId.get(otherId) as Department | undefined
            if (!other) continue
            const key = otherId + (from === deptId ? ':out' : ':in')
            if (!out.has(key)) out.set(key, { department: other, via: [], direction: from === deptId ? 'out' : 'in' })
            out.get(key)!.via.push({ workflow: w, node: n })
          }
        }
      }
      return [...out.values()]
    },
    notesFor: (type, id, nodeId) =>
      notes.filter((n) => n.links.some((l) => l.type === type && l.id === id && (nodeId === undefined || l.nodeId === nodeId))),
    glossaryFor: (field, id) => glossary.filter((g) => g[field]?.includes(id)),
    imagesUsedBy: (imageId) => {
      const out: { entity: Entity; node?: FlowNode }[] = []
      for (const e of entities) {
        if (e.imageIds?.includes(imageId)) out.push({ entity: e })
        if (e.type === 'workflow') for (const n of e.nodes) if (n.imageIds?.includes(imageId)) out.push({ entity: e, node: n })
      }
      return out
    },
  }
}

/* ------------------------------------------------------------------ */
/* Store                                                              */
/* ------------------------------------------------------------------ */
type LoadState = 'loading' | 'ready' | 'error' | 'locked'

interface Toast {
  id: number
  kind: 'ok' | 'error' | 'info'
  text: string
}

interface StoreValue {
  state: LoadState
  error?: string
  offline: boolean
  atlas: Atlas
  canEdit: boolean
  unlock(key: string, remember: boolean): Promise<boolean>
  lock(): void
  save<T extends Entity>(entity: T, opts?: { note?: string; action?: 'restore'; quiet?: boolean }): Promise<T>
  remove(id: string): Promise<void>
  addImage(meta: ImageMeta): void
  refresh(): Promise<void>
  toast(text: string, kind?: Toast['kind']): void
  toasts: Toast[]
  dismissToast(id: number): void
  keyPrompt: boolean
  requestEdit(): void
  closeKeyPrompt(): void
}

const StoreContext = createContext<StoreValue | null>(null)
const CACHE_KEY = 'ops.cache.v1'

function readCache(): ContentPayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as ContentPayload) : null
  } catch {
    return null
  }
}
function writeCache(p: ContentPayload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(p))
  } catch {
    /* quota or private mode — the server is the source of truth anyway */
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const cached = useRef(readCache())
  const [entities, setEntities] = useState<Entity[]>(cached.current?.entities || [])
  const [images, setImages] = useState<ImageMeta[]>(cached.current?.images || [])
  const [state, setState] = useState<LoadState>(cached.current ? 'ready' : 'loading')
  const [error, setError] = useState<string>()
  const [offline, setOffline] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [keyPrompt, setKeyPrompt] = useState(false)
  const toastId = useRef(0)

  const toast = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = ++toastId.current
    setToasts((t) => [...t.slice(-2), { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3200)
  }, [])

  const load = useCallback(async () => {
    try {
      const payload = await api.content()
      setEntities(payload.entities)
      setImages(payload.images)
      setCanEdit(payload.editable)
      setState('ready')
      setOffline(false)
      writeCache(payload)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setPrivateMode(true)
        setState('locked')
        return
      }
      if (cached.current) {
        setOffline(true)
        setState('ready')
      } else {
        setError((err as Error).message)
        setState('error')
      }
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const atlas = useMemo(() => buildAtlas(entities, images), [entities, images])

  const persistCache = useCallback((nextEntities: Entity[], nextImages: ImageMeta[]) => {
    writeCache({ entities: nextEntities, images: nextImages, serverTime: new Date().toISOString(), editable: false })
  }, [])

  const save = useCallback(
    async <T extends Entity>(entity: T, opts: { note?: string; action?: 'restore'; quiet?: boolean } = {}) => {
      const prev = atlas.get(entity.id)
      try {
        const saved = (await api.save(entity, { baseUpdatedAt: prev?.updatedAt, note: opts.note, action: opts.action })) as T
        setEntities((list) => {
          const next = prev ? list.map((e) => (e.id === saved.id ? saved : e)) : [...list, saved]
          persistCache(next, images)
          return next
        })
        if (!opts.quiet) toast('Saved')
        return saved
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setCanEdit(false)
          setKeyPrompt(true)
        }
        toast((err as Error).message, 'error')
        throw err
      }
    },
    [atlas, images, persistCache, toast],
  )

  const remove = useCallback(
    async (id: string) => {
      try {
        await api.remove(id)
        setEntities((list) => {
          const next = list.filter((e) => e.id !== id)
          persistCache(next, images)
          return next
        })
        toast('Deleted — recoverable from version history')
      } catch (err) {
        toast((err as Error).message, 'error')
        throw err
      }
    },
    [images, persistCache, toast],
  )

  const unlock = useCallback(
    async (key: string, remember: boolean) => {
      const ok = await api.checkKey(key)
      if (ok) {
        setKey(key, remember)
        setCanEdit(true)
        setKeyPrompt(false)
        if (state === 'locked') await load()
        toast('Editing unlocked')
      }
      return ok
    },
    [load, state, toast],
  )

  const value: StoreValue = {
    state,
    error,
    offline,
    atlas,
    canEdit,
    unlock,
    lock: () => {
      setKey(null)
      setCanEdit(false)
      toast('Editing locked on this device', 'info')
    },
    save,
    remove,
    addImage: (meta) => setImages((list) => (list.some((i) => i.id === meta.id) ? list : [meta, ...list])),
    refresh: load,
    toast,
    toasts,
    dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    keyPrompt,
    requestEdit: () => {
      if (canEdit) return
      setKeyPrompt(true)
    },
    closeKeyPrompt: () => setKeyPrompt(false),
  }

  // Revalidate key silently on start when one is stored.
  useEffect(() => {
    if (currentKey() && !canEdit && state === 'ready' && !offline) {
      api.checkKey(currentKey()!).then((ok) => ok && setCanEdit(true)).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const v = useContext(StoreContext)
  if (!v) throw new Error('useStore outside provider')
  return v
}

export const useAtlas = () => useStore().atlas

/* ------------------------------------------------------------------ */
/* Recently viewed (per device convenience only)                      */
/* ------------------------------------------------------------------ */
const RECENT_KEY = 'ops.recent.v1'
export interface RecentItem {
  type: EntityType
  id: string
  nodeId?: string
  at: string
}
export function readRecent(): RecentItem[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  } catch {
    return []
  }
}
export function pushRecent(item: Omit<RecentItem, 'at'>) {
  try {
    const list = readRecent().filter((r) => !(r.type === item.type && r.id === item.id))
    list.unshift({ ...item, at: new Date().toISOString() })
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 12)))
  } catch {
    /* ignore */
  }
}
