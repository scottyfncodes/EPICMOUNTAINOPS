import { deleteEntity, handler, HttpError, query, readJson, requireEditor, saveEntity, send } from '../server/core.js'

export default handler({
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
