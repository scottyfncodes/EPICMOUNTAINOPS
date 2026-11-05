import { describe, expect, it } from 'vitest'
import { seedEntities } from '../../shared/seed'
import type { Entity, Workflow } from '../../shared/types'
import { attachImageTo } from '../../src/components/Capture'

describe('attaching screenshots', () => {
  const store = new Map<string, Entity>(seedEntities.map((e) => [e.id, structuredClone(e)]))
  const get = (id: string) => store.get(id)
  const save = async (e: Entity) => {
    store.set(e.id, e)
    return e
  }

  it('never lists the same image twice on a step (identical screenshots share an id)', async () => {
    const target = { type: 'workflow' as const, id: 'wf-ski-intake', nodeId: 'lookup', label: 'Look up' }
    await attachImageTo(target, 'img-aaaaaaaaaaaaaaaaaaaa', get, save)
    await attachImageTo(target, 'img-aaaaaaaaaaaaaaaaaaaa', get, save)
    const node = (store.get('wf-ski-intake') as Workflow).nodes.find((n) => n.id === 'lookup')!
    expect(node.imageIds).toEqual(['img-aaaaaaaaaaaaaaaaaaaa'])
  })

  it('never lists the same image twice on an entity', async () => {
    const target = { type: 'system' as const, id: 'sys-inventory', label: 'Inventory' }
    await attachImageTo(target, 'img-bbbbbbbbbbbbbbbbbbbb', get, save)
    await attachImageTo(target, 'img-bbbbbbbbbbbbbbbbbbbb', get, save)
    expect(store.get('sys-inventory')!.imageIds).toEqual(['img-bbbbbbbbbbbbbbbbbbbb'])
  })
})
