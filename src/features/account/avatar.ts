const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']
const MAX_INPUT_BYTES = 5 * 1024 * 1024

/**
 * Valida e redimensiona o avatar no cliente (128 px, WebP) antes do envio,
 * mantendo o payload pequeno. A API valida novamente formato e tamanho.
 */
export async function prepareAvatar(file: File): Promise<string> {
  if (!ACCEPTED.includes(file.type)) throw new Error('Use uma imagem PNG, JPEG ou WebP.')
  if (file.size > MAX_INPUT_BYTES) throw new Error('A imagem deve ter no máximo 5 MB.')
  const bitmap = await createImageBitmap(file)
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  // Recorte central quadrado.
  const side = Math.min(bitmap.width, bitmap.height)
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close()
  return canvas.toDataURL('image/webp', 0.85)
}
