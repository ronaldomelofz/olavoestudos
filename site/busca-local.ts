import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const RAIZ = resolve(__dirname, '..')
const BIB = join(RAIZ, 'ACERVO', 'BIBLIOTECA')
const SEM = join(RAIZ, 'ACERVO', 'SEMINARIO')
const ESTUDO = join(RAIZ, 'TRANSCRICOES', 'ESTUDO')

export type Fonte = 'cof' | 'livros' | 'planeta' | 'seminario' | 'aulas'

interface Doc {
  fonte: Fonte
  titulo: string
  sub?: string
  link: string
  texto: string
  /** Mesmo comprimento de `texto`: minúsculo e sem acentos, para casar posições. */
  plano: string
}

/** Remove acentos caractere a caractere, preservando o comprimento para os trechos. */
function aplainar(s: string): string {
  let out = ''
  for (const c of s) {
    if (c.length !== 1) {
      out += c
      continue
    }
    const b = c.normalize('NFD')[0].toLowerCase()
    out += b.length === 1 ? b : c
  }
  return out
}

const semHtml = (h: string) =>
  h
    .replace(/<\/(p|h\d|li|blockquote)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

const ler = (p: string) => readFileSync(p, 'utf-8')
const lista = (d: string, ext: string) => (existsSync(d) ? readdirSync(d).filter((n) => n.endsWith(ext) && !n.startsWith('_')) : [])

function doc(fonte: Fonte, titulo: string, link: string, texto: string, sub?: string): Doc {
  return { fonte, titulo, link, texto, plano: aplainar(texto), sub }
}

function carregar(): Doc[] {
  const docs: Doc[] = []
  const indice = existsSync(join(BIB, '_indice.json')) ? JSON.parse(ler(join(BIB, '_indice.json'))) : null
  if (indice) {
    for (const a of indice.cof) {
      const p = join(BIB, 'cof', `${a.id}.json`)
      if (!existsSync(p)) continue
      const d = JSON.parse(ler(p))
      docs.push(doc('cof', `COF · ${a.titulo}`, `/biblioteca/cof/${a.id}`, semHtml(d.html), a.data ?? undefined))
    }
    for (const l of indice.livros) {
      const p = join(BIB, 'livros', `${l.slug}.json`)
      if (!existsSync(p)) continue
      const d = JSON.parse(ler(p))
      d.paginas.forEach((t: string, i: number) => {
        if (t.trim()) docs.push(doc('livros', l.titulo, `/biblioteca/livros/${l.slug}?p=${i + 1}`, t, `página ${i + 1}`))
      })
    }
    for (const a of indice.planeta) {
      if (!a.texto) continue
      docs.push(doc('planeta', `Planeta nº ${a.num} · ${a.titulo}`, `/biblioteca/planeta/${a.slug}`, ler(join(BIB, 'planeta', a.texto)), a.data))
    }
  }
  for (const pasta of ['textos', 'guias'] as const) {
    for (const n of lista(join(SEM, pasta), '.md')) {
      const t = ler(join(SEM, pasta, n))
      const titulo = /^# (.+)$/m.exec(t)?.[1] ?? n
      docs.push(doc('seminario', titulo, `/${pasta}/${n.slice(0, -3)}`, t.replace(/^# .+$/m, ''), pasta === 'guias' ? 'guia de estudo' : undefined))
    }
  }
  for (const n of lista(ESTUDO, '.md')) {
    const t = ler(join(ESTUDO, n))
    const titulo = /^title:\s*"?(.+?)"?$/m.exec(t)?.[1] ?? n
    docs.push(doc('aulas', titulo, `/videos/${n.slice(0, -3)}`, t.replace(/^---[\s\S]*?---/, '')))
  }
  return docs
}

let cache: { docs: Doc[]; chave: string } | null = null

/** Recarrega quando os índices mudam (novas transcrições, nova biblioteca). */
function corpus(): Doc[] {
  const marca = (p: string) => (existsSync(p) ? statSync(p).mtimeMs : 0)
  const chave = [marca(join(BIB, '_indice.json')), lista(ESTUDO, '.md').length, lista(join(SEM, 'textos'), '.md').length].join(':')
  if (!cache || cache.chave !== chave) cache = { docs: carregar(), chave }
  return cache.docs
}

export function buscar(q: string, fontes: Fonte[] | null, limite = 80) {
  const termos: string[] = []
  const bruto = q.trim()
  for (const m of bruto.matchAll(/"([^"]+)"|(\S+)/g)) termos.push(aplainar(m[1] ?? m[2]))
  const validos = termos.filter((t) => t.length >= 2)
  if (!validos.length) return { total: 0, porFonte: {}, resultados: [] }
  const porFonte: Record<string, number> = {}
  const achados: { d: Doc; n: number; pos: number[] }[] = []
  for (const d of corpus()) {
    let n = 0
    const pos: number[] = []
    let ok = true
    for (const t of validos) {
      let i = d.plano.indexOf(t)
      if (i < 0) {
        ok = false
        break
      }
      while (i >= 0) {
        n++
        if (pos.length < 3 && t === validos[0]) pos.push(i)
        i = d.plano.indexOf(t, i + t.length)
      }
    }
    if (!ok) continue
    porFonte[d.fonte] = (porFonte[d.fonte] ?? 0) + 1
    if (!fontes || fontes.includes(d.fonte)) achados.push({ d, n, pos })
  }
  achados.sort((a, b) => b.n - a.n)
  const tam = validos[0].length
  return {
    total: achados.length,
    porFonte,
    resultados: achados.slice(0, limite).map(({ d, n, pos }) => ({
      fonte: d.fonte,
      titulo: d.titulo,
      sub: d.sub,
      link: d.link,
      ocorrencias: n,
      trechos: pos.map((i) => {
        const a = Math.max(0, i - 160)
        const b = Math.min(d.texto.length, i + tam + 200)
        return {
          antes: (a > 0 ? '…' : '') + d.texto.slice(a, i).replace(/\s+/g, ' '),
          termo: d.texto.slice(i, i + tam),
          depois: d.texto.slice(i + tam, b).replace(/\s+/g, ' ') + (b < d.texto.length ? '…' : ''),
        }
      }),
    })),
  }
}
