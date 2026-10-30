import { createHmac, timingSafeEqual } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { buscar, type Fonte } from './busca-local'

const env = loadEnv(process.env.MODE || 'development', __dirname, '')
const ESTUDO_USER = env.ESTUDO_USER || process.env.ESTUDO_USER || ''
const ESTUDO_PASS = env.ESTUDO_PASS || process.env.ESTUDO_PASS || ''
const ESTUDO_SECRET = env.ESTUDO_SECRET || process.env.ESTUDO_SECRET || ESTUDO_PASS || 'estudo-local'

function igual(a: string, b: string) {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}
function token(expira: number) {
  const corpo = `ok.${expira}`
  return `${corpo}.${createHmac('sha256', ESTUDO_SECRET).update(corpo).digest('base64url')}`
}
function sessaoValida(t?: string) {
  if (!t) return false
  const p = t.split('.')
  if (p.length !== 3 || p[0] !== 'ok') return false
  const expira = Number(p[1])
  return Number.isFinite(expira) && Date.now() <= expira && igual(t, token(expira))
}
function lerCookie(req: IncomingMessage, nome: string) {
  return new RegExp(`(?:^|;\\s*)${nome}=([^;]+)`).exec(req.headers.cookie ?? '')?.[1]
}
function corpoJson(req: IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolveBody) => {
    const blocos: Buffer[] = []
    req.on('data', (c) => blocos.push(c))
    req.on('end', () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(blocos).toString('utf8') || '{}'))
      } catch {
        resolveBody({})
      }
    })
  })
}

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

/** Login local espelha a função Netlify: senha só no servidor, cookie HttpOnly. */
async function loginLocal(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  const metodo = (req.method || 'GET').toUpperCase()
  if (metodo === 'GET') {
    const ok = sessaoValida(lerCookie(req, 'estudo_sessao'))
    res.statusCode = ok ? 200 : 401
    return res.end(JSON.stringify({ ok }))
  }
  if (metodo === 'DELETE') {
    res.setHeader('Set-Cookie', 'estudo_sessao=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
    return res.end(JSON.stringify({ ok: false }))
  }
  if (metodo !== 'POST') {
    res.statusCode = 405
    return res.end(JSON.stringify({ ok: false }))
  }
  const body = await corpoJson(req)
  const certo =
    Boolean(ESTUDO_USER && ESTUDO_PASS) &&
    igual((body.user || '').trim(), ESTUDO_USER) &&
    igual(body.pass || '', ESTUDO_PASS)
  if (!certo) {
    res.statusCode = 401
    return res.end(JSON.stringify({ ok: false }))
  }
  const expira = Date.now() + 7 * 24 * 3600 * 1000
  res.setHeader('Set-Cookie', `estudo_sessao=${token(expira)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`)
  return res.end(JSON.stringify({ ok: true }))
}

/** /andamento.json e /api/busca são calculados na hora; /acervo e /livros vêm do disco. */
function painel(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const [caminho, consulta = ''] = (req.url ?? '').split('?')
  const url = decodeURIComponent(caminho)
  if (url === '/.netlify/functions/login' || url === '/api/login') {
    void loginLocal(req, res)
    return
  }
  if (url === '/andamento.json') {
    const r = spawnSync('python', ['../scripts/andamento.py', '--stdout'], {
      cwd: __dirname,
      encoding: 'utf-8',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    })
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
