import { useSyncExternalStore } from 'react'

export interface Caderno {
  vistos: Record<string, string>
  favoritos: Record<string, string>
  notas: Record<string, { texto: string; titulo: string; atualizado: string }>
  semanas: Record<number, boolean>
}

const CHAVE = 'olavo-estudos:caderno:v1'
const vazio: Caderno = { vistos: {}, favoritos: {}, notas: {}, semanas: {} }
const ouvintes = new Set<() => void>()

function ler(): Caderno {
  try {
    const bruto = localStorage.getItem(CHAVE)
    return bruto ? { ...vazio, ...JSON.parse(bruto) } : vazio
  } catch {
    return vazio
  }
}

let estado = ler()

function gravar(novo: Caderno) {
  estado = novo
  localStorage.setItem(CHAVE, JSON.stringify(novo))
  ouvintes.forEach((f) => f())
}

window.addEventListener('storage', (e) => {
  if (e.key === CHAVE) {
    estado = ler()
    ouvintes.forEach((f) => f())
  }
})

function assinar(f: () => void) {
  ouvintes.add(f)
  return () => {
    ouvintes.delete(f)
  }
}

export function useCaderno(): Caderno {
  return useSyncExternalStore(assinar, () => estado)
}

const hoje = () => new Date().toISOString().slice(0, 10)

function alternar(campo: 'vistos' | 'favoritos', id: string) {
  const mapa = { ...estado[campo] }
  if (mapa[id]) delete mapa[id]
  else mapa[id] = hoje()
  gravar({ ...estado, [campo]: mapa })
}

export const alternarVisto = (id: string) => alternar('vistos', id)
export const alternarFavorito = (id: string) => alternar('favoritos', id)

export function salvarNota(id: string, titulo: string, texto: string) {
  const notas = { ...estado.notas }
  if (texto.trim()) notas[id] = { texto, titulo, atualizado: hoje() }
  else delete notas[id]
  gravar({ ...estado, notas })
}

export function alternarSemana(n: number) {
  gravar({ ...estado, semanas: { ...estado.semanas, [n]: !estado.semanas[n] } })
}

export function exportarMarkdown(c: Caderno): string {
  const linhas = ['# Caderno de estudos — Olavo de Carvalho', '', `Exportado em ${hoje()}`, '']
  linhas.push('## Anotações', '')
  for (const [id, n] of Object.entries(c.notas)) {
    const fonte = id.startsWith('texto:')
      ? `https://olavodecarvalho.com.br/textos/${id.slice(6)}`
      : `https://www.youtube.com/watch?v=${id}`
    linhas.push(`### ${n.titulo}`, `${fonte} · ${n.atualizado}`, '', n.texto, '')
  }
  linhas.push('## Assistidos', '', ...Object.entries(c.vistos).map(([id, d]) => `- ${d} · https://youtu.be/${id}`), '')
  linhas.push('## Favoritos', '', ...Object.keys(c.favoritos).map((id) => `- https://youtu.be/${id}`), '')
  return linhas.join('\n')
}

export function importarJSON(bruto: string) {
  gravar({ ...vazio, ...JSON.parse(bruto) })
}
