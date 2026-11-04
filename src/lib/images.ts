import type { ImageMeta } from '../../shared/types'
import { api } from './api'

const MAX_EDGE = 2000

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file could not be read as an image.'))
    }
    img.src = url
  })
}

/** Downscale + re-encode in the browser so screenshots stay small and EXIF/location data is stripped. */
export async function compressImage(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  const img = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Image processing is not available in this browser.')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)
  // Screenshots (PNG, lots of flat colour) compress better as WebP; fall back to JPEG.
  let dataUrl = canvas.toDataURL('image/webp', 0.86)
  if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/jpeg', 0.86)
  let q = 0.8
  while (dataUrl.length > 3_600_000 && q > 0.4) {
    dataUrl = canvas.toDataURL('image/jpeg', q)
    q -= 0.15
  }
  return { dataUrl, width, height }
}

export async function uploadImageFile(file: File, caption?: string): Promise<ImageMeta> {
  const c = await compressImage(file)
  return api.uploadImage({ ...c, caption })
}
