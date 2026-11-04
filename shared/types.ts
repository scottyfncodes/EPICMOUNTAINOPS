/**
 * EPIC MOUNTAIN OPS — content model.
 *
 * Every piece of content is an Entity. Entities reference each other by id
 * (never by copying text), so one system can support many workflows, one
 * glossary term can appear in many steps, and one image can support many
 * explanations.
 *
 * Organization and User are implicit for the single-owner first release:
 * the organization is the app itself, and the owner is whoever holds the
 * edit key. `createdBy` / `updatedBy` fields are reserved so a multi-user
 * upgrade can populate them without a schema change.
 */

export type Status = 'verified' | 'observed' | 'unverified' | 'outdated'

export const STATUSES: Status[] = ['verified', 'observed', 'unverified', 'outdated']

export type EntityType =
  | 'department'
  | 'workflow'
  | 'system'
  | 'equipment'
  | 'glossary'
  | 'note'
  | 'source'

export interface BaseEntity {
  id: string
  type: EntityType
  title: string
  status: Status
  summary?: string
  notes?: string
  /** Free-text source/reference (e.g. "Shown by shop lead, 11/2"). */
  source?: string
  /** Structured sources. */
  sourceIds?: string[]
  imageIds?: string[]
  /** Marks starter/placeholder content that is NOT an official procedure. */
  illustrative?: boolean
  createdAt: string
  updatedAt: string
  lastVerifiedAt?: string
  /** Revision number, incremented by the server on every save. */
  rev?: number
  createdBy?: string
  updatedBy?: string
}

export type AccentKey = 'brass' | 'glacier' | 'forest' | 'signal' | 'slate' | 'lichen'

export interface DepartmentSection {
  id: string
  title: string
  description?: string
  workflowIds: string[]
}

export interface Department extends BaseEntity {
  type: 'department'
  code: string
  accent: AccentKey
  /** Optional emblem artwork (falls back to one matched by department code). */
  emblem?: 'ski' | 'snb' | 'jrt' | 'none'
  tagline?: string
  description?: string
  sections: DepartmentSection[]
  responsibilities: string[]
  systemIds?: string[]
  equipmentIds?: string[]
  order: number
}

export type NodeKind =
  | 'start'
  | 'step'
  | 'decision'
  | 'warning'
  | 'parallel'
  | 'link'
  | 'unknown'
  | 'end'

export interface FlowNode {
  id: string
  kind: NodeKind
  label: string
  x?: number
  y?: number
  /** 2. What happens */
  what?: string
  /** 3. Why it happens */
  why?: string
  /** 4. Who is responsible */
  who?: string
  /** 5. Systems / equipment involved */
  systemIds?: string[]
  equipmentIds?: string[]
  /** 6. Information required */
  info?: string
  /** 7. What happens next (free text; outgoing connections are shown automatically) */
  next?: string
  /** 8. Common mistakes */
  mistakes?: string
  /** 9. Important considerations */
  considerations?: string
  /** 10. Related workflows */
  relatedWorkflowIds?: string[]
  /** 11. Reference screenshots */
  imageIds?: string[]
  /** For `link` nodes: the workflow this step hands off to. */
  linkWorkflowId?: string
  status?: Status
}

export type EdgeKind = 'normal' | 'yes' | 'no' | 'branch' | 'loop'

export interface FlowEdge {
  id: string
  source: string
  target: string
  label?: string
  kind?: EdgeKind
}

export interface Workflow extends BaseEntity {
  type: 'workflow'
  code?: string
  departmentIds: string[]
  systemIds: string[]
  equipmentIds: string[]
  trigger?: string
  outcome?: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  /** Layout direction preference. */
  direction?: 'TB' | 'LR'
}

export type SystemKind = 'software' | 'program' | 'tool' | 'reference' | 'process'

export interface System extends BaseEntity {
  type: 'system'
  kind: SystemKind
  description?: string
  purpose?: string
  departmentIds: string[]
  inputs: string[]
  outputs: string[]
  whenUsed?: string
}

export interface Equipment extends BaseEntity {
  type: 'equipment'
  category?: string
  description?: string
  departmentIds: string[]
  systemIds?: string[]
}

export type GlossaryKind = 'acronym' | 'equipment' | 'department' | 'software' | 'process' | 'general'

export interface GlossaryEntry extends BaseEntity {
  type: 'glossary'
  kind: GlossaryKind
  definition: string
  aka: string[]
  departmentIds: string[]
  systemIds: string[]
  workflowIds: string[]
}

export interface EntityRef {
  type: EntityType
  id: string
  nodeId?: string
}

export interface Note extends BaseEntity {
  type: 'note'
  kind: 'observation' | 'question'
  body?: string
  links: EntityRef[]
  resolved?: boolean
  answer?: string
}

export type SourceKind = 'document' | 'training' | 'demonstration' | 'verbal' | 'screenshot' | 'firsthand' | 'other'

export interface Source extends BaseEntity {
  type: 'source'
  kind: SourceKind
  description?: string
  date?: string
  authorized?: boolean
}

export type Entity = Department | Workflow | System | Equipment | GlossaryEntry | Note | Source

export interface ImageMeta {
  id: string
  mime: string
  width?: number
  height?: number
  bytes?: number
  caption?: string
  createdAt: string
}

export interface ContentPayload {
  entities: Entity[]
  images: ImageMeta[]
  serverTime: string
  editable: boolean
  /** True when the server runs in private mode (reads need the key or a read session). */
  private?: boolean
}

export interface VersionRecord {
  id: number
  entityId: string
  action: 'create' | 'update' | 'delete' | 'restore' | 'seed'
  note?: string
  createdAt: string
  data: Entity
}
