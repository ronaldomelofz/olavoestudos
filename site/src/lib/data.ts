import { useEffect, useState } from 'react'
import type { Curadoria, IndiceTextos, Playlist, Seminario, Texto, Transcricao, Video } from './types'

interface Colecoes {
  videos: Video[]
  playlists: Playlist[]
  textos: Texto[]
  seminario: Seminario
  curadoria: Curadoria
}

type Nome = keyof Colecoes

const cache = new Map<Nome, Promise<unknown>>()

function carregar<N extends Nome>(nome: N): Promise<Colecoes[N]> {
  if (!cache.has(nome)) {
    cache.set(
      nome,
      fetch(`/data/${nome}.json`).then((r) => {
        if (!r.ok) throw new Error(`Falha ao carregar ${nome}`)
        return r.json()
      }),
    )
  }
  return cache.get(nome) as Promise<Colecoes[N]>
}

export function useData<N extends Nome>(nome: N): Colecoes[N] | null {
  const [dado, setDado] = useState<Colecoes[N] | null>(null)
  useEffect(() => {
    let vivo = true
    carregar(nome).then((d) => vivo && setDado(d))
    return () => {
      vivo = false
    }
  }, [nome])
  return dado
}

function json<T>(url: string, vazio: T): Promise<T> {
  return fetch(url)
    .then((r) => (r.ok ? r.json() : vazio))
    .catch(() => vazio)
}

let indice: Promise<IndiceTextos> | null = null

/** Índice das aulas transcritas; vazio quando a versão publicada não inclui os textos. */
export function useIndiceTextos(): IndiceTextos | null {
  const [dado, setDado] = useState<IndiceTextos | null>(null)
  useEffect(() => {
    let vivo = true
    indice ??= json<IndiceTextos>('/data/transcricoes/_indice.json', {})
    indice.then((d) => vivo && setDado(d))
    return () => {
      vivo = false
    }
  }, [])
  return dado
}

export function useTranscricao(id: string, ativo: boolean): Transcricao | null | undefined {
  const [dado, setDado] = useState<Transcricao | null | undefined>(undefined)
  useEffect(() => {
    if (!ativo) return
    let vivo = true
    setDado(undefined)
    json<Transcricao | null>(`/data/transcricoes/${id}.json`, null).then((d) => vivo && setDado(d))
    return () => {
      vivo = false
    }
  }, [id, ativo])
  return dado
}

export interface CursoLocal {
  id: number
  capa: string | null
  modulos: { nome: string; aulas: [string, string][] }[]
}

interface Acervo {
  videos: Set<string>
  miniaturas: Set<string>
  textos: Set<string>
  guias: Set<string>
  cursos: Record<string, CursoLocal>
}

/** Material salvo em ACERVO/ (só na versão local); vazio no site publicado. */
export const ACERVO: Acervo = { videos: new Set(), miniaturas: new Set(), textos: new Set(), guias: new Set(), cursos: {} }

export async function carregarAcervo(): Promise<void> {
  try {
    const r = await fetch('/acervo/_indice.json')
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return
    const d = await r.json()
    ACERVO.videos = new Set(d.videos)
    ACERVO.miniaturas = new Set(d.miniaturas)
    ACERVO.textos = new Set(d.textos)
    ACERVO.guias = new Set(d.guias)
    ACERVO.cursos = d.cursos ?? {}
  } catch {
    /* site publicado: sem acervo local */
  }
}

export const temAcervo = () => ACERVO.textos.size > 0 || ACERVO.videos.size > 0

export const SITE = 'https://olavodecarvalho.com.br'
export const urlCurso = (slug: string) => `${SITE}/cursos/${slug}`
export const urlGuia = (slug: string) => `${SITE}/guias-de-estudo/${slug}`
export const urlTexto = (slug: string) => `${SITE}/textos/${slug}`
export const urlYoutube = (id: string) => `https://www.youtube.com/watch?v=${id}`
export const thumb = (id: string) =>
  ACERVO.miniaturas.has(id) ? `/acervo/VIDEOS/${id}.jpg` : `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
export const videoLocal = (id: string) => (ACERVO.videos.has(id) ? `/acervo/VIDEOS/${id}.mp4` : null)
export const imagemLocal = (nome: string) => `/acervo/SEMINARIO/imagens/${nome}`

export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function duracao(seg: number): string {
  if (!seg) return '—'
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

export function dataBR(iso: string | null): string {
  if (!iso) return 's/ data'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

export function milhar(n: number): string {
  return n.toLocaleString('pt-BR')
}
