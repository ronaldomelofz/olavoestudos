export interface Capitulo {
  t: number
  title: string
}

export interface Video {
  id: string
  t: string
  d: string | null
  dur: number
  v: number
  aba: 'videos' | 'streams' | 'playlist'
  live: boolean
  pl: string[]
  lang: 'pt' | 'en'
  desc: string
  ch: Capitulo[]
  tr: string[]
  co: string[]
  ext?: boolean
  /** Removido do YouTube; o registro fica só para estudo pessoal e sai do site público. */
  off?: boolean
}

export interface Playlist {
  id: string
  titulo: string
  descricao: string
  videos: string[]
  origem?: string
  url?: string | null
}

export interface Transcricao {
  id: string
  fonte: string
  ed: string
  integ: number
  p: [number, string][]
}

export type IndiceTextos = Record<string, { palavras: number; fonte: string }>

export interface Texto {
  id: number
  t: string
  s: string
  d: string
  tipo: 'artigo' | 'texto'
  temas: string[]
  au: string | null
  desc: string
  views: number
  tr: string[]
  co: string[]
}

export interface Curso {
  slug: string
  titulo: string
  desc: string
}

export interface Guia {
  slug: string
  titulo: string
  autor: string
  desc: string
  data: string
}

export interface Aula {
  id: number
  title: string
  desc: string
  mod: number
}

export interface Tema {
  id: number
  tag: string
  arts: number
  courses: number
}

export interface Seminario {
  cursos: Curso[]
  guias: Guia[]
  aulas: Aula[]
  temas: Tema[]
}

export interface Trilha {
  id: string
  ordem: number
  titulo: string
  subtitulo: string
  resumo: string
  perguntas: string[]
  cursos: string[]
  guias: string[]
  textos: string[]
  chaves: string[]
}

export interface Conceito {
  id: string
  termo: string
  trilha: string
  definicao: string
  chaves: string[]
}

export interface SemanaPlano {
  semana: number
  trilha: string
  foco: string
  exercicio: string
}

export interface Livro {
  titulo: string
  ano: number
  tema: string
}

export interface Curadoria {
  trilhas: Trilha[]
  conceitos: Conceito[]
  plano: SemanaPlano[]
  livros: Livro[]
  gerado: string
}
