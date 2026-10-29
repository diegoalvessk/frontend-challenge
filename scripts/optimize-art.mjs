// Gera as variantes WebP responsivas das artes exportadas do Figma.
// Origem: design/source-art/*.png (1254x1254) -> public/nfts/<nome>-<largura>.webp
import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SOURCE = 'design/source-art'
const TARGET = 'public/nfts'
const WIDTHS = [400, 800]

await mkdir(TARGET, { recursive: true })

for (const file of await readdir(SOURCE)) {
  if (!file.endsWith('.png')) continue
  const name = path.basename(file, '.png')
  for (const width of WIDTHS) {
    const out = path.join(TARGET, `${name}-${width}.webp`)
    await sharp(path.join(SOURCE, file)).resize(width).webp({ quality: 78 }).toFile(out)
    console.log(out)
  }
}
