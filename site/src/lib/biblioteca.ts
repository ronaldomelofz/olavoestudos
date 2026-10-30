import { useEffect, useState } from 'react'

export interface AulaCof {
  id: string
  num: number
  pre: boolean
  titulo: string
  data: string | null
  status: 'revisada' | 'pendente'
  palavras: number
  video: string | null
}

export interface AulaCofTexto extends AulaCof {
  html: string
  fonte: string
}

export interface ArtigoPlaneta {
  slug: string
  num: number
  data: string
  titulo: string
  pdf?: string
  scan?: string
  texto?: string
  palavras?: number
}

export interface Livro {
  slug: string
  arquivo: string
  titulo: string
  autor: string | null
  categoria: string
  ano: number | null
  lingua: string
  paginas: number
  mb: number
  palavras: number
}

export interface Biblioteca {
  gerado: string
  cof: AulaCof[]
  planeta: ArtigoPlaneta[]
  livros: Livro[]
}

const VAZIA: Biblioteca = { gerado: '', cof: [], planeta: [], livros: [] }
const BASE = '/acervo/BIBLIOTECA'

function json<T>(url: string, vazio: T): Promise<T> {
  return fetch(url)
    .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : vazio))
    .catch(() => vazio)
}

let indice: Promise<Biblioteca> | null = null

export function useBiblioteca(): Biblioteca | null {
  const [dado, setDado] = useState<Biblioteca | null>(null)
  useEffect(() => {
    let vivo = true
    indice ??= json(`${BASE}/_indice.json`, VAZIA)
    indice.then((d) => vivo && setDado(d))
    return () => {
      vivo = false
    }
  }, [])
  return dado
}

/** Carrega um arquivo da biblioteca; `undefined` enquanto carrega, `null` se não existe. */
export function useArquivo<T>(caminho: string): T | null | undefined {
  const [dado, setDado] = useState<T | null | undefined>(undefined)
  useEffect(() => {
    let vivo = true
    setDado(undefined)
    json<T | null>(`${BASE}/${caminho}`, null).then((d) => vivo && setDado(d))
    return () => {
      vivo = false
    }
  }, [caminho])
  return dado
}

export function useTexto(caminho: string | undefined): string | null | undefined {
  const [dado, setDado] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    if (!caminho) return setDado(null)
    let vivo = true
    setDado(undefined)
    fetch(`${BASE}/${caminho}`)
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null)
      .then((t) => vivo && setDado(t))
    return () => {
      vivo = false
    }
  }, [caminho])
  return dado
}

export const pdfLivro = (l: Livro) => `/livros/${encodeURIComponent(l.arquivo)}`
export const pdfPlaneta = (nome: string) => `${BASE}/planeta/${encodeURIComponent(nome)}`

export type FonteBusca = 'cof' | 'livros' | 'planeta' | 'seminario' | 'aulas'

export const NOMES_FONTE: Record<FonteBusca, string> = {
  cof: 'COF transcrito',
  livros: 'Livros',
  planeta: 'Revista Planeta',
  seminario: 'Textos do Seminário',
  aulas: 'Aulas em vídeo',
}

export interface ResultadoBusca {
  total: number
  porFonte: Partial<Record<FonteBusca, number>>
  resultados: {
    fonte: FonteBusca
    titulo: string
    sub?: string
    link: string
    ocorrencias: number
    trechos: { antes: string; termo: string; depois: string }[]
  }[]
}
