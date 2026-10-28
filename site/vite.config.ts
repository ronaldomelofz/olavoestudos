import { spawnSync } from 'node:child_process'
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const ACERVO = resolve(__dirname, '..', 'ACERVO')
const TIPOS: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

const nomes = (pasta: string, ext: string) =>
  existsSync(pasta)
    ? readdirSync(pasta)
        .filter((n) => n.endsWith(ext) && !n.startsWith('_') && !/\.(f[\d-]+|temp|part)\./.test(n))
        .map((n) => n.slice(0, -ext.length))
    : []

/** _indice.json com as listas de arquivos lidas na hora (os downloads continuam em segundo plano). */
function indiceAoVivo(res: ServerResponse) {
  const base = join(ACERVO, '_indice.json')
  const indice = existsSync(base) ? JSON.parse(readFileSync(base, 'utf-8')) : { cursos: {} }
  const videos = join(ACERVO, 'VIDEOS')
  const sem = join(ACERVO, 'SEMINARIO')
  indice.videos = nomes(videos, '.mp4')
  indice.miniaturas = nomes(videos, '.jpg')
  indice.textos = nomes(join(sem, 'textos'), '.json')
  indice.guias = nomes(join(sem, 'guias'), '.json')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(indice))
}

/** /andamento.json é medido na hora; o resto de /acervo vem do disco. */
function painel(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = decodeURIComponent((req.url ?? '').split('?')[0])
  if (url === '/andamento.json') {
    const r = spawnSync('python', ['../scripts/andamento.py', '--stdout'], { cwd: __dirname, encoding: 'utf-8' })
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(r.stdout || '{}')
    return
  }
  servirAcervo(req, res, next)
}

/** Serve a pasta ACERVO/ (vídeos, miniaturas, textos salvos) em /acervo, com suporte a Range. */
function servirAcervo(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = decodeURIComponent((req.url ?? '').split('?')[0])
  if (!url.startsWith('/acervo/')) return next()
  if (url === '/acervo/_indice.json') return indiceAoVivo(res)
  const arquivo = normalize(join(ACERVO, url.slice('/acervo/'.length)))
  if (!arquivo.startsWith(ACERVO) || !existsSync(arquivo) || !statSync(arquivo).isFile()) {
    res.statusCode = 404
    return res.end()
  }
  const tamanho = statSync(arquivo).size
  res.setHeader('Content-Type', TIPOS[extname(arquivo).toLowerCase()] ?? 'application/octet-stream')
  res.setHeader('Accept-Ranges', 'bytes')
  const faixa = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '')
  if (faixa) {
    const inicio = faixa[1] ? Number(faixa[1]) : 0
    const fim = faixa[2] ? Math.min(Number(faixa[2]), tamanho - 1) : tamanho - 1
    res.statusCode = 206
    res.setHeader('Content-Range', `bytes ${inicio}-${fim}/${tamanho}`)
    res.setHeader('Content-Length', fim - inicio + 1)
    return createReadStream(arquivo, { start: inicio, end: fim }).pipe(res)
  }
  res.setHeader('Content-Length', tamanho)
  createReadStream(arquivo).pipe(res)
}

function acervo(): Plugin {
  return {
    name: 'acervo-local',
    configureServer(server) {
      server.middlewares.use(painel)
    },
    configurePreviewServer(server) {
      server.middlewares.use(painel)
    },
  }
}

export default defineConfig({
  plugins: [react(), acervo()],
})
