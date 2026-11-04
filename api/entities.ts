import { deleteEntity, handler, HttpError, listDeleted, query, readJson, requireEditor, requireReader, saveEntity, send } from '../server/core.js'

export default handler({
  /** ?deleted=1 lists soft-deleted items so they can be restored. */
  GET: async (req, res) => {
    requireReader(req)
    if (query(req, 'deleted') !== '1') throw new HttpError(400, 'Unsupported query')
    send(res, 200, { entities: await listDeleted() })
  },
  POST: async (req, res) => {
    requireEditor(req)
    const body = await readJson<{ entity?: unknown; baseUpdatedAt?: string; note?: string; action?: 'restore' }>(req)
    const entity = await saveEntity(body.entity, { baseUpdatedAt: body.baseUpdatedAt, note: body.note, action: body.action })
    send(res, 200, { entity })
  },
  DELETE: async (req, res) => {
    requireEditor(req)
    const id = query(req, 'id')
    if (!id) throw new HttpError(400, 'Missing id')
    await deleteEntity(id)
    send(res, 200, { ok: true })
  },
})
