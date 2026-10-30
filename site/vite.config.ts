import { spawnSync } from 'node:child_process'
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { buscar, type Fonte } from './busca-local'

const ACERVO = resolve(__dirname, '..', 'ACERVO')
const LIVROS = resolve(__dirname, '..', 'LIVROS')
const TIPOS: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

const nomes = (pasta: string, ext: string) =>
  existsSync(pasta)
    ? readdirSync(pasta)
        .filter((n) => n.endsWith(ext) && !/^_(estado|log|indice)/.test(n) && !/\.(f[\d-]+|temp|part)\./.test(n))
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
  indice.biblioteca = existsSync(join(ACERVO, 'BIBLIOTECA', '_indice.json'))
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(indice))
}

const json = (res: ServerResponse, dado: unknown) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(typeof dado === 'string' ? dado : JSON.stringify(dado))
}

/** /andamento.json e /api/busca são calculados na hora; /acervo e /livros vêm do disco. */
function painel(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const [caminho, consulta = ''] = (req.url ?? '').split('?')
  const url = decodeURIComponent(caminho)
  if (url === '/andamento.json') {
    const r = spawnSync('python', ['../scripts/andamento.py', '--stdout'], { cwd: __dirname, encoding: 'utf-8' })
    return json(res, r.stdout || '{}')
  }
  if (url === '/api/busca') {
    const p = new URLSearchParams(consulta)
    const fontes = p.get('fontes')?.split(',').filter(Boolean) as Fonte[] | undefined
    return json(res, buscar(p.get('q') ?? '', fontes?.length ? fontes : null, Number(p.get('limite') ?? 80)))
  }
  if (url.startsWith('/acervo/')) {
    if (url === '/acervo/_indice.json') return indiceAoVivo(res)
    return servir(ACERVO, url.slice('/acervo/'.length), req, res)
  }
  if (url.startsWith('/livros/')) return servir(LIVROS, url.slice('/livros/'.length), req, res)
  next()
}

/** Serve um arquivo de `base`, com suporte a Range (vídeos e PDFs grandes). */
function servir(base: string, relativo: string, req: IncomingMessage, res: ServerResponse) {
  const arquivo = normalize(join(base, relativo))
  if (!arquivo.startsWith(base) || !existsSync(arquivo) || !statSync(arquivo).isFile()) {
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
