import { handler, HttpError, query, readImage, readJson, requireEditor, requireReader, saveImage, send, updateImageCaption } from '../server/core.js'

export default handler({
  GET: async (req, res) => {
    requireReader(req)
    const id = query(req, 'id')
    if (!id) throw new HttpError(400, 'Missing id')
    const img = await readImage(id)
    if (!img) throw new HttpError(404, 'Image not found')
    res.statusCode = 200
    res.setHeader('Content-Type', img.mime)
    res.setHeader('Content-Length', String(img.data.length))
    // Image ids are content hashes, so they never change.
    res.setHeader('Cache-Control', process.env.OPS_PRIVATE === '1' ? 'private, max-age=31536000, immutable' : 'public, max-age=31536000, immutable')
    res.end(img.data)
  },
  POST: async (req, res) => {
    requireEditor(req)
    const body = await readJson(req)
    send(res, 200, { image: await saveImage(body) })
  },
  PATCH: async (req, res) => {
    requireEditor(req)
    const body = await readJson<{ id?: string; caption?: string }>(req)
    if (!body.id) throw new HttpError(400, 'Missing id')
    await updateImageCaption(body.id, body.caption ?? '')
    send(res, 200, { ok: true })
  },
})
